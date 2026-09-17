import { readFile } from 'node:fs/promises';

const firebaseConfigPath = '/Users/alexandreranson/.config/configstore/firebase-tools.json';
const projectId = 'vuvio-bf328';
const databaseId = '(default)';
const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${databaseId}/documents`;

async function getAccessToken() {
  const config = JSON.parse(await readFile(firebaseConfigPath, 'utf8'));
  const tokens = config?.tokens;
  if (!tokens?.access_token) throw new Error('No access token found. Run: firebase login');
  return tokens.access_token;
}

async function listDocuments(collection, token, pageToken) {
  const url = new URL(`${baseUrl}/${collection}`);
  url.searchParams.set('pageSize', '300');
  if (pageToken) url.searchParams.set('pageToken', pageToken);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`List failed: ${res.status} ${await res.text()}`);
  return res.json();
}

async function deleteDocument(name, token) {
  const res = await fetch(`https://firestore.googleapis.com/v1/${name}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Delete failed: ${res.status} ${await res.text()}`);
}

async function main() {
  const token = await getAccessToken();

  let pageToken;
  let total = 0;

  do {
    const data = await listDocuments('creatorEquipment', token, pageToken);
    const docs = data.documents ?? [];

    for (const doc of docs) {
      await deleteDocument(doc.name, token);
      total++;
      process.stdout.write(`\rDeleted ${total} documents...`);
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`\nDone. ${total} equipment documents deleted.`);
}

main().catch((err) => { console.error(err.message); process.exit(1); });
