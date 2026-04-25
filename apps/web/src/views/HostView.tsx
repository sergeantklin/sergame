import { useUnit } from 'effector-react';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { describeStage, nextOptions } from '@/lib/game';
import { $canUndo, $stage, gameReset, stageTransitioned, stageUndone, STAGE_LABELS } from '@/model/game';
import { $presses, $status } from '@/model/room';
import { $pack, $packError, loadPackFx, packReset, packSelected } from '@/model/siq';

export function HostView() {
	const [presses, status, pack, packError, loading, stage, canUndo] = useUnit([
		$presses,
		$status,
		$pack,
		$packError,
		loadPackFx.pending,
		$stage,
		$canUndo,
	]);
	const fileInputRef = useRef<HTMLInputElement>(null);

	const options = nextOptions(stage, pack);
	const description = describeStage(stage, pack);

	return (
		<section className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				панель ведущего — {status === 'open' ? 'подключено' : status === 'connecting' ? 'подключение…' : 'соединение закрыто'}
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
						<Button
							key={i}
							variant={i === 0 ? 'default' : 'secondary'}
							onClick={() => stageTransitioned(opt.stage)}
						>
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
							const questions = round.themes.reduce((acc, t) => acc + t.questionCount, 0);
							return (
								<li key={i}>
									<span className="font-medium">{round.name}</span>
									<span className="text-muted-foreground">
										{' — '}
										{round.themes.length} тем, {questions} вопросов
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
							<span>{p.clientId}</span>
						</li>
					))}
					{presses.length === 0 && <li className="py-1.5 text-sm text-muted-foreground">ещё никто не нажал</li>}
				</ul>
			</div>
		</section>
	);
}
