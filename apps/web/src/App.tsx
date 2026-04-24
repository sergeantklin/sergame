import { BrowserRouter, NavLink, Route, Routes } from 'react-router';
import { ClientView } from '@/views/ClientView';
import { HostView } from '@/views/HostView';

export function App() {
	return (
		<BrowserRouter>
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
		</BrowserRouter>
	);
}
