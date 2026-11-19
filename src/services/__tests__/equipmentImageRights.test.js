import test from 'node:test';
import assert from 'node:assert/strict';
import { equipmentImageForUsage, getEquipmentVisual, persistentEquipmentImage } from '../../data/equipmentVisual.js';
import { createGearSnapshot } from '../gearSnapshotService.js';

const icecatGrant = {
  provider: 'icecat', imageSource: 'icecat', thumbnailUrl: '/licensed/icecat-product.jpg', imageHostingStatus: 'self-hosted',
  imageRightsStatus: 'authorized', imageRightsSource: 'verified-contract-reference',
  imageAllowedUsages: ['search-preview', 'persistent-gear', 'public-gear'],
  imageRightsCheckedAt: new Date().toISOString(), imageRightsExpiresAt: '2099-01-01T00:00:00.000Z', imageProductId: '123',
};

test('a documented grant enables each separately approved usage', () => {
  for (const usage of icecatGrant.imageAllowedUsages) assert.equal(equipmentImageForUsage(icecatGrant, usage), icecatGrant.thumbnailUrl);
  assert.equal(persistentEquipmentImage(icecatGrant).imageProductId, '123');
  assert.equal(createGearSnapshot(icecatGrant).imageUrl, icecatGrant.thumbnailUrl);
});

test('provider access and a usable URL are insufficient rights', () => {
  for (const source of ['icecat', 'ebayCatalog']) {
    const item = { thumbnailUrl: icecatGrant.thumbnailUrl, imageSource: source, imageRightsStatus: source === 'icecat' ? 'provider-hosted' : 'unknown' };
    assert.equal(equipmentImageForUsage(item, 'search-preview'), null);
    assert.equal(persistentEquipmentImage(item).thumbnailUrl, null);
    assert.equal(createGearSnapshot(item).imageUrl, null);
  }
});

test('even an approved Icecat asset cannot hotlink the provider file URL', () => {
  assert.equal(equipmentImageForUsage({ ...icecatGrant, thumbnailUrl: 'https://data.icecat.biz/example.jpg' }), null);
  assert.equal(equipmentImageForUsage({ ...icecatGrant, imageHostingStatus: null }), null);
});

test('the mixed search does not promote an eBay listing image into a reusable asset', () => {
  const ebay = { ...icecatGrant, imageSource: 'ebayCatalog', imageRightsSource: 'ebay-api-license-public-display-conditional' };
  assert.equal(equipmentImageForUsage(ebay, 'search-preview'), null);
  assert.equal(equipmentImageForUsage(ebay, 'persistent-gear'), null);
  assert.equal(equipmentImageForUsage({ ...icecatGrant, imageRightsExpiresAt: null }, 'persistent-gear'), null);
});

test('manual item, invalid URL, expiry and revocation fall back to icon', () => {
  assert.equal(getEquipmentVisual({ displayName: 'Guitare' }).imageUrl, null);
  assert.equal(equipmentImageForUsage({ ...icecatGrant, thumbnailUrl: 'javascript:alert(1)' }), null);
  assert.equal(equipmentImageForUsage({ ...icecatGrant, imageRightsExpiresAt: '2020-01-01T00:00:00Z' }), null);
  assert.equal(equipmentImageForUsage({ ...icecatGrant, imageRightsStatus: 'revoked' }), null);
});

test('private user upload never implies public permission', () => {
  const item = { imageUrl: 'data:image/png;base64,aGVsbG8=', imageSource: 'user_upload' };
  assert.equal(equipmentImageForUsage(item, 'persistent-gear'), item.imageUrl);
  assert.equal(equipmentImageForUsage(item, 'public-gear'), null);
  assert.equal(createGearSnapshot(item).imageUrl, null);
});

test('rights metadata survives a storage round trip and remains scoped', () => {
  const privateOnly = { ...icecatGrant, imageAllowedUsages: ['persistent-gear'] };
  const restored = JSON.parse(JSON.stringify({ ...privateOnly, ...persistentEquipmentImage(privateOnly) }));
  assert.equal(restored.imageProductId, '123');
  assert.equal(restored.imageRightsSource, 'verified-contract-reference');
  assert.equal(equipmentImageForUsage(restored, 'persistent-gear'), icecatGrant.thumbnailUrl);
  assert.equal(equipmentImageForUsage(restored, 'public-gear'), null);
  assert.equal(createGearSnapshot(restored).imageUrl, null);
});
