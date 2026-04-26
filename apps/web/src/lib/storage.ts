const KEY = 'sergame:clientId';

export function loadClientId(): string | null {
	try {
		return localStorage.getItem(KEY);
	} catch {
		return null;
	}
}

export function saveClientId(id: string): void {
	try {
		localStorage.setItem(KEY, id);
	} catch {
		// LS недоступен (приватный режим, превышение квоты) — терпим
	}
}

export function clearClientId(): void {
	try {
		localStorage.removeItem(KEY);
	} catch {
		// см. выше
	}
}
