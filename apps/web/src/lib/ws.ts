import { messageReceived, sendPress, socketClosed, socketOpened } from '@/model/room';

let socket: WebSocket | null = null;

function open() {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(`${proto}//${location.host}/ws`);

	ws.addEventListener('open', () => socketOpened());
	ws.addEventListener('close', () => socketClosed());
	ws.addEventListener('message', (e) => {
		try {
			const msg = JSON.parse(e.data);
			if (msg && typeof msg === 'object' && typeof msg.type === 'string') {
				messageReceived(msg);
			}
		} catch {
			// не JSON — игнорируем
		}
	});

	return ws;
}

socket = open();

const stopWatching = sendPress.watch(() => {
	if (socket?.readyState === WebSocket.OPEN) {
		socket.send(JSON.stringify({ type: 'press' }));
	}
});

if (import.meta.hot) {
	import.meta.hot.dispose(() => {
		stopWatching();
		socket?.close();
		socket = null;
	});
}
