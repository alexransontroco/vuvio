#!/usr/bin/env node
/**
 * Upload mock/demo videos to Firebase Storage once.
 *
 * Skips files that already exist with identical size.
 * After uploading, prints the public download URLs — copy them into
 * src/data/mockVideoUrls.js to switch the app away from local files.
 *
 * Usage:
 *   node scripts/upload-mock-videos.js
 *
 * Credentials (one of):
 *   - GOOGLE_APPLICATION_CREDENTIALS env var pointing to a service-account JSON
 *   - serviceAccountKey.json in the project root
 *   - Application Default Credentials (gcloud auth application-default login)
 *
 * Firebase project: vuvio-bf328
 * Storage bucket:   vuvio-bf328.firebasestorage.app
 */

import { createReadStream, existsSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

// ── Resolve firebase-admin (prefer functions/ package, fall back to global) ───
let admin;
try {
  // Use the already-installed firebase-admin from functions/
  const { createRequire } = await import('node:module');
  const require = createRequire(join(ROOT, 'functions', 'package.json'));
  admin = require('firebase-admin');
} catch {
  try {
    const mod = await import('firebase-admin');
    admin = mod.default ?? mod;
  } catch {
    console.error(
      'firebase-admin not found.\n' +
      'Run: cd functions && npm install  (it is already in functions/package.json)\n' +
      'Or:  npm install -g firebase-admin',
    );
    process.exit(1);
  }
}

// ── Initialise Admin SDK ───────────────────────────────────────────────────────
const BUCKET = 'vuvio-bf328.firebasestorage.app';

const credPath = join(ROOT, 'serviceAccountKey.json');
if (!admin.apps.length) {
  if (existsSync(credPath)) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const serviceAccount = require(credPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      storageBucket: BUCKET,
    });
    console.log('Using serviceAccountKey.json');
  } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    admin.initializeApp({ storageBucket: BUCKET });
    console.log('Using GOOGLE_APPLICATION_CREDENTIALS');
  } else {
    admin.initializeApp({ storageBucket: BUCKET });
    console.log('Using Application Default Credentials');
  }
}

const bucket = admin.storage().bucket();

