import type { RoundCursor, Stage } from '@/model/game';
import type { SiqPackage } from './siq';

export type NextOption = { label: string; stage: Stage };

/** Все валидные forward-переходы из текущего этапа. Пустой массив = тупик (например, конец игры). */
export function nextOptions(stage: Stage, pack: SiqPackage | null): NextOption[] {
	switch (stage.type) {
		case 'collecting_players':
			return [{ label: 'К подготовке пака', stage: { type: 'preparing_pack' } }];

		case 'preparing_pack':
			if (!pack || pack.rounds.length === 0) return [];
			return [{ label: 'Начать первый раунд', stage: { type: 'round_starting', roundIndex: 0 } }];

		case 'round_starting': {
			const cursor: RoundCursor = { roundIndex: stage.roundIndex, themeIndex: 0, questionIndex: 0 };
			return [{ label: 'Открыть первый вопрос', stage: { type: 'reading_question', cursor } }];
		}

		case 'reading_question':
			return [
				{
					label: 'Принимать ответы',
					stage: { type: 'collecting_answers', cursor: stage.cursor, phase: 'first' },
				},
			];

		case 'collecting_answers':
			if (stage.phase === 'first') {
				return [
					{
						label: 'Второй этап ответа',
						stage: { type: 'collecting_answers', cursor: stage.cursor, phase: 'second' },
					},
					{ label: 'Закончить ответ', stage: { type: 'between_questions', cursor: stage.cursor } },
				];
			}
			return [{ label: 'Закончить ответ', stage: { type: 'between_questions', cursor: stage.cursor } }];

		case 'between_questions': {
			if (!pack) return [];
			const advance = advanceCursor(stage.cursor, pack);
			if (advance.kind === 'next-question') {
				return [{ label: 'Следующий вопрос', stage: { type: 'reading_question', cursor: advance.cursor } }];
			}
			if (advance.kind === 'next-round') {
				return [{ label: 'Следующий раунд', stage: { type: 'round_starting', roundIndex: advance.roundIndex } }];
			}
			return [];
		}
	}
}

type CursorAdvance =
	| { kind: 'next-question'; cursor: RoundCursor }
	| { kind: 'next-round'; roundIndex: number }
	| { kind: 'end' };

function advanceCursor(cursor: RoundCursor, pack: SiqPackage): CursorAdvance {
	const round = pack.rounds[cursor.roundIndex];
	if (!round) return { kind: 'end' };
	const theme = round.themes[cursor.themeIndex];
	if (!theme) return { kind: 'end' };

	if (cursor.questionIndex + 1 < theme.questionCount) {
		return { kind: 'next-question', cursor: { ...cursor, questionIndex: cursor.questionIndex + 1 } };
	}
	if (cursor.themeIndex + 1 < round.themes.length) {
		return {
			kind: 'next-question',
			cursor: { roundIndex: cursor.roundIndex, themeIndex: cursor.themeIndex + 1, questionIndex: 0 },
		};
	}
	if (cursor.roundIndex + 1 < pack.rounds.length) {
		return { kind: 'next-round', roundIndex: cursor.roundIndex + 1 };
	}
	return { kind: 'end' };
}

/** Описание текущего этапа человекочитаемой строкой с контекстом. */
export function describeStage(stage: Stage, pack: SiqPackage | null): string {
	switch (stage.type) {
		case 'collecting_players':
			return 'Ожидание игроков';
		case 'preparing_pack':
			return pack ? `Пак: ${pack.name}` : 'Пак не загружен';
		case 'round_starting': {
			const round = pack?.rounds[stage.roundIndex];
			return `Раунд ${stage.roundIndex + 1}${round ? ` — ${round.name}` : ''}`;
		}
		case 'reading_question':
		case 'between_questions': {
			const round = pack?.rounds[stage.cursor.roundIndex];
			const theme = round?.themes[stage.cursor.themeIndex];
			const parts = [`Раунд ${stage.cursor.roundIndex + 1}`];
			if (round) parts.push(round.name);
			if (theme) parts.push(theme.name);
			parts.push(`вопрос ${stage.cursor.questionIndex + 1}`);
			return parts.join(' / ');
		}
		case 'collecting_answers': {
			const round = pack?.rounds[stage.cursor.roundIndex];
			const theme = round?.themes[stage.cursor.themeIndex];
			const phaseLabel = stage.phase === 'first' ? 'этап 1' : 'этап 2';
			const parts = [`Раунд ${stage.cursor.roundIndex + 1}`];
			if (round) parts.push(round.name);
			if (theme) parts.push(theme.name);
			parts.push(`вопрос ${stage.cursor.questionIndex + 1}`, phaseLabel);
			return parts.join(' / ');
		}
	}
}
