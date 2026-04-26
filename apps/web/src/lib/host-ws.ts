import { approveRequested, hostMessageReceived, hostSocketClosed, hostSocketOpened, rejectRequested } from '@/model/host';

export function openHostWs(): () => void {
	const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
	const ws = new WebSocket(`${proto}//${location.host}/ws/host`);

	ws.addEventListener('open', () => hostSocketOpened());
	ws.addEventListener('close', () => hostSocketClosed());
	ws.addEventListener('message', (e) => {
		try {
			const msg = JSON.parse(e.data);
			if (!msg || typeof msg.type !== 'string') return;
			hostMessageReceived(msg);
		} catch {
			// не JSON — игнорируем
		}
	});

	const send = (payload: unknown) => {
		if (ws.readyState === WebSocket.OPEN) {
			ws.send(JSON.stringify(payload));
		}
	};

	const stopApprove = approveRequested.watch((clientId) => send({ type: 'approve', clientId }));
	const stopReject = rejectRequested.watch((clientId) => send({ type: 'reject', clientId }));

	return () => {
		stopApprove();
		stopReject();
		try {
			ws.close();
		} catch {
			// уже закрыт
		}
	};
}
