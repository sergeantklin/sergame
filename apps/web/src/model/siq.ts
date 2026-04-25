import { createEffect, createEvent, createStore, sample } from 'effector';
import { parseSiq, type SiqPackage } from '@/lib/siq';

export const packSelected = createEvent<File>();
export const packReset = createEvent();

export const loadPackFx = createEffect(parseSiq);

export const $pack = createStore<SiqPackage | null>(null)
	.on(loadPackFx.doneData, (_, pack) => pack)
	.reset(packReset);

export const $packError = createStore<string | null>(null)
	.on(loadPackFx.failData, (_, err) => err.message)
	.reset([loadPackFx, packReset]);

sample({ clock: packSelected, target: loadPackFx });
