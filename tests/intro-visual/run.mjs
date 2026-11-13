import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const playwrightPath = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(playwrightPath);
const runName = process.argv[2] || 'before';
const outputRoot = path.resolve('tests/intro-visual/artifacts', runName);
const url = process.env.INTRO_URL || 'https://127.0.0.1:5177/intro-preview';
const captures = [
  [700, 'welcome-start'],
  [3500, 'welcome-pov'],
  [7100, 'welcome-watch'],
  [8000, 'watch'],
  [11800, 'watch-live'],
  [12900, 'live'],
  [17700, 'live-equipment'],
  [19100, 'equipment'],
  [22200, 'equipment-globe'],
  [23600, 'globe-start'],
  [26400, 'globe'],
  [29500, 'globe-startlive'],
  [31000, 'startlive'],
  [34400, 'startlive-enter'],
  [35900, 'enter'],
];

await mkdir(outputRoot, { recursive: true });
const browser = await chromium.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: process.env.INTRO_HEADED !== '1',
  args: ['--enable-webgl', '--use-gl=angle', '--use-angle=swiftshader'],
});

for (const [name, viewport] of [
  ['mobile', { width: 390, height: 844 }],
  ['desktop', { width: 1440, height: 900 }],
].filter(([name]) => !process.env.INTRO_MOBILE_ONLY || name === 'mobile')) {
  const output = path.join(outputRoot, name);
  await mkdir(output, { recursive: true });
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, ignoreHTTPSErrors: true, recordVideo: process.env.INTRO_QUICK || process.env.INTRO_GLOBE_ONLY || process.env.INTRO_PHASE_ONLY || process.env.INTRO_TRANSITION_ONLY || process.env.INTRO_EXPORT_GLOBE ? undefined : { dir: output, size: viewport } });
  const page = await context.newPage();
  const cdp = process.env.INTRO_CDP ? await context.newCDPSession(page) : null;
  const errors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(`console: ${message.text()}`);
      console.log(name, errors.at(-1));
    }
  });
  page.on('pageerror', (error) => { errors.push(`page: ${error.message}`); console.log(name, errors.at(-1)); });
  page.on('requestfailed', (request) => { errors.push(`request: ${request.url()} ${request.failure()?.errorText}`); console.log(name, errors.at(-1)); });
  const previewPhase = process.env.INTRO_PREVIEW_PHASE;
  await page.goto(previewPhase ? `${url}?phase=${previewPhase}` : process.env.INTRO_GLOBE_ONLY || process.env.INTRO_EXPORT_GLOBE ? `${url}?phase=globe` : process.env.INTRO_TRANSITION_ONLY ? `${url}?phase=equipment&auto=1` : url, { waitUntil: 'domcontentloaded' });
  await page.locator('.introv2-root').waitFor({ timeout: 30000 });
  const startedAt = Date.now();
  const observations = [];
  const selectedCaptures = process.env.INTRO_VIDEO_ONLY || process.env.INTRO_PHASE_ONLY || process.env.INTRO_TRANSITION_ONLY || process.env.INTRO_EXPORT_GLOBE ? [] : process.env.INTRO_GLOBE_ONLY
    ? [[1000, 'globe-earth'], [3500, 'globe-live-card'], [6500, 'globe-3d']]
    : process.env.INTRO_QUICK ? captures.slice(0, 4) : captures;
  for (const [at, label] of selectedCaptures) {
    await page.waitForTimeout(Math.max(0, startedAt + at - Date.now()));
    try {
      if (cdp) {
        const { data } = await Promise.race([
          cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }),
          new Promise((_, reject) => setTimeout(() => reject(new Error('CDP screenshot timeout')), 8000)),
        ]);
        await writeFile(path.join(output, `${label}.png`), Buffer.from(data, 'base64'));
      } else {
        await page.screenshot({ path: path.join(output, `${label}.png`), timeout: 8000 });
      }
    } catch (error) {
      errors.push(`screenshot ${label}: ${error.message}`);
    }
    observations.push({
      label,
      at: Date.now() - startedAt,
      state: await Promise.race([page.evaluate(() => {
        const video = document.querySelector('.introv2-pov__video');
        const canvas = document.querySelector('.introv2-globe canvas');
        const globe = document.querySelector('.introv2-globe');
        const layer = document.querySelector('.introv2-stage');
        return {
          phase: document.querySelector('.introv2-root')?.dataset.phase,
          video: video && { readyState: video.readyState, currentTime: video.currentTime, width: video.videoWidth, height: video.videoHeight },
          globe: globe && { opacity: getComputedStyle(globe).opacity, canvas: Boolean(canvas), snapshot: Boolean(document.querySelector('.introv2-globe__snapshot')), canvasWidth: canvas?.width, canvasHeight: canvas?.height },
          livePoint: Boolean(document.querySelector('.introv2-globe__marker')),
          selectedLive: Boolean(document.querySelector('.introv2-globe__live-card')),
          stage: layer && { width: layer.clientWidth, height: layer.clientHeight },
        };
      }).catch((error) => ({ error: error.message })), new Promise((resolve) => setTimeout(() => resolve({ timeout: true }), 8000))]),
    });
  }
  if (process.env.INTRO_EXPORT_GLOBE) {
    const source = await page.locator('.introv2-globe__snapshot').getAttribute('src', { timeout: 30000 });
    await writeFile(path.resolve('public/intro/earth-preview.png'), Buffer.from(source.split(',')[1], 'base64'));
  }
  if (process.env.INTRO_VIDEO_ONLY || process.env.INTRO_PHASE_ONLY || process.env.INTRO_TRANSITION_ONLY) {
    try {
      const targetPhase = 'enter';
      await page.waitForFunction((target) => document.querySelector('.introv2-root')?.dataset.phase === target, targetPhase, { timeout: process.env.INTRO_TRANSITION_ONLY ? 60000 : 90000, polling: 500 });
      await page.waitForTimeout(2200);
    } catch (error) {
      errors.push(`completion: ${error.message}`);
    }
    observations.push({ label: 'end', state: await page.evaluate(() => ({
      phase: document.querySelector('.introv2-root')?.dataset.phase,
      videoTime: document.querySelector('.introv2-pov__video')?.currentTime,
      globeCanvas: Boolean(document.querySelector('.introv2-globe canvas')),
      globeSnapshot: Boolean(document.querySelector('.introv2-globe__snapshot')),
    })) });
  }
  await writeFile(path.join(output, 'report.json'), JSON.stringify({ url, viewport, errors, observations }, null, 2));
  const videoPath = page.video() ? await page.video().path() : null;
  await context.close();
  if (videoPath) await rename(videoPath, path.join(output, `intro-${name}.webm`));
  console.log(`${name}: ${videoPath}; ${errors.length} errors`);
}
await browser.close();
