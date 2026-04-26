import { useUnit } from 'effector-react';
import { Button } from '@/components/ui/button';
import { $clientStatus, $connection, $myId, $presses, pressClicked } from '@/model/room';

function shortId(id: string | null): string {
	return id ? id.slice(0, 8) : '?';
}

export function ClientView() {
	const [conn, status, myId, presses, onPress] = useUnit([
		$connection,
		$clientStatus,
		$myId,
		$presses,
		pressClicked,
	]);

	if (conn === 'connecting') {
		return <p className="text-sm text-muted-foreground">подключение…</p>;
	}

	if (status === 'rejected') {
		return (
			<section className="flex flex-col gap-2">
				<p className="text-sm text-destructive">Хост отклонил подключение.</p>
				<p className="text-xs text-muted-foreground font-mono break-all">id: {myId}</p>
			</section>
		);
	}

	if (conn === 'closed') {
		return <p className="text-sm text-muted-foreground">соединение закрыто</p>;
	}

	if (status === 'pending') {
		return (
			<section className="flex flex-col gap-2">
				<p className="text-sm">Ожидание подтверждения хостом…</p>
				<p className="text-xs text-muted-foreground">
					вы — <span className="font-mono">{shortId(myId)}</span>
				</p>
			</section>
		);
	}

	return (
		<section className="flex flex-col gap-6">
			<p className="text-sm text-muted-foreground">
				вы — <span className="font-mono">{shortId(myId)}</span>
			</p>

			<Button size="lg" onClick={() => onPress()}>
				Нажать
			</Button>

			<ul className="flex flex-col divide-y divide-border">
				{presses.map((p, i) => (
					<li key={`${p.timestamp}-${i}`} className="py-1.5 font-mono text-sm">
						<span className="text-muted-foreground">{new Date(p.timestamp).toLocaleTimeString()}</span>
						{' — '}
						<span className={p.clientId === myId ? 'font-semibold' : ''}>{shortId(p.clientId)}</span> нажал
					</li>
				))}
			</ul>
		</section>
	);
}
