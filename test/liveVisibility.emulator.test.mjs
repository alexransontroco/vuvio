import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || 'demo-vuvio-security';
const root = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const skip = !host;

function token(uid) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: uid, user_id: uid, iat: now, exp: now + 3600, firebase: { sign_in_provider: 'password' } })}.`;
}

function fields(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key, typeof value === 'string' ? { stringValue: value } : { arrayValue: { values: value.map((item) => ({ stringValue: item })) } }]));
}

async function seed(collection, id, values) {
  const response = await fetch(`${root}/${collection}/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: fields(values) }),
  });
  assert.equal(response.status, 200, `seed ${collection}/${id}`);
}

async function read(id, uid) {
  return fetch(`${root}/activeLives/${id}`, {
    headers: uid ? { Authorization: `Bearer ${token(uid)}` } : {},
  });
}

before(async () => {
  if (skip) return;
  await seed('users', 'follower', { uid: 'follower', followedCreators: ['creator'] });
  for (const [id, visibility, privacy] of [
    ['security-public', 'public', 'Everyone'],
    ['security-private', 'private', 'Private'],
    ['security-followers', 'followers', 'Followers'],
  ]) {
    await seed('activeLives', id, {
      id,
      creatorUid: 'creator',
      status: 'live',
      visibility,
      privacy,
      hlsManifestUrl: 'https://customer-example.cloudflarestream.com/example/manifest/video.m3u8',
      streamKey: 'fake-ingest-key',
    });
  }
});

test('anonymous viewer can read a public live', { skip }, async () => {
  assert.equal((await read('security-public')).status, 200);
});

test('anonymous and unrelated users cannot read a private live', { skip }, async () => {
  assert.equal((await read('security-private')).status, 403);
  assert.equal((await read('security-private', 'outsider')).status, 403);
});

test('creator can read their private live', { skip }, async () => {
  assert.equal((await read('security-private', 'creator')).status, 200);
});

test('only a follower can read a followers-only live', { skip }, async () => {
  assert.equal((await read('security-followers', 'follower')).status, 200);
  assert.equal((await read('security-followers', 'outsider')).status, 403);
});

test('anonymous collection list cannot expose restricted live metadata', { skip }, async () => {
  assert.equal((await fetch(`${root}/activeLives`)).status, 403);
});

test('anonymous client cannot modify a live document', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-private?updateMask.fieldPaths=title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields({ title: 'unauthorized change' }) }),
  });
  assert.equal(response.status, 403);
});
