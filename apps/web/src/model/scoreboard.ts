import { createEvent, createStore } from 'effector';
import { gameReset } from './game';

export const scoreAdjusted = createEvent<{ clientId: string; delta: number }>();
export const scoreReset = createEvent<string>();
export const allScoresReset = createEvent();

export const $scores = createStore<Map<string, number>>(new Map())
	.on(scoreAdjusted, (state, { clientId, delta }) => {
		const next = new Map(state);
		next.set(clientId, (next.get(clientId) ?? 0) + delta);
		return next;
	})
	.on(scoreReset, (state, clientId) => {
		const next = new Map(state);
		next.delete(clientId);
		return next;
	})
	.reset([allScoresReset, gameReset]);
