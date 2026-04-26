import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { describeStage, nextOptions } from '@/lib/game';
import type { SiqPackage, SiqQuestion } from '@/lib/siq';
import { $canUndo, $stage, gameReset, type RoundCursor, type Stage, stageTransitioned, stageUndone, STAGE_LABELS } from '@/model/game';
import { $hostConnection, $hostPresses, $players, approveRequested, rejectRequested } from '@/model/host';
import { $bids, $buzzedClient, $playedQuestions, bidSet, cursorKey } from '@/model/round';
import { $scores, scoreAdjusted } from '@/model/scoreboard';
import { $pack, $packError, loadPackFx, packReset, packSelected } from '@/model/siq';

function shortId(id: string): string {
	return id.slice(0, 8);
}

function getCursor(stage: Stage): RoundCursor | null {
	if (stage.type === 'reading_question' || stage.type === 'collecting_answers' || stage.type === 'between_questions') {
		return stage.cursor;
	}
	return null;
}

function getCurrentQuestion(stage: Stage, pack: SiqPackage | null): SiqQuestion | null {
	const cur = getCursor(stage);
	if (!cur || !pack) return null;
	return pack.rounds[cur.roundIndex]?.themes[cur.themeIndex]?.questions[cur.questionIndex] ?? null;
}

function getCurrentThemeName(stage: Stage, pack: SiqPackage | null): string | null {
	const cur = getCursor(stage);
	if (!cur || !pack) return null;
	return pack.rounds[cur.roundIndex]?.themes[cur.themeIndex]?.name ?? null;
}

function getActiveRoundIndex(stage: Stage): number | null {
	if (stage.type === 'round_starting') return stage.roundIndex;
	const cur = getCursor(stage);
	return cur?.roundIndex ?? null;
}

function canSelectQuestion(stage: Stage): boolean {
	return stage.type === 'round_starting' || stage.type === 'between_questions';
}

