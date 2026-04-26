import { useEffect } from 'react';
import { BrowserRouter, NavLink, Route, Routes, useLocation } from 'react-router';
import { openClientWs } from '@/lib/client-ws';
import { openHostWs } from '@/lib/host-ws';
import { ClientView } from '@/views/ClientView';
import { HostView } from '@/views/HostView';

function Layout() {
	const location = useLocation();

	useEffect(() => {
		const disconnect = location.pathname === '/host' ? openHostWs() : openClientWs();
		return disconnect;
	}, [location.pathname]);

	return (
		<main className="mx-auto max-w-xl px-4 py-8 flex flex-col gap-6">
			<header className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">sergame</h1>
				<nav className="flex gap-3 text-sm">
					<NavLink
						to="/"
						end
						className={({ isActive }) =>
							isActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
						}
					>
						client
					</NavLink>
					<NavLink
						to="/host"
						className={({ isActive }) =>
							isActive ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground'
						}
					>
						host
					</NavLink>
				</nav>
			</header>

			<Routes>
				<Route path="/" element={<ClientView />} />
				<Route path="/host" element={<HostView />} />
			</Routes>
		</main>
	);
}

export function App() {
	return (
		<BrowserRouter>
			<Layout />
		</BrowserRouter>
	);
}
