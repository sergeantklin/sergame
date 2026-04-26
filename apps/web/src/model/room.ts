import { createEvent, createStore, sample } from 'effector';

export type ClientStatus = 'pending' | 'approved' | 'rejected';
export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export type PressEvent = {
	clientId: string;
	timestamp: number;
};

type HelloMessage = { type: 'hello'; clientId: string; status: ClientStatus };
type ApprovedMessage = { type: 'approved' };
type RejectedMessage = { type: 'rejected' };
type PressMessage = { type: 'press'; clientId: string; timestamp: number };
type ServerMessage = HelloMessage | ApprovedMessage | RejectedMessage | PressMessage;

export const socketOpened = createEvent();
export const socketClosed = createEvent();
export const messageReceived = createEvent<ServerMessage>();

export const pressClicked = createEvent();
export const sendPress = createEvent();

export const $connection = createStore<ConnectionStatus>('connecting')
	.on(socketOpened, () => 'open')
	.on(socketClosed, () => 'closed');

export const $myId = createStore<string | null>(null).on(messageReceived, (state, msg) =>
	msg.type === 'hello' ? msg.clientId : state,
);

export const $clientStatus = createStore<ClientStatus>('pending').on(messageReceived, (state, msg) => {
	if (msg.type === 'hello') return msg.status;
	if (msg.type === 'approved') return 'approved';
	if (msg.type === 'rejected') return 'rejected';
	return state;
});

export const $presses = createStore<PressEvent[]>([]).on(messageReceived, (state, msg) =>
	msg.type === 'press' ? [{ clientId: msg.clientId, timestamp: msg.timestamp }, ...state].slice(0, 200) : state,
);

sample({
	clock: pressClicked,
	source: { conn: $connection, status: $clientStatus },
	filter: ({ conn, status }) => conn === 'open' && status === 'approved',
	target: sendPress,
});