export function HostView() {
	const [pack, packError, loading, stage, canUndo, conn, players, presses, scores, bids, buzzedClient, playedQuestions] =
		useUnit([
			$pack,
			$packError,
			loadPackFx.pending,
			$stage,
			$canUndo,
			$hostConnection,
			$players,
			$hostPresses,
			$scores,
			$bids,
			$buzzedClient,
			$playedQuestions,
		]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const options = nextOptions(stage, pack);
	const description = describeStage(stage, pack);
	const currentQuestion = getCurrentQuestion(stage, pack);
	const currentThemeName = getCurrentThemeName(stage, pack);
	const activeRoundIndex = getActiveRoundIndex(stage);
	const activeRound = activeRoundIndex !== null ? (pack?.rounds[activeRoundIndex] ?? null) : null;
	const activeCursorKey = (() => {
		const cur = getCursor(stage);
		return cur ? cursorKey(cur) : null;
	})();

	const visiblePlayers = players.filter((p) => p.status !== 'rejected');
	const rejectedCount = players.filter((p) => p.status === 'rejected').length;
	const nominal = currentQuestion?.price ?? 0;
	const canPickQuestion = canSelectQuestion(stage);

	return (
		<section className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				панель ведущего — {conn === 'open' ? 'подключено' : conn === 'connecting' ? 'подключение…' : 'соединение закрыто'}
			</p>

			<div className="rounded-md border border-border p-4 flex flex-col gap-3">
				<div>
					<div className="text-xs uppercase tracking-wide text-muted-foreground">этап</div>
					<div className="font-semibold text-lg">{STAGE_LABELS[stage.type]}</div>
					<div className="text-sm text-muted-foreground">{description}</div>
				</div>

				<div className="flex flex-wrap gap-2">
					{options.length === 0 && <span className="text-sm text-muted-foreground">дальше идти некуда</span>}
					{options.map((opt, i) => (
						<Button key={i} variant={i === 0 ? 'default' : 'secondary'} onClick={() => stageTransitioned(opt.stage)}>
							{opt.label}
						</Button>
					))}
					<Button variant="ghost" onClick={() => stageUndone()} disabled={!canUndo}>
						Назад
					</Button>
					<Button variant="destructive" onClick={() => gameReset()}>
						Сброс игры
					</Button>
				</div>
			</div>

			<div className="rounded-md border border-border p-4 flex flex-col gap-2">
				<h2 className="text-xs uppercase tracking-wide text-muted-foreground">
					игроки {rejectedCount > 0 && <span className="text-muted-foreground/70">(скрыто отклонённых: {rejectedCount})</span>}
				</h2>
				{visiblePlayers.length === 0 ? (
					<p className="text-sm text-muted-foreground">пока никого нет</p>
				) : (
					<table className="text-sm w-full">
						<thead>
							<tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
								<th className="py-1 font-normal">id</th>
								<th className="py-1 font-normal">очки</th>
								<th className="py-1 font-normal">ставка / номинал</th>
								<th className="py-1 font-normal">нажал</th>
								<th className="py-1 font-normal text-right">действия</th>
							</tr>
						</thead>
						<tbody>
							{visiblePlayers.map((p) => {
								const isPending = p.status === 'pending';
								const isBuzzed = p.clientId === buzzedClient;
								const score = scores.get(p.clientId) ?? 0;
								const bidValue = bids.get(p.clientId) ?? nominal;
								return (
									<tr key={p.clientId} className={isBuzzed ? 'bg-accent' : ''}>
										<td className="py-1 font-mono">{shortId(p.clientId)}</td>
										<td className="py-1">{isPending ? '—' : score}</td>
										<td className="py-1">
											{isPending ? (
												'—'
											) : (
												<input
													type="number"
													className="w-20 bg-transparent border border-border rounded px-1 text-right"
													value={bidValue}
													onChange={(e) =>
														bidSet({ clientId: p.clientId, amount: Number(e.target.value) || 0 })
													}
												/>
											)}
										</td>
										<td className="py-1 text-center">{isBuzzed ? '●' : ''}</td>
										<td className="py-1 text-right">
											<div className="flex gap-1 justify-end">
												{isPending ? (
													<>
														<Button size="xs" variant="default" onClick={() => approveRequested(p.clientId)}>
															Принять
														</Button>
														<Button size="xs" variant="destructive" onClick={() => rejectRequested(p.clientId)}>
															Отклонить
														</Button>
													</>
												) : (
													<>
														<Button
															size="xs"
															variant="default"
															onClick={() => scoreAdjusted({ clientId: p.clientId, delta: bidValue })}
															disabled={!bidValue}
														>
															+
														</Button>
														<Button
															size="xs"
															variant="secondary"
															onClick={() => scoreAdjusted({ clientId: p.clientId, delta: -bidValue })}
															disabled={!bidValue}
														>
															−
														</Button>
														<Button size="xs" variant="ghost" onClick={() => rejectRequested(p.clientId)}>
															Кик
														</Button>
													</>
												)}
											</div>
										</td>
									</tr>
								);
							})}
						</tbody>
					</table>
				)}
			</div>

			{activeRound && (
				<div className="rounded-md border border-border p-4 flex flex-col gap-2">
					<h2 className="text-xs uppercase tracking-wide text-muted-foreground">табло — {activeRound.name}</h2>
					<div className="flex flex-col gap-1">
						{activeRound.themes.map((theme, themeIdx) => (
							<div key={themeIdx} className="flex items-center gap-2">
								<div className="w-32 text-sm font-medium truncate" title={theme.name}>
									{theme.name}
								</div>
								<div className="flex flex-1 gap-1">
									{theme.questions.map((q, qIdx) => {
										const cursor: RoundCursor = {
											roundIndex: activeRoundIndex!,
											themeIndex: themeIdx,
											questionIndex: qIdx,
										};
										const key = cursorKey(cursor);
										const played = playedQuestions.has(key);
										const isCurrent = key === activeCursorKey;
										return (
											<button
												key={qIdx}
												type="button"
												disabled={played || !canPickQuestion}
												onClick={() => stageTransitioned({ type: 'reading_question', cursor })}
												className={[
													'flex-1 py-2 rounded text-sm font-mono text-center border transition-colors',
													isCurrent
														? 'bg-primary text-primary-foreground border-primary'
														: played
															? 'bg-muted text-muted-foreground border-border line-through cursor-not-allowed'
															: 'border-border hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed',
												].join(' ')}
											>
												{q.price}
											</button>
										);
									})}
								</div>
							</div>
						))}
					</div>
				</div>
			)}

			{currentQuestion && (
				<div className="rounded-md border border-border p-4 flex flex-col gap-2">
					<div className="flex items-baseline justify-between">
						<h2 className="text-xs uppercase tracking-wide text-muted-foreground">текущий вопрос</h2>
						<span className="text-sm font-mono">{currentQuestion.price}</span>
					</div>
					{currentThemeName && <div className="text-sm font-medium">{currentThemeName}</div>}
					<div>
						<div className="text-xs text-muted-foreground">вопрос</div>
						<div className="text-sm whitespace-pre-wrap">
							{currentQuestion.text || <em className="text-muted-foreground">пусто</em>}
						</div>
					</div>
					<div>
						<div className="text-xs text-muted-foreground">ответ</div>
						<div className="text-sm font-medium">
							{currentQuestion.answer || <em className="text-muted-foreground">пусто</em>}
						</div>
					</div>
					{currentQuestion.comment && (
						<div>
							<div className="text-xs text-muted-foreground">комментарий</div>
							<div className="text-sm italic">{currentQuestion.comment}</div>
						</div>
					)}
				</div>
			)}

			<div className="flex flex-col gap-2">
				<div className="flex flex-wrap gap-2 items-center">
					<input
						ref={fileInputRef}
						type="file"
						accept=".siq,application/zip"
						className="hidden"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) packSelected(file);
							e.target.value = '';
						}}
					/>
					<Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
						{loading ? 'Загрузка…' : pack ? 'Загрузить другой .siq' : 'Загрузить .siq'}
					</Button>
					{pack && (
						<Button variant="ghost" onClick={() => packReset()}>
							Закрыть пак
						</Button>
					)}
				</div>
				{packError && <p className="text-sm text-destructive">{packError}</p>}
			</div>

			{pack && (
				<div className="rounded-md border border-border p-4 flex flex-col gap-2">
					<div>
						<h2 className="font-semibold">{pack.name}</h2>
						{pack.author && <p className="text-sm text-muted-foreground">автор: {pack.author}</p>}
					</div>
					<p className="text-sm text-muted-foreground">
						раундов: {pack.rounds.length}, медиа-файлов: {pack.mediaCount}
					</p>
					<ul className="text-sm space-y-1">
						{pack.rounds.map((round, i) => {
							const questionsCount = round.themes.reduce((acc, t) => acc + t.questions.length, 0);
							return (
								<li key={i}>
									<span className="font-medium">{round.name}</span>
									<span className="text-muted-foreground">
										{' — '}
										{round.themes.length} тем, {questionsCount} вопросов
									</span>
								</li>
							);
						})}
					</ul>
				</div>
			)}

			<div>
				<h2 className="text-sm font-semibold mb-2 text-muted-foreground uppercase tracking-wide">нажатия</h2>
				<ul className="flex flex-col divide-y divide-border">
					{presses.map((p, i) => (
						<li key={`${p.timestamp}-${i}`} className="py-1.5 font-mono text-sm">
							<span className="text-muted-foreground">{new Date(p.timestamp).toLocaleTimeString()}</span>
							{' — '}
							<span>{shortId(p.clientId)}</span>
						</li>
					))}
					{presses.length === 0 && <li className="py-1.5 text-sm text-muted-foreground">ещё никто не нажал</li>}
				</ul>
			</div>
		</section>
	);
}
