import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isDiagnosticAdminToken, parseVisibility, requireLiveCreator, requirePublicActiveLive } from '../functions/lib/shared/validation.js';

test('stream creation accepts public visibility only', () => {
  assert.equal(parseVisibility(undefined), 'public');
  assert.equal(parseVisibility('public'), 'public');
  for (const value of ['private', 'followers', 'followers-only']) {
    assert.throws(() => parseVisibility(value), /Only public lives|visibility is invalid/);
  }
});

test('Cloudflare management requires the live creator', () => {
  assert.doesNotThrow(() => requireLiveCreator({ creatorUid: 'creator' }, 'creator'));
  assert.throws(() => requireLiveCreator({ creatorUid: 'creator' }, 'outsider'), { code: 'forbidden' });
});

test('replay and ingest endpoints reject unapproved lives', () => {
  assert.doesNotThrow(() => requirePublicActiveLive({ publicSafe: true, visibility: 'public', privacy: 'Everyone' }));
  for (const live of [
    { visibility: 'public', privacy: 'Everyone' },
    { publicSafe: true, visibility: 'private', privacy: 'Private' },
    { publicSafe: true, visibility: 'followers', privacy: 'Followers' },
  ]) {
    assert.throws(() => requirePublicActiveLive(live), { code: 'not_found' });
  }
});

test('Cloudflare diagnostics require a verified administrator', () => {
  assert.equal(isDiagnosticAdminToken({ email: 'fake@vuvio.app', email_verified: false }), false);
  assert.equal(isDiagnosticAdminToken({ email: 'alexandre.ranson@gmail.com', email_verified: true }), true);
  assert.equal(isDiagnosticAdminToken({ admin: true }), true);
});
