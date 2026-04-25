import { createEvent, createStore, sample } from 'effector';

export type RoundCursor = {
	roundIndex: number;
	themeIndex: number;
	questionIndex: number;
};

export type Stage =
	| { type: 'collecting_players' }
	| { type: 'preparing_pack' }
	| { type: 'round_starting'; roundIndex: number }
	| { type: 'reading_question'; cursor: RoundCursor }
	| { type: 'collecting_answers'; cursor: RoundCursor; phase: 'first' | 'second' }
	| { type: 'between_questions'; cursor: RoundCursor };

export type StageType = Stage['type'];

export const STAGE_LABELS: Record<StageType, string> = {
	collecting_players: 'Сбор игроков',
	preparing_pack: 'Подготовка пака',
	round_starting: 'Начало раунда',
	reading_question: 'Чтение вопроса',
	collecting_answers: 'Приём ответов',
	between_questions: 'Пауза между вопросами',
};

const HISTORY_LIMIT = 100;
const INITIAL: Stage = { type: 'collecting_players' };

export const stageTransitioned = createEvent<Stage>();
export const stageUndone = createEvent();
export const gameReset = createEvent();

export const $stage = createStore<Stage>(INITIAL).reset(gameReset);
export const $history = createStore<Stage[]>([]).reset(gameReset);

const transitionCommitted = createEvent<{ prev: Stage; next: Stage }>();

sample({
	clock: stageTransitioned,
	source: $stage,
	fn: (prev, next) => ({ prev, next }),
	target: transitionCommitted,
});

$stage.on(transitionCommitted, (_, { next }) => next);
$history.on(transitionCommitted, (history, { prev }) => [...history, prev].slice(-HISTORY_LIMIT));

const undoCommitted = createEvent<Stage>();

sample({
	clock: stageUndone,
	source: $history,
	filter: (history) => history.length > 0,
	fn: (history) => history[history.length - 1]!,
	target: undoCommitted,
});

$stage.on(undoCommitted, (_, prev) => prev);
$history.on(undoCommitted, (history) => history.slice(0, -1));

export const $canUndo = $history.map((h) => h.length > 0);
