import assert from 'node:assert/strict';
import { before, test } from 'node:test';

const host = process.env.FIRESTORE_EMULATOR_HOST;
const project = process.env.GCLOUD_PROJECT || 'demo-vuvio-security';
const root = `http://${host}/v1/projects/${project}/databases/(default)/documents`;
const skip = !host;

function token(uid, claims = {}) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return `${encode({ alg: 'none', typ: 'JWT' })}.${encode({ aud: project, iss: `https://securetoken.google.com/${project}`, sub: uid, user_id: uid, iat: now, exp: now + 3600, firebase: { sign_in_provider: 'password' }, ...claims })}.`;
}

function fields(values) {
  return Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    typeof value === 'string' ? { stringValue: value }
      : typeof value === 'boolean' ? { booleanValue: value }
        : { arrayValue: { values: value.map((item) => ({ stringValue: item })) } },
  ]));
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

function adminToken(email, emailVerified = true) {
  return token('admin-user', { email, email_verified: emailVerified });
}

async function readCollection(collection, id, authToken) {
  return fetch(`${root}/${collection}/${id}`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
}

before(async () => {
  if (skip) return;
  assert.match(host, /^(127\.0\.0\.1|localhost):\d+$/);
  assert.match(project, /^demo-/);
  const cleared = await fetch(`http://${host}/emulator/v1/projects/${project}/databases/(default)/documents`, { method: 'DELETE' });
  assert.equal(cleared.status, 200);
  await seed('adminFinancialData', 'forecast-2027', { year: '2027', mrr: '50000', source: 'internal' });
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
      title: `${visibility} preview title`,
      ...(visibility === 'public' ? { publicSafe: true } : {}),
      hlsManifestUrl: 'https://customer-example.cloudflarestream.com/example/manifest/video.m3u8',
      ...(visibility === 'public' ? {} : { streamKey: 'fake-ingest-key' }),
    });
  }
  await seed('activeLives/security-private/comments', 'private-comment', { text: 'confidential' });
  await seed('activeLives/security-private/watchers', 'private-watcher', { sdpAnswer: 'confidential' });
  await seed('activeLives', 'legacy-public', {
    id: 'legacy-public', creatorUid: 'creator', status: 'ended', privacy: 'Everyone', streamKey: '',
  });
  await seed('streams', 'security-og-followers', {
    id: 'security-og-followers', creatorId: 'creator', status: 'completed', visibility: 'followers',
    title: 'Followers only preview title', description: 'Followers only preview description',
    hlsManifestUrl: 'https://customer-example.cloudflarestream.com/followers/manifest/video.m3u8',
  });
  await seed('streams', 'security-og-public', {
    id: 'security-og-public', creatorId: 'creator', status: 'live', visibility: 'public',
    title: 'Public preview title', description: 'Public preview description',
  });
});

test('Open Graph previews hide Followers streams and retain public streams', { skip }, async () => {
  const { ogMetaHandler } = await import('../functions/lib/og/ogMetaHandler.js');
  const render = async (id) => {
    let html = '';
    const response = {
      set() { return this; },
      status() { return this; },
      end(body) { html = body.toString(); return this; },
    };
    await ogMetaHandler({ query: {} }, response, id);
    return html;
  };
  const followers = await render('security-og-followers');
  assert.equal(followers.includes('Followers only preview title'), false);
  assert.equal(followers.includes('Followers only preview description'), false);
  assert.equal(followers.includes('customer-example.cloudflarestream.com'), false);
  const privatePreview = await render('security-private');
  assert.equal(privatePreview.includes('private preview title'), false);
  const publicPreview = await render('security-og-public');
  assert.equal(publicPreview.includes('Public preview title'), true);
});

test('public stream API refuses Followers streams', { skip }, async () => {
  const { getStream } = await import('../functions/lib/streams/getStream.js');
  await assert.rejects(() => getStream({}, { json() {} }, 'security-og-followers'), { code: 'not_found' });
  let payload = null;
  await getStream({}, { json(value) { payload = value; } }, 'security-og-public');
  assert.equal(payload?.stream?.title, 'Public preview title');
});

