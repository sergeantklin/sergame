import { useUnit } from 'effector-react';
import { Button } from '@/components/ui/button';
import { $myId, $presses, $status, pressClicked } from '@/model/room';

export function ClientView() {
	const [myId, presses, status, onPress] = useUnit([$myId, $presses, $status, pressClicked]);

	return (
		<section className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				{status === 'open' && myId ? `вы — ${myId}` : status === 'connecting' ? 'подключение…' : 'соединение закрыто'}
			</p>

			<Button size="lg" onClick={() => onPress()} disabled={status !== 'open'}>
				Нажать
			</Button>

			<ul className="flex flex-col divide-y divide-border">
				{presses.map((p, i) => (
					<li key={`${p.timestamp}-${i}`} className="py-1.5 font-mono text-sm">
						<span className="text-muted-foreground">{new Date(p.timestamp).toLocaleTimeString()}</span>
						{' — '}
						<span className={p.clientId === myId ? 'font-semibold' : ''}>{p.clientId}</span> нажал
					</li>
				))}
			</ul>
		</section>
	);
}
