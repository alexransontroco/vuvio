import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.{js,jsx,ts,tsx}', 'src/**/*.spec.{js,jsx,ts,tsx}'],
    environment: 'jsdom',
    environmentOptions: { jsdom: { url: 'https://vuvio.app' } },
    clearMocks: true,
    restoreMocks: true,
  },
});