test('anonymous viewer can read a public live', { skip }, async () => {
  const response = await read('security-public');
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(await response.json()).includes('streamKey'), false);
});

test('anonymous and unrelated users cannot read a private live', { skip }, async () => {
  assert.equal((await read('security-private')).status, 403);
  assert.equal((await read('security-private', 'outsider')).status, 403);
});

test('unverified email cannot impersonate an administrator', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-private`, {
    headers: { Authorization: `Bearer ${token('outsider', { email: 'fake@vuvio.app', email_verified: false })}` },
  });
  assert.equal(response.status, 403);
});

test('creator can read their private live', { skip }, async () => {
  assert.equal((await read('security-private', 'creator')).status, 200);
});

test('followers-only lives are unavailable during the public-only MVP', { skip }, async () => {
  assert.equal((await read('security-followers', 'follower')).status, 403);
  assert.equal((await read('security-followers', 'outsider')).status, 403);
});

test('private live comments and signaling are not readable anonymously', { skip }, async () => {
  assert.equal((await fetch(`${root}/activeLives/security-private/comments/private-comment`)).status, 403);
  assert.equal((await fetch(`${root}/activeLives/security-private/watchers/private-watcher`)).status, 403);
});

test('public live comments and anonymous P2P signaling remain available', { skip }, async () => {
  const comment = await fetch(`${root}/activeLives/security-public/comments/public-comment`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('viewer')}` },
    body: JSON.stringify({ fields: fields({ text: 'Hello', userId: 'viewer', userDisplayName: 'Viewer', userPhotoURL: '', timestamp: 'now' }) }),
  });
  assert.equal(comment.status, 200);
  assert.equal((await fetch(`${root}/activeLives/security-public/comments/public-comment`)).status, 200);
  const watcher = await fetch(`${root}/activeLives/security-public/watchers/public-watcher`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields({ sdpAnswer: 'fake-answer', watcherUid: 'anonymous-session' }) }),
  });
  assert.equal(watcher.status, 200);
});

test('anonymous collection list cannot expose restricted live metadata', { skip }, async () => {
  assert.equal((await fetch(`${root}/activeLives`)).status, 403);
});

test('anonymous public feed query returns only approved lives', { skip }, async () => {
  const response = await fetch(`http://${host}/v1/projects/${project}/databases/(default)/documents:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ structuredQuery: {
      from: [{ collectionId: 'activeLives' }],
      where: { compositeFilter: { op: 'AND', filters: [
        { fieldFilter: { field: { fieldPath: 'publicSafe' }, op: 'EQUAL', value: { booleanValue: true } } },
        { fieldFilter: { field: { fieldPath: 'status' }, op: 'EQUAL', value: { stringValue: 'live' } } },
      ] } },
    } }),
  });
  assert.equal(response.status, 200);
  const rows = await response.json();
  assert.deepEqual(rows.flatMap((row) => row.document ? [row.document.name.split('/').at(-1)] : []), ['security-public']);
});

test('legacy public live becomes readable only after an explicit sanitized backfill', { skip }, async () => {
  assert.equal((await read('legacy-public')).status, 403);
  await seed('activeLives', 'legacy-public', {
    id: 'legacy-public', creatorUid: 'creator', status: 'ended',
    privacy: 'Everyone', visibility: 'public', publicSafe: true,
  });
  const response = await read('legacy-public');
  assert.equal(response.status, 200);
  assert.equal(JSON.stringify(await response.json()).includes('streamKey'), false);
  assert.equal((await read('security-private')).status, 403);
  await seed('activeLives', 'legacy-public', {
    id: 'legacy-public', creatorUid: 'creator', status: 'ended', privacy: 'Everyone', streamKey: '',
  });
  assert.equal((await read('legacy-public')).status, 403);
});

test('anonymous client cannot modify a live document', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-private?updateMask.fieldPaths=title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fields: fields({ title: 'unauthorized change' }) }),
  });
  assert.equal(response.status, 403);
});

test('another authenticated user cannot modify the creator live', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-public?updateMask.fieldPaths=title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('outsider')}` },
    body: JSON.stringify({ fields: fields({ title: 'unauthorized change' }) }),
  });
  assert.equal(response.status, 403);
});

