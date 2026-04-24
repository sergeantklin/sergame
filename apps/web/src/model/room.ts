import { createEvent, createStore, sample } from 'effector';

export type PressEvent = {
	clientId: string;
	timestamp: number;
};

type HelloMessage = { type: 'hello'; clientId: string };
type PressMessage = { type: 'press'; clientId: string; timestamp: number };
type ServerMessage = HelloMessage | PressMessage;

export type ConnectionStatus = 'connecting' | 'open' | 'closed';

export const socketOpened = createEvent();
export const socketClosed = createEvent();
export const messageReceived = createEvent<ServerMessage>();

export const pressClicked = createEvent();
export const sendPress = createEvent();

export const $status = createStore<ConnectionStatus>('connecting')
	.on(socketOpened, () => 'open')
	.on(socketClosed, () => 'closed');

export const $myId = createStore<string | null>(null).on(messageReceived, (state, msg) =>
	msg.type === 'hello' ? msg.clientId : state,
);

export const $presses = createStore<PressEvent[]>([]).on(messageReceived, (state, msg) =>
	msg.type === 'press' ? [{ clientId: msg.clientId, timestamp: msg.timestamp }, ...state].slice(0, 200) : state,
);

sample({
	clock: pressClicked,
	source: $status,
	filter: (status) => status === 'open',
	target: sendPress,
});
