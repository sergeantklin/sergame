import JSZip from 'jszip';

export type SiqTheme = { name: string; questionCount: number };
export type SiqRound = { name: string; themes: SiqTheme[] };
export type SiqPackage = {
	name: string;
	author?: string;
	rounds: SiqRound[];
	mediaCount: number;
};

const MEDIA_PREFIX = /^(Audio|Images|Video)\//i;

export async function parseSiq(file: File): Promise<SiqPackage> {
	const zip = await JSZip.loadAsync(file);

	const contentEntry = zip.file('content.xml');
	if (!contentEntry) {
		throw new Error('content.xml не найден — это не похоже на .siq');
	}

	const xml = await contentEntry.async('text');
	const doc = new DOMParser().parseFromString(xml, 'application/xml');
	if (doc.querySelector('parsererror')) {
		throw new Error('не удалось разобрать content.xml');
	}

	const packageEl = doc.documentElement;
	const name = packageEl.getAttribute('name') ?? 'без названия';
	const author = doc.querySelector('info > authors > author')?.textContent?.trim() || undefined;

	const rounds: SiqRound[] = Array.from(doc.querySelectorAll('rounds > round')).map((roundEl) => ({
		name: roundEl.getAttribute('name') ?? 'раунд',
		themes: Array.from(roundEl.querySelectorAll('themes > theme')).map((themeEl) => ({
			name: themeEl.getAttribute('name') ?? 'тема',
			questionCount: themeEl.querySelectorAll('questions > question').length,
		})),
	}));

	let mediaCount = 0;
	zip.forEach((path, entry) => {
		if (!entry.dir && MEDIA_PREFIX.test(path)) mediaCount++;
	});

	return { name, author, rounds, mediaCount };
}