test('creator can update their public live', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-public?updateMask.fieldPaths=title`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('creator')}` },
    body: JSON.stringify({ fields: fields({ title: 'Public update' }) }),
  });
  assert.equal(response.status, 200);
});

test('creator can create a public live without ingest secrets', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/new-public-live`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('creator')}` },
    body: JSON.stringify({ fields: fields({ id: 'new-public-live', creatorUid: 'creator', status: 'live', publicSafe: true, visibility: 'public', privacy: 'Everyone', title: 'Public live' }) }),
  });
  assert.equal(response.status, 200);
  assert.equal((await read('new-public-live')).status, 200);
});

test('clients cannot create private lives or public documents with ingest keys', { skip }, async () => {
  for (const [id, visibility, privacy, extra] of [
    ['blocked-private', 'private', 'Private', {}],
    ['blocked-followers', 'followers', 'Followers', {}],
    ['blocked-secret', 'public', 'Everyone', { streamKey: 'fake-ingest-key' }],
  ]) {
    const response = await fetch(`${root}/activeLives/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('creator')}` },
      body: JSON.stringify({ fields: fields({ id, creatorUid: 'creator', status: 'live', publicSafe: true, visibility, privacy, ...extra }) }),
    });
    assert.equal(response.status, 403, id);
  }
});

test('creator cannot add an unapproved field to a public live', { skip }, async () => {
  const response = await fetch(`${root}/activeLives/security-public?updateMask.fieldPaths=internalSecret`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token('creator')}` },
    body: JSON.stringify({ fields: fields({ internalSecret: 'fake-secret' }) }),
  });
  assert.equal(response.status, 403);
});

// ── adminFinancialData access control ────────────────────────────────────────

test('known admin email can read adminFinancialData', { skip }, async () => {
  for (const email of [
    'alexandre.ranson@gmail.com',
    'doug.benchetrit@gmail.com',
    'cecilia.ranson@outlook.com',
    'christophe.ranson@gmail.com',
  ]) {
    const response = await readCollection('adminFinancialData', 'forecast-2027', adminToken(email));
    assert.equal(response.status, 200, `admin ${email} should be able to read financial data`);
  }
});

test('vuvio.app domain admin can read adminFinancialData', { skip }, async () => {
  const response = await readCollection('adminFinancialData', 'forecast-2027', adminToken('team@vuvio.app'));
  assert.equal(response.status, 200);
});

test('regular authenticated user cannot read adminFinancialData', { skip }, async () => {
  const response = await readCollection('adminFinancialData', 'forecast-2027', token('regular-user'));
  assert.equal(response.status, 403);
});

test('anonymous visitor cannot read adminFinancialData', { skip }, async () => {
  const response = await readCollection('adminFinancialData', 'forecast-2027', null);
  assert.equal(response.status, 403);
});

test('unverified admin email cannot read adminFinancialData', { skip }, async () => {
  const response = await readCollection('adminFinancialData', 'forecast-2027', adminToken('alexandre.ranson@gmail.com', false));
  assert.equal(response.status, 403);
});

test('admin cannot write to adminFinancialData (server-only via admin SDK)', { skip }, async () => {
  const response = await fetch(`${root}/adminFinancialData/forecast-2028`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken('alexandre.ranson@gmail.com')}` },
    body: JSON.stringify({ fields: fields({ year: '2028', mrr: '99999' }) }),
  });
  assert.equal(response.status, 403);
});

test('admin with custom claim can read adminFinancialData', { skip }, async () => {
  const claimToken = token('custom-claim-admin', { admin: true });
  const response = await readCollection('adminFinancialData', 'forecast-2027', claimToken);
  assert.equal(response.status, 200);
});
