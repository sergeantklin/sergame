import { messageReceived, sendPress, socketClosed, socketOpened } from '@/model/room';
import { loadClientId, saveClientId } from './storage';

export function openClientWs(): () => void {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const storedId = loadClientId();
	const url = storedId
		? `${proto}//${location.host}/ws?id=${encodeURIComponent(storedId)}`
		: `${proto}//${location.host}/ws`;

	const ws = new WebSocket(url);

	ws.addEventListener('open', () => socketOpened());
	ws.addEventListener('close', () => socketClosed());
	ws.addEventListener('message', (e) => {
		try {
			const msg = JSON.parse(e.data);
			if (!msg || typeof msg.type !== 'string') return;
			if (msg.type === 'hello' && typeof msg.clientId === 'string') {
				saveClientId(msg.clientId);
			}
			messageReceived(msg);
		} catch {
			// не JSON — игнорируем
		}
	});

	const stopWatching = sendPress.watch(() => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify({ type: 'press' }));
		}
	});

	return () => {
		stopWatching();
		try {
			ws.close();
		} catch {
			// уже закрыт
		}
	};
}
