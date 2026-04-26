import { createEvent, createStore, sample } from 'effector';
import { $stage, gameReset, type RoundCursor, type Stage, stageTransitioned } from './game';
import { hostMessageReceived } from './host';

export function cursorKey(c: RoundCursor): string {
	return `${c.roundIndex}:${c.themeIndex}:${c.questionIndex}`;
}

export const buzzReset = createEvent();
export const playedQuestionAdded = createEvent<RoundCursor>();
export const allPlayedReset = createEvent();
export const bidSet = createEvent<{ clientId: string; amount: number }>();
export const bidCleared = createEvent<string>();
export const bidsReset = createEvent();

const pressDuringCollecting = createEvent<string>();

export const $buzzedClient = createStore<string | null>(null)
	.on(pressDuringCollecting, (current, clientId) => current ?? clientId)
	.reset([buzzReset, gameReset]);

export const $playedQuestions = createStore<Set<string>>(new Set())
	.on(playedQuestionAdded, (state, cursor) => {
		const key = cursorKey(cursor);
		if (state.has(key)) return state;
		const next = new Set(state);
		next.add(key);
		return next;
	})
	.reset([allPlayedReset, gameReset]);

export const $bids = createStore<Map<string, number>>(new Map())
	.on(bidSet, (state, { clientId, amount }) => {
		const next = new Map(state);
		next.set(clientId, amount);
		return next;
	})
	.on(bidCleared, (state, clientId) => {
		if (!state.has(clientId)) return state;
		const next = new Map(state);
		next.delete(clientId);
		return next;
	})
	.reset([bidsReset, gameReset]);

type ReadingStage = Extract<Stage, { type: 'reading_question' }>;
type PressMsg = { type: 'press'; clientId: string; timestamp: number };

// при входе в reading_question — отметить клетку, сбросить буззер и ставки
sample({
	clock: stageTransitioned,
	filter: (stage) => stage.type === 'reading_question',
	fn: (stage) => (stage as ReadingStage).cursor,
	target: playedQuestionAdded,
});

sample({
	clock: stageTransitioned,
	filter: (stage) => stage.type === 'reading_question',
	target: buzzReset,
});

sample({
	clock: stageTransitioned,
	filter: (stage) => stage.type === 'reading_question',
	target: bidsReset,
});

// первый press во время collecting_answers становится buzz'ером
sample({
	clock: hostMessageReceived,
	source: $stage,
	filter: (stage, msg) => stage.type === 'collecting_answers' && msg.type === 'press',
	fn: (_stage, msg) => (msg as PressMsg).clientId,
	target: pressDuringCollecting,
});
