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

const CLIENT_HTML = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>sergame</title>
<style>
	body { font-family: system-ui, -apple-system, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
	h1 { margin-bottom: 0.25rem; }
	#me { color: #666; margin-top: 0; }
	button { font-size: 1.25rem; padding: 1rem 2rem; cursor: pointer; }
	button:disabled { cursor: not-allowed; opacity: 0.5; }
	#log { list-style: none; padding: 0; margin-top: 1.5rem; }
	#log li { padding: 0.35rem 0; border-bottom: 1px solid #eee; font-family: ui-monospace, SFMono-Regular, monospace; }
	.me { font-weight: 600; }
</style>
</head>
<body>
<h1>sergame</h1>
<p id="me">подключение…</p>
<button id="btn" disabled>Нажать</button>
<ul id="log"></ul>
<script>
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(proto + '//' + location.host + '/ws');
	const btn = document.getElementById('btn');
	const log = document.getElementById('log');
	const me = document.getElementById('me');
	let myId = null;

	ws.addEventListener('open', () => { btn.disabled = false; });
	ws.addEventListener('close', () => {
		btn.disabled = true;
		me.textContent = 'соединение закрыто';
	});
	ws.addEventListener('message', (e) => {
		const msg = JSON.parse(e.data);
		if (msg.type === 'hello') {
			myId = msg.clientId;
			me.textContent = 'вы — ' + myId;
			return;
		}
		if (msg.type === 'press') {
			const t = new Date(msg.timestamp).toLocaleTimeString();
			const li = document.createElement('li');
			if (msg.clientId === myId) li.classList.add('me');
			li.textContent = t + ' — ' + msg.clientId + ' нажал';
			log.prepend(li);
		}
	});
	btn.addEventListener('click', () => {
		ws.send(JSON.stringify({ type: 'press' }));
	});
</script>
</body>
</html>`;

export default {
	async fetch(request, env): Promise<Response> {
		const url = new URL(request.url);

		if (url.pathname === '/ws') {
			const stub = env.SERGAME_STATE.getByName('room');
			return stub.fetch(request);
		}

		if (url.pathname === '/') {
			return new Response(CLIENT_HTML, {
				headers: { 'content-type': 'text/html; charset=utf-8' },
			});
		}

		return new Response('not found', { status: 404 });
	},
} satisfies ExportedHandler<Env>;