// ── Files to upload ────────────────────────────────────────────────────────────
// Maps local public/ path → Storage destination path
const FILES = [
  // live-mockup loops (mp4 + thumbnail jpg)
  ...Array.from({ length: 16 }, (_, i) => i + 1).flatMap((n) => [
    {
      local: `public/assets/mockups/live-mockups/mockup_${n}.mp4`,
      dest:  `mock-videos/live-mockups/mockup_${n}.mp4`,
      mime:  'video/mp4',
    },
    {
      local: `public/assets/mockups/live-mockups/mockup_${n}-thumb.jpg`,
      dest:  `mock-videos/live-mockups/mockup_${n}-thumb.jpg`,
      mime:  'image/jpeg',
    },
  ]),
  {
    local: 'public/assets/mockups/live-mockups/SAFA_Brian__The_Best_Road_to_Ride_Near_L.A.__ho_lrPU7dPU.mp4',
    dest:  'mock-videos/live-mockups/SAFA_Brian__The_Best_Road_to_Ride_Near_L.A.__ho_lrPU7dPU.mp4',
    mime:  'video/mp4',
  },
  {
    local: 'public/assets/mockups/live-mockups/SAFA_Brian__The_Best_Road_to_Ride_Near_L.A.__ho_lrPU7dPU.jpg',
    dest:  'mock-videos/live-mockups/SAFA_Brian__The_Best_Road_to_Ride_Near_L.A.__ho_lrPU7dPU.jpg',
    mime:  'image/jpeg',
  },
  {
    local: 'public/assets/mockups/live-mockups/Fallow__POV_-_Head_Chef_at_a_Top_London_Restaurant__Ipe9xJCfuTM__clip.mp4',
    dest:  'mock-videos/live-mockups/Fallow__POV_-_Head_Chef_at_a_Top_London_Restaurant__Ipe9xJCfuTM__clip.mp4',
    mime:  'video/mp4',
  },
  {
    local: 'public/assets/mockups/live-mockups/Fallow__POV_-_Head_Chef_at_a_Top_London_Restaurant__Ipe9xJCfuTM__clip.jpg',
    dest:  'mock-videos/live-mockups/Fallow__POV_-_Head_Chef_at_a_Top_London_Restaurant__Ipe9xJCfuTM__clip.jpg',
    mime:  'image/jpeg',
  },
  {
    local: 'public/assets/mockups/live-mockups/GoPro__GoPro_Awards_Worlds_Highest_Rock_Climbing_Wall__Ssjp6Wiu3TA.mp4',
    dest:  'mock-videos/live-mockups/GoPro__GoPro_Awards_Worlds_Highest_Rock_Climbing_Wall__Ssjp6Wiu3TA.mp4',
    mime:  'video/mp4',
  },
  {
    local: 'public/assets/mockups/live-mockups/GoPro__GoPro_Awards_Worlds_Highest_Rock_Climbing_Wall__Ssjp6Wiu3TA.jpg',
    dest:  'mock-videos/live-mockups/GoPro__GoPro_Awards_Worlds_Highest_Rock_Climbing_Wall__Ssjp6Wiu3TA.jpg',
    mime:  'image/jpeg',
  },

  // full-length demo clips
  { local: 'public/assets/videos/biking.mp4',                        dest: 'mock-videos/videos/biking.mp4',                        mime: 'video/mp4' },
  { local: 'public/assets/videos/biking-cover.jpg',                  dest: 'mock-videos/videos/biking-cover.jpg',                  mime: 'image/jpeg' },
  { local: 'public/assets/videos/chef-paris.mp4',                    dest: 'mock-videos/videos/chef-paris.mp4',                    mime: 'video/mp4' },
  { local: 'public/assets/videos/11963745-uhd_2160_3840_60fps.mp4',  dest: 'mock-videos/videos/11963745-uhd_2160_3840_60fps.mp4',  mime: 'video/mp4' },
  { local: 'public/assets/videos/11963745-uhd_2160_3840_60fps-cover.jpg', dest: 'mock-videos/videos/11963745-uhd_2160_3840_60fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/12130364_2160_3840_30fps.mp4',      dest: 'mock-videos/videos/12130364_2160_3840_30fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/12130364_2160_3840_30fps-cover.jpg', dest: 'mock-videos/videos/12130364_2160_3840_30fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/12339859_2160_3840_60fps.mp4',      dest: 'mock-videos/videos/12339859_2160_3840_60fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/12339859_2160_3840_60fps-cover.jpg', dest: 'mock-videos/videos/12339859_2160_3840_60fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/15794531_1440_2560_24fps.mp4',      dest: 'mock-videos/videos/15794531_1440_2560_24fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/15794531_1440_2560_24fps-cover.jpg', dest: 'mock-videos/videos/15794531_1440_2560_24fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/16232606_2160_3840_30fps.mp4',      dest: 'mock-videos/videos/16232606_2160_3840_30fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/16232606_2160_3840_30fps-cover.jpg', dest: 'mock-videos/videos/16232606_2160_3840_30fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/16317498_2160_3840_30fps.mp4',      dest: 'mock-videos/videos/16317498_2160_3840_30fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/16317498_2160_3840_30fps-cover.jpg', dest: 'mock-videos/videos/16317498_2160_3840_30fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/16352747_1080_1920_30fps.mp4',      dest: 'mock-videos/videos/16352747_1080_1920_30fps.mp4',      mime: 'video/mp4' },
  { local: 'public/assets/videos/16352747_1080_1920_30fps-cover.jpg', dest: 'mock-videos/videos/16352747_1080_1920_30fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/20667540-uhd_2160_3840_60fps.mp4',  dest: 'mock-videos/videos/20667540-uhd_2160_3840_60fps.mp4',  mime: 'video/mp4' },
  { local: 'public/assets/videos/20667540-uhd_2160_3840_60fps-cover.jpg', dest: 'mock-videos/videos/20667540-uhd_2160_3840_60fps-cover.jpg', mime: 'image/jpeg' },
  { local: 'public/assets/videos/8678453-hd_1080_1920_30fps.mp4',    dest: 'mock-videos/videos/8678453-hd_1080_1920_30fps.mp4',    mime: 'video/mp4' },
  { local: 'public/assets/videos/8678453-hd_1080_1920_30fps-cover.jpg', dest: 'mock-videos/videos/8678453-hd_1080_1920_30fps-cover.jpg', mime: 'image/jpeg' },
  {
    local: 'public/assets/videos/mockups/JoHannes_Wingsuit__My_Most_Brutal_Wingsuit_Flight_Ever_Taschhorn_4491m_Swiss__QKMkhCsgsas__clip.mp4',
    dest:  'mock-videos/videos/mockups/JoHannes_Wingsuit__My_Most_Brutal_Wingsuit_Flight_Ever_Taschhorn_4491m_Swiss__QKMkhCsgsas__clip.mp4',
    mime:  'video/mp4',
  },
  {
    local: 'public/assets/videos/mockups/Serrasolses_Brothers__Rio_Claro_100%_GoPro_2022__HDs84SRy7i0__clip.mp4',
    dest:  'mock-videos/videos/mockups/Serrasolses_Brothers__Rio_Claro_100%_GoPro_2022__HDs84SRy7i0__clip.mp4',
    mime:  'video/mp4',
  },
  // ── music POV streams ──────────────────────────────────────────────────────
  { local: 'public/assets/videos/povguitarsololive.mp4', dest: 'mock-videos/videos/guitar.mp4', mime: 'video/mp4' },
  {
    local: "public/assets/videos/POV You're A Pro Drummer At A MASSIVE Festival - Drum Beats Online (720p).mp4",
    dest:  'mock-videos/videos/drummer.mp4',
    mime:  'video/mp4',
  },
  {
    local: 'public/assets/videos/JVKE - GOLDEN HOUR at golden hour in DUBAI 🌇 (POV Piano Arrangement) - Costantino Carrara Music (720p).mp4',
    dest:  'mock-videos/videos/piano.mp4',
    mime:  'video/mp4',
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function publicUrl(destPath) {
  const encoded = encodeURIComponent(destPath);
  return `https://firebasestorage.googleapis.com/v0/b/${BUCKET}/o/${encoded}?alt=media`;
}

async function getRemoteSize(destPath) {
  try {
    const [meta] = await bucket.file(destPath).getMetadata();
    return Number(meta.size ?? 0);
  } catch {
    return null; // file doesn't exist
  }
}

async function uploadFile({ local, dest, mime }) {
  const localPath = join(ROOT, local);
  if (!existsSync(localPath)) {
    console.warn(`  SKIP (missing locally): ${local}`);
    return null;
  }

  const localSize = statSync(localPath).size;
  const remoteSize = await getRemoteSize(dest);

  if (remoteSize !== null && remoteSize === localSize) {
    console.log(`  SKIP (identical, ${(localSize / 1024 / 1024).toFixed(1)} MB): ${dest}`);
    return publicUrl(dest);
  }

  const action = remoteSize !== null ? 'UPDATE' : 'UPLOAD';
  const sizeMb = (localSize / 1024 / 1024).toFixed(1);
  process.stdout.write(`  ${action} (${sizeMb} MB): ${dest} ... `);

  await bucket.upload(localPath, {
    destination: dest,
    metadata: { contentType: mime },
    // Make the file publicly readable
    predefinedAcl: 'publicRead',
  });

  process.stdout.write('done\n');
  return publicUrl(dest);
}

// ── Main ───────────────────────────────────────────────────────────────────────
console.log(`\nUploading mock videos to gs://${BUCKET}/mock-videos/\n`);

const results = [];

for (const entry of FILES) {
  const url = await uploadFile(entry);
  if (url) results.push({ dest: entry.dest, url });
}

console.log('\n── Upload complete ──────────────────────────────────────────────');
console.log(`${results.length} files uploaded / already current.\n`);

console.log('Paste these URLs into src/data/mockVideoUrls.js to go live:\n');
for (const { dest, url } of results) {
  console.log(`  ${dest}`);
  console.log(`    ${url}`);
}

console.log('\nDone.');
