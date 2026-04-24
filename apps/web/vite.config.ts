import path from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createLogger, defineConfig } from 'vite';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = createLogger();
const originalWarn = logger.warn.bind(logger);
logger.warn = (msg, options) => {
	const err = options?.error as NodeJS.ErrnoException | undefined;
	if (err && (err.code === 'EPIPE' || err.code === 'ECONNRESET')) return;
	originalWarn(msg, options);
};

export default defineConfig({
	customLogger: logger,
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			'@': path.resolve(__dirname, './src'),
		},
	},
	server: {
		proxy: {
			'/ws': {
				target: 'ws://localhost:8787',
				ws: true,
				changeOrigin: true,
			},
		},
	},
});
