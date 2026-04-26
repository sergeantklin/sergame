import JSZip from 'jszip';

export type SiqQuestion = {
	price: number;
	text: string;
	answer: string;
	comment?: string;
};

export type SiqTheme = { name: string; questions: SiqQuestion[] };
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
			questions: Array.from(themeEl.querySelectorAll('questions > question')).map((qEl) => ({
				price: Number(qEl.getAttribute('price') ?? 0),
				text: extractScenarioText(qEl),
				answer: qEl.querySelector('right > answer')?.textContent?.trim() ?? '',
				comment: qEl.querySelector('info > comments')?.textContent?.trim() || undefined,
			})),
		})),
	}));

	let mediaCount = 0;
	zip.forEach((path, entry) => {
		if (!entry.dir && MEDIA_PREFIX.test(path)) mediaCount++;
	});

	return { name, author, rounds, mediaCount };
}

function extractScenarioText(qEl: Element): string {
	const atoms = qEl.querySelectorAll('scenario > atom');
	const parts: string[] = [];
	atoms.forEach((a) => {
		const type = a.getAttribute('type');
		if (!type || type === 'text' || type === 'say') {
			const t = a.textContent?.trim();
			if (t) parts.push(t);
		}
	});
	return parts.join(' ');
}
