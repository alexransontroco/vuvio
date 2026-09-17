import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '../..');
const catalogPath = resolve(rootDir, 'vuvio_catalog_official_verified_v1.json');
const firebaseConfigPath = '/Users/alexandreranson/.config/configstore/firebase-tools.json';
const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'vuvio-bf328';
const databaseId = '(default)';
const documentsBaseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;
const baseUrl = `${documentsBaseUrl}/products`;
const EMPTY_VALUES = new Set(['', null, undefined]);
const WEAK_VALUES = new Set(['pending', 'placeholder', 'not-yet-verified', 'unknown']);

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value) && !value.__timestamp;
}

function isDateField(key) {
  return /(At|Date)$/i.test(key);
}

function toIsoTimestamp(value) {
  if (value?.__timestamp) return value;
  if (typeof value === 'number' && Number.isFinite(value)) {
    const millis = value > 10_000_000_000 ? value : value * 1000;
    return { __timestamp: new Date(millis).toISOString() };
  }
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return { __timestamp: date.toISOString() };
  }
  return value;
}

function normalizeValue(key, value) {
  if (key === 'thumbnailUrl' && value === null) return '';
  if (isDateField(key) && value) return toIsoTimestamp(value);
  if (Array.isArray(value)) return value.map((item) => normalizeNested(item));
  if (isPlainObject(value)) return normalizeNested(value);
  return value;
}

function normalizeNested(value) {
  if (Array.isArray(value)) return value.map((item) => normalizeNested(item));
  if (!isPlainObject(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalizeValue(key, item)]));
}

function nowTimestamp() {
  return { __timestamp: new Date().toISOString() };
}

function normalizeProduct(raw) {
  const product = Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, normalizeValue(key, value)]));

  product.searchTerms = Array.isArray(product.searchTerms)
    ? [...new Set(product.searchTerms.map((term) => String(term).trim().toLowerCase()).filter(Boolean))]
    : [];

  if (product.brand) product.searchTerms.push(String(product.brand).toLowerCase());
  if (product.name) {
    String(product.name)
      .toLowerCase()
      .split(/\s+/)
      .filter((part) => part.length > 1)
      .forEach((part) => product.searchTerms.push(part));
  }
  product.searchTerms = [...new Set(product.searchTerms)];

  product.importSource = 'vuvio_catalog_official_verified_v1';
  product.importedAt = nowTimestamp();
  product.updatedAt = product.updatedAt?.__timestamp ? product.updatedAt : nowTimestamp();
  product.createdAt = product.createdAt?.__timestamp ? product.createdAt : nowTimestamp();

  return product;
}

function hasValue(value) {
  if (EMPTY_VALUES.has(value)) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (isPlainObject(value)) return Object.keys(value).length > 0;
  return true;
}

function isWeakValue(value) {
  if (!hasValue(value)) return true;
  if (typeof value === 'string') return WEAK_VALUES.has(value.toLowerCase());
  return false;
}

function mergeArrays(existing, incoming) {
  return [...new Set([...(existing || []), ...(incoming || [])].map((value) => String(value)).filter(Boolean))];
}

function valueChanged(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

function buildUpdate(existing, incoming) {
  const update = {};

  for (const [key, incomingValue] of Object.entries(incoming)) {
    if (key === 'id' || key === 'createdAt') continue;

    const existingValue = existing[key];
    if (key === 'searchTerms') {
      const merged = mergeArrays(existingValue, incomingValue);
      if (valueChanged(existingValue || [], merged)) update[key] = merged;
      continue;
    }

    if (!hasValue(incomingValue)) continue;
    if (!hasValue(existingValue) || isWeakValue(existingValue)) {
      if (valueChanged(existingValue, incomingValue)) update[key] = incomingValue;
    }
  }

  if (Object.keys(update).length > 0) {
    update.updatedAt = nowTimestamp();
    update.importedAt = nowTimestamp();
    update.importSource = incoming.importSource;
  }

  return update;
}

function encodeFirestoreValue(value) {
  if (value?.__timestamp) return { timestampValue: value.__timestamp };
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (Number.isInteger(value)) return { integerValue: String(value) };
  if (typeof value === 'number') return { doubleValue: value };
  if (typeof value === 'string') return { stringValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map((item) => encodeFirestoreValue(item)) } };
  if (isPlainObject(value)) {
    return {
      mapValue: {
        fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeFirestoreValue(item)])),
      },
    };
  }
  return { stringValue: String(value) };
}

function decodeFirestoreValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return { __timestamp: value.timestampValue };
  if ('nullValue' in value) return null;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map((item) => decodeFirestoreValue(item));
  if ('mapValue' in value) {
    return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeFirestoreValue(item)]));
  }
  return undefined;
}

function encodeDocument(data) {
  return {
    fields: Object.fromEntries(Object.entries(data).map(([key, value]) => [key, encodeFirestoreValue(value)])),
  };
}

function decodeDocument(document) {
  return Object.fromEntries(Object.entries(document.fields || {}).map(([key, value]) => [key, decodeFirestoreValue(value)]));
}

async function getAccessToken() {
  const config = JSON.parse(await readFile(firebaseConfigPath, 'utf8'));
  const token = config?.tokens?.access_token;
  if (!token) throw new Error('Firebase CLI access token not found');
  return token;
}

