import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const excludedPublicPatterns = [
  /^assets\/videos\/.*\.(mp4|mov|webm)$/i,
  /^assets\/audio\/.*\.(wav|mp3|m4a)$/i,
];

function copyPublicWithoutMockMedia() {
  return {
    name: 'remove-mock-media-from-build',
    apply: 'build',
    closeBundle() {
      const publicRoot = 'public';
      const outputRoot = 'dist';
      if (!existsSync(publicRoot)) return;

      excludedPublicPatterns.forEach((pattern) => {
        removeMatchingFiles(publicRoot, outputRoot, pattern);
      });
    },
  };
}

function removeMatchingFiles(publicRoot, outputRoot, pattern, currentDir = publicRoot) {
  readdirSync(currentDir).forEach((entry) => {
    const sourcePath = join(currentDir, entry);
    const stats = statSync(sourcePath);
    if (stats.isDirectory()) {
      removeMatchingFiles(publicRoot, outputRoot, pattern, sourcePath);
      return;
    }

    const publicPath = relative(publicRoot, sourcePath).replaceAll('\\', '/');
    if (pattern.test(publicPath)) {
      rmSync(join(outputRoot, publicPath), { force: true });
    }
  });
}

export default defineConfig({
  plugins: [react(), copyPublicWithoutMockMedia()],
  server: {
    host: '0.0.0.0',
    port: 5173,
  },
  resolve: {
    alias: {
      '@zip.js/zip.js/lib/zip-no-worker.js': '@zip.js/zip.js',
    },
  },
  optimizeDeps: {
    exclude: ['cesium'],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          maps: ['maplibre-gl'],
          globe: ['react-globe.gl', 'three', 'cesium'],
        },
      },
    },
  },
});
