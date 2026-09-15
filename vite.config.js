import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync, copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const isDiagBuild = process.env.VITE_DIAG_BUILD === '1';
const disableCopyPublic = process.env.VITE_DISABLE_COPY_PUBLIC === '1';

const excludedPublicPatterns = [
  /\.DS_Store$/i,
  /^splash-test\.html$/i,
  /^assets\/audio\//i,
  /^assets\/mockups\//i,           // live-mockup loops — served from Firebase Storage in prod
  /^assets\/videos\/mockups\//i,   // full-length demo clips — served from Firebase Storage in prod
  /^assets\/ChatGPT Image /i,
  /^assets\/videos\/ChatGPT Image /i,
  /^assets\/videos\/mockups\/Serrasolses_Brothers__Rio_Claro_100_GoPro_2022__HDs84SRy7i0__clip\.mp4$/i,
  /^assets\/videos\/JVKE - GOLDEN HOUR at golden hour in DUBAI .+\.mp4$/i,
  /^assets\/videos\/POV You're A Pro Drummer At A MASSIVE Festival - Drum Beats Online \(720p\)\.mp4$/i,
  /^assets\/videos\/drummerpovlivemetal\.mov$/i,
  /^assets\/videos\/landing-loop-mobile\.mp4$/i,
  /^assets\/videos\/landing-verti\.mp4$/i,
  /^assets\/videos\/povguitarsololive\.mp4$/i,
  /^assets\/videos\/povpianodubai\.mov$/i,
  /^assets\/videos\/.*\.(mov|webm)$/i,
  /^assets\/audio\/.*\.(wav|mp3|m4a)$/i,
  // pexels demo clips + covers — served from Firebase Storage in prod
  /^assets\/videos\/biking\.mp4$/i,
  /^assets\/videos\/biking-cover\.jpg$/i,
  /^assets\/videos\/chef-paris\.mp4$/i,
  /^assets\/videos\/11963745-uhd_2160_3840_60fps/i,
  /^assets\/videos\/12130364_2160_3840_30fps/i,
  /^assets\/videos\/12339859_2160_3840_60fps/i,
  /^assets\/videos\/15794531_1440_2560_24fps/i,
  /^assets\/videos\/16232606_2160_3840_30fps/i,
  /^assets\/videos\/16317498_2160_3840_30fps/i,
  /^assets\/videos\/16352747_1080_1920_30fps/i,
  /^assets\/videos\/20667540-uhd_2160_3840_60fps/i,
  /^assets\/videos\/8678453-hd_1080_1920_30fps/i,
  // unused landing videos
  /^assets\/videos\/landing-intro\.mp4$/i,
  /^assets\/videos\/looped-4x-0\.4s-crossfade\.mp4$/i,
  // stray demo clip at public/assets root
  /^assets\/firefighter-goproraw\.mp4$/i,
];

function copyProductionPublicAssets() {
  return {
    name: 'copy-production-public-assets',
    apply: 'build',
    writeBundle() {
      if (disableCopyPublic) return;
      const publicRoot = 'public';
      const outputRoot = 'dist';
      if (!existsSync(publicRoot)) return;
      console.time('copy-production-public-assets');
      try {
        copyAllowedPublicFiles(publicRoot, outputRoot);
      } finally {
        console.timeEnd('copy-production-public-assets');
      }
    },
  };
}

function copyAllowedPublicFiles(publicRoot, outputRoot, currentDir = publicRoot) {
  readdirSync(currentDir).forEach((entry) => {
    const sourcePath = join(currentDir, entry);
    const stats = statSync(sourcePath);
    if (stats.isDirectory()) {
      copyAllowedPublicFiles(publicRoot, outputRoot, sourcePath);
      return;
    }

    const publicPath = relative(publicRoot, sourcePath).replaceAll('\\', '/');
    if (excludedPublicPatterns.some((pattern) => pattern.test(publicPath))) return;

    const destinationPath = join(outputRoot, publicPath);
    mkdirSync(dirname(destinationPath), { recursive: true });
    copyFileSync(sourcePath, destinationPath);
  });
}

export default defineConfig(({ command }) => ({
  publicDir: command === 'serve' ? 'public' : false,
  plugins: [react(), copyProductionPublicAssets()],
  esbuild: command === 'build' && !isDiagBuild ? { drop: ['console', 'debugger'] } : undefined,
  server: {
    host: '0.0.0.0',
    port: 5173,
    https: existsSync('certs/cert.pem') ? {
      key: readFileSync('certs/key.pem'),
      cert: readFileSync('certs/cert.pem'),
    } : undefined,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5001',
        changeOrigin: true,
        rewrite: (path) => `/vuvio-bf328/europe-west1${path}`,
      },
    },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      '@zip.js/zip.js/lib/zip-no-worker.js': '@zip.js/zip.js',
    },
  },
  optimizeDeps: {
    exclude: ['cesium'],
  },
  build: {
    minify: isDiagBuild ? false : 'esbuild',
    sourcemap: isDiagBuild ? false : undefined,
    reportCompressedSize: isDiagBuild ? false : undefined,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          icons: ['lucide-react'],
          maps: ['maplibre-gl'],
        },
      },
    },
  },
}));
