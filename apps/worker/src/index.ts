import { DurableObject } from 'cloudflare:workers';

interface Attachment {
	clientId: string;
}

export class SergameState extends DurableObject<Env> {
	private nextId: number;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		this.nextId = 1;
		for (const ws of ctx.getWebSockets()) {
			const att = ws.deserializeAttachment() as Attachment | null;
			if (!att) continue;
			const n = Number(att.clientId.split('-')[1]);
			if (Number.isFinite(n) && n >= this.nextId) this.nextId = n + 1;
		}
	}

	async fetch(request: Request): Promise<Response> {
		if (request.headers.get('Upgrade') !== 'websocket') {
			return new Response('expected websocket', { status: 426 });
		}

		const pair = new WebSocketPair();
		const client = pair[0];
		const server = pair[1];

		const clientId = `client-${this.nextId++}`;
		this.ctx.acceptWebSocket(server);
		server.serializeAttachment({ clientId } satisfies Attachment);
		server.send(JSON.stringify({ type: 'hello', clientId }));

		return new Response(null, { status: 101, webSocket: client });
	}

	async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
		if (typeof message !== 'string') return;

		let parsed: unknown;
		try {
			parsed = JSON.parse(message);
		} catch {
			return;
		}
		if (!parsed || typeof parsed !== 'object' || (parsed as { type?: unknown }).type !== 'press') return;

		const att = ws.deserializeAttachment() as Attachment | null;
		if (!att) return;

		const payload = JSON.stringify({
			type: 'press',
			clientId: att.clientId,
			timestamp: Date.now(),
		});
		for (const peer of this.ctx.getWebSockets()) {
			try {
				peer.send(payload);
			} catch {
				// peer закрылся между вызовами — игнорируем
			}
		}
	}

	async webSocketClose(ws: WebSocket, code: number, _reason: string, _wasClean: boolean): Promise<void> {
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

		if (url.pathname === '/ws') {
			const stub = env.SERGAME_STATE.getByName('room');
			return stub.fetch(request);
		}

		return env.ASSETS.fetch(request);
	},
} satisfies ExportedHandler<Env>;
