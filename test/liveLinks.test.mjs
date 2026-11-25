import assert from 'node:assert/strict';
import test from 'node:test';
import { routeFromVuvioUrl } from '../src/platform/deepLinks.js';
import { getLiveShareUrl } from '../src/services/shareService.js';

test('share URLs retain the public live ID and optional creator reference', () => {
  assert.equal(getLiveShareUrl('created-123'), 'https://vuvio.app/share/live/123');
  assert.equal(getLiveShareUrl('created-123', 'warren'), 'https://vuvio.app/share/live/123?ref=warren');
  assert.equal(getLiveShareUrl('abc 123', 'bad value'), 'https://vuvio.app/share/live/abc%20123');
});

test('shared and direct live links retain acquisition parameters in native routing', () => {
  const query = 'ref=warren&utm_source=instagram&utm_medium=social&utm_campaign=pilot';
  assert.equal(
    routeFromVuvioUrl(`https://vuvio.app/share/live/abc123?${query}`),
    `/watch?live=abc123&mode=view&${query}`,
  );
  assert.equal(
    routeFromVuvioUrl(`https://vuvio.app/live/abc123?${query}`),
    `/watch?live=abc123&mode=view&${query}`,
  );
  assert.equal(
    routeFromVuvioUrl(`https://vuvio.app/share/live/abc123/recap?${query}`),
    `/live/abc123/recap?${query}`,
  );
});

test('native routing rejects links from another host', () => {
  assert.equal(routeFromVuvioUrl('https://example.com/share/live/abc123?ref=warren'), null);
});