async function firestoreRequest(path, { token, method = 'GET', body, updateMask = [] }) {
  const url = new URL(path);
  updateMask.forEach((field) => url.searchParams.append('updateMask.fieldPaths', field));
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 404) return null;
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`${method} ${url.pathname} failed: ${response.status} ${JSON.stringify(data)}`);
  }
  return data;
}

async function importCatalog() {
  const token = await getAccessToken();
  const raw = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (!Array.isArray(raw)) throw new Error('Catalog root must be an array');

  const summary = { created: 0, updated: 0, ignored: 0 };
  const details = [];

  for (const item of raw) {
    if (!item?.id || typeof item.id !== 'string') {
      throw new Error(`Catalog item missing string id: ${JSON.stringify(item)}`);
    }

    const product = normalizeProduct(item);
    const documentUrl = `${baseUrl}/${encodeURIComponent(item.id)}`;
    const existingDocument = await firestoreRequest(documentUrl, { token });

    if (!existingDocument) {
      await firestoreRequest(documentUrl, {
        token,
        method: 'PATCH',
        body: encodeDocument(product),
      });
      summary.created += 1;
      details.push({ id: item.id, action: 'created' });
      continue;
    }

    const existing = decodeDocument(existingDocument);
    const update = buildUpdate(existing, product);
    const fields = Object.keys(update).sort();
    if (fields.length === 0) {
      summary.ignored += 1;
      details.push({ id: item.id, action: 'ignored' });
      continue;
    }

    await firestoreRequest(documentUrl, {
      token,
      method: 'PATCH',
      body: encodeDocument(update),
      updateMask: fields,
    });
    summary.updated += 1;
    details.push({ id: item.id, action: 'updated', fields });
  }

  console.log(JSON.stringify({ projectId, summary, details }, null, 2));
}

async function searchCatalog(queryText) {
  const token = await getAccessToken();
  const normalized = String(queryText || '').toLowerCase();
  const list = await firestoreRequest(`${baseUrl}?pageSize=100`, { token });
  const products = (list?.documents || []).map((doc) => {
    const id = doc.name.split('/').pop();
    return { id, ...decodeDocument(doc) };
  });

  const results = products.filter((product) => {
    const name = String(product.name || '').toLowerCase();
    const brand = String(product.brand || '').toLowerCase();
    const searchTerms = (product.searchTerms || []).map((term) => String(term).toLowerCase());
    return name.includes(normalized)
      || brand.includes(normalized)
      || searchTerms.some((term) => term.includes(normalized));
  });

  console.log(JSON.stringify({
    projectId,
    query: queryText,
    count: results.length,
    results: results.map((product) => ({
      id: product.id,
      brand: product.brand,
      name: product.name,
      category: product.category,
      thumbnailUrl: product.thumbnailUrl,
      imageSource: product.imageSource,
    })),
  }, null, 2));
}

async function createEquipmentPanelTestLive() {
  const token = await getAccessToken();
  const id = `vuvio-equipment-panel-test-${Date.now()}`;
  const live = {
    id,
    status: 'live',
    name: 'Vuvio Test',
    streamer: 'Vuvio Test',
    kind: 'image',
    job: 'Cycling',
    city: 'Chamonix',
    country: 'France',
    location: 'Equipment test route',
    locationLabel: 'Equipment test route',
    privacy: 'Everyone',
    quality: '1080p',
    viewers: '1',
    viewerLabel: '1',
    image: '/assets/videos/biking-cover.jpg',
    coordinates: [6.8647, 45.8326],
    family: 'earth',
    subcategory: 'Cycling',
    povType: 'pov',
    experienceTitle: 'Equipment panel test',
    title: 'Equipment panel test',
    description: 'Testing imported catalog gear',
    chat: [{ who: 'Vuvio', text: 'Live started' }],
    equipment: [{ equipmentId: 'equipment-test-gopro-hero13' }],
    equipmentConfirmed: true,
    equipmentUpdatedAt: nowTimestamp(),
    createdAt: nowTimestamp(),
    updatedAt: nowTimestamp(),
  };

  await firestoreRequest(`${documentsBaseUrl}/activeLives/${id}`, {
    token,
    method: 'PATCH',
    body: encodeDocument(live),
  });

  console.log(JSON.stringify({ projectId, id, action: 'created-test-live' }, null, 2));
}

async function deleteEquipmentPanelTestLive(id) {
  const token = await getAccessToken();
  const response = await fetch(`${documentsBaseUrl}/activeLives/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error(`DELETE activeLives/${id} failed: ${response.status} ${text}`);
  }
  console.log(JSON.stringify({ projectId, id, action: 'deleted-test-live' }, null, 2));
}

const searchArg = process.argv.find((arg) => arg.startsWith('--search='));
const deleteTestLiveArg = process.argv.find((arg) => arg.startsWith('--delete-test-live='));
const task = searchArg
  ? searchCatalog(searchArg.slice('--search='.length))
  : process.argv.includes('--create-equipment-panel-test-live')
    ? createEquipmentPanelTestLive()
    : deleteTestLiveArg
      ? deleteEquipmentPanelTestLive(deleteTestLiveArg.slice('--delete-test-live='.length))
      : importCatalog();

task.catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
