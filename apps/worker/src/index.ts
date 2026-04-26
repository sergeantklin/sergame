import { DurableObject } from 'cloudflare:workers';

type ClientStatus = 'pending' | 'approved' | 'rejected';
type ClientRecord = { status: 'approved' | 'rejected' };

type ClientAttachment = { role: 'client'; clientId: string };
type HostAttachment = { role: 'host' };
type Attachment = ClientAttachment | HostAttachment;

type ClientToServer = { type: 'press' };
type HostToServer = { type: 'approve'; clientId: string } | { type: 'reject'; clientId: string };

const STORAGE_KEY = 'clients';

export class SergameState extends DurableObject<Env> {
	private clients: Map<string, ClientRecord> = new Map();
	private pending: Set<string> = new Set();

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		ctx.blockConcurrencyWhile(async () => {
			const stored = await ctx.storage.get<Map<string, ClientRecord>>(STORAGE_KEY);
			if (stored) this.clients = stored;
		});
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('expected websocket', { status: 426 });
		}

		const url = new URL(request.url);
		const isHost = url.pathname.endsWith('/ws/host');

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];

		this.ctx.acceptWebSocket(server);

		if (isHost) {
			server.serializeAttachment({ role: 'host' } satisfies Attachment);
			const snapshot = [
				...[...this.pending].map((clientId) => ({ clientId, status: 'pending' as ClientStatus })),
				...[...this.clients.entries()].map(([clientId, rec]) => ({ clientId, status: rec.status })),
			];
			server.send(JSON.stringify({ type: 'snapshot', clients: snapshot }));
		} else {
			const requestedId = url.searchParams.get('id');
			let clientId: string;
			let status: ClientStatus;
			let isFreshlyPending = false;

			if (requestedId && this.clients.has(requestedId)) {
				clientId = requestedId;
				status = this.clients.get(clientId)!.status;
			} else if (requestedId && this.pending.has(requestedId)) {
				clientId = requestedId;
				status = 'pending';
			} else {
				clientId = crypto.randomUUID();
				this.pending.add(clientId);
				status = 'pending';
				isFreshlyPending = true;
			}

			for (const ws of this.ctx.getWebSockets()) {
				if (ws === server) continue;
				const att = ws.deserializeAttachment() as Attachment | null;
				if (att?.role === 'client' && att.clientId === clientId) {
					try {
						ws.close(1008, 'replaced');
					} catch {
						// уже закрыт
					}
				}
			}

			server.serializeAttachment({ role: 'client', clientId } satisfies Attachment);
			server.send(JSON.stringify({ type: 'hello', clientId, status }));

			if (status === 'rejected') {
				try {
					server.close(1008, 'rejected');
				} catch {
					// уже закрыт
				}
			} else if (isFreshlyPending) {
				this.broadcastToHosts({ type: 'join_request', clientId });
			}
		}

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') return;
		const att = ws.deserializeAttachment() as Attachment | null;
		if (!att) return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(message);
		} catch {
			return;
		}
		if (!parsed || typeof parsed !== 'object' || typeof (parsed as { type?: unknown }).type !== 'string') return;

		if (att.role === 'host') {
			await this.handleHostMessage(parsed as HostToServer);
		} else {
			this.handleClientMessage(att.clientId, parsed as ClientToServer);
		}
	}

	private async handleHostMessage(msg: HostToServer): Promise<void> {
		if (msg.type === 'approve' && typeof msg.clientId === 'string') {
			const existing = this.clients.get(msg.clientId);
			if (existing?.status === 'approved') return;
			this.pending.delete(msg.clientId);
			this.clients.set(msg.clientId, { status: 'approved' });
			await this.persist();
			this.notifyClient(msg.clientId, { type: 'approved' });
			this.broadcastToHosts({ type: 'client_status', clientId: msg.clientId, status: 'approved' });
		} else if (msg.type === 'reject' && typeof msg.clientId === 'string') {
			if (!this.pending.has(msg.clientId) && !this.clients.has(msg.clientId)) return;
			this.pending.delete(msg.clientId);
			this.clients.set(msg.clientId, { status: 'rejected' });
			await this.persist();
			this.notifyClient(msg.clientId, { type: 'rejected' });
			this.kickClient(msg.clientId);
			this.broadcastToHosts({ type: 'client_status', clientId: msg.clientId, status: 'rejected' });
		}
	}

	private handleClientMessage(clientId: string, msg: ClientToServer): void {
		const record = this.clients.get(clientId);
		if (!record || record.status !== 'approved') return;

		if (msg.type === 'press') {
			const payload = JSON.stringify({
				type: 'press',
				clientId,
				timestamp: Date.now(),
			});
			for (const peer of this.ctx.getWebSockets()) {
				const att = peer.deserializeAttachment() as Attachment | null;
				if (!att) continue;
				if (att.role === 'host') {
					try {
						peer.send(payload);
					} catch {
						// peer закрыт
					}
					continue;
				}
				const peerRec = this.clients.get(att.clientId);
				if (peerRec?.status === 'approved') {
					try {
						peer.send(payload);
					} catch {
						// peer закрыт
					}
				}
			}
		}
	}

	private broadcastToHosts(msg: unknown): void {
		const payload = JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as Attachment | null;
			if (att?.role === 'host') {
				try {
					ws.send(payload);
				} catch {
					// host отвалился
				}
			}
		}
	}

	private notifyClient(clientId: string, msg: unknown): void {
		const payload = JSON.stringify(msg);
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as Attachment | null;
			if (att?.role === 'client' && att.clientId === clientId) {
				try {
					ws.send(payload);
				} catch {
					// клиент отвалился
				}
			}
		}
	}

	private kickClient(clientId: string): void {
		for (const ws of this.ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as Attachment | null;
			if (att?.role === 'client' && att.clientId === clientId) {
				try {
					ws.close(1008, 'rejected');
				} catch {
					// уже закрыт
				}
			}
		}
	}

	private async persist(): Promise<void> {
		await this.ctx.storage.put(STORAGE_KEY, this.clients);
	}

	async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
		const att = ws.deserializeAttachment() as Attachment | null;
		if (att?.role === 'client' && this.pending.has(att.clientId)) {
			const otherAlive = this.ctx.getWebSockets().some((other) => {
				if (other === ws) return false;
				const otherAtt = other.deserializeAttachment() as Attachment | null;
				return otherAtt?.role === 'client' && otherAtt.clientId === att.clientId;
			});
			if (!otherAlive) {
				this.pending.delete(att.clientId);
				this.broadcastToHosts({ type: 'client_left', clientId: att.clientId });
			}
		}
		try {
			ws.close(code, 'closing');
		} catch {
			// уже закрыт
		}
	}

	async webSocketError(ws: WebSocket, _error: unknown): Promise<void> {
		try {
			ws.close(1011, 'error');
		} catch {
			// уже закрыт
		}
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname.startsWith('/ws')) {
			const stub = env.SERGAME_STATE.getByName('room');
			return stub.fetch(request);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
