import { useUnit } from 'effector-react';
import { Button } from '@/components/ui/button';
import { $presses, $status } from '@/model/room';

export function HostView() {
	const [presses, status] = useUnit([$presses, $status]);

	// TODO: заменить placeholder-кнопки на реальные host-действия —
	// нужно добавить новые события в @/model/room и соответствующие message-типы
	// в apps/worker/src/index.ts (webSocketMessage).
	const notImplemented = (name: string) => () => console.log(`[host] ${name} — not implemented`);

	return (
		<section className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				панель ведущего — {status === 'open' ? 'подключено' : status === 'connecting' ? 'подключение…' : 'соединение закрыто'}
			</p>

			<div className="flex flex-wrap gap-2">
				<Button variant="default" onClick={notImplemented('start')} disabled={status !== 'open'}>
					Старт раунда
				</Button>
				<Button variant="secondary" onClick={notImplemented('stop')} disabled={status !== 'open'}>
					Стоп
				</Button>
				<Button variant="destructive" onClick={notImplemented('reset')} disabled={status !== 'open'}>
					Сбросить
				</Button>
			</div>

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
