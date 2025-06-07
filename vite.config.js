import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    base: '/card-game-pdf-transformer/', // GitHub Pages uses this path
    build: {
        outDir: 'dist',
        assetsDir: 'assets'
    }
});
