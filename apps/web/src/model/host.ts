import { createEvent, createStore } from 'effector';
import type { ClientStatus, ConnectionStatus, PressEvent } from './room';

export type Player = { clientId: string; status: ClientStatus };

type SnapshotMessage = { type: 'snapshot'; clients: Player[] };
type JoinRequestMessage = { type: 'join_request'; clientId: string };
type ClientLeftMessage = { type: 'client_left'; clientId: string };
type ClientStatusMessage = { type: 'client_status'; clientId: string; status: ClientStatus };
type PressMessage = { type: 'press'; clientId: string; timestamp: number };
type HostMessage = SnapshotMessage | JoinRequestMessage | ClientLeftMessage | ClientStatusMessage | PressMessage;

export const hostSocketOpened = createEvent();
export const hostSocketClosed = createEvent();
export const hostMessageReceived = createEvent<HostMessage>();

export const approveRequested = createEvent<string>();
export const rejectRequested = createEvent<string>();

export const $hostConnection = createStore<ConnectionStatus>('connecting')
	.on(hostSocketOpened, () => 'open')
	.on(hostSocketClosed, () => 'closed');

export const $players = createStore<Player[]>([]).on(hostMessageReceived, (state, msg) => {
	switch (msg.type) {
		case 'snapshot':
			return msg.clients;
		case 'join_request':
			if (state.some((p) => p.clientId === msg.clientId)) return state;
			return [...state, { clientId: msg.clientId, status: 'pending' }];
		case 'client_left':
			return state.filter((p) => p.clientId !== msg.clientId);
		case 'client_status':
			if (state.some((p) => p.clientId === msg.clientId)) {
				return state.map((p) => (p.clientId === msg.clientId ? { ...p, status: msg.status } : p));
			}
			return [...state, { clientId: msg.clientId, status: msg.status }];
		default:
			return state;
	}
});

export const $hostPresses = createStore<PressEvent[]>([]).on(hostMessageReceived, (state, msg) => {
	if (msg.type !== 'press') return state;
	return [{ clientId: msg.clientId, timestamp: msg.timestamp }, ...state].slice(0, 200);
});
