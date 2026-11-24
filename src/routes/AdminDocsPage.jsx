import {
  Archive,
  BarChart3,
  BriefcaseBusiness,
  Lightbulb,
  TrendingUp,
  BookOpen,
  Box,
  CheckCircle2,
  ClipboardList,
  FileText,
  Globe2,
  History,
  Languages,
  Layers3,
  Package,
  Radio,
  Search,
  Server,
  ShieldAlert,
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { collection, getDocs, orderBy, query } from 'firebase/firestore';
import { useMemo, useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { db } from '../firebase.js';
import { useAuth } from '../context/AuthContext.jsx';
import FinancialForecastViewer from '../components/admin/FinancialForecastViewer.jsx';

const docModules = import.meta.glob([
  '../../README.md',
  '../../ADMIN.md',
  '../../CHANGELOG.md',
  '../../AGENTS.md',
  '../../journal.architecture.md',
  '../../Vuvio_Inspirations_Strava_Polarsteps.md',
  '../../docs/**/*.md',
], { query: '?raw', import: 'default', eager: true });

const DOMAIN_META = {
  strategy: { label: { en: 'Strategy', fr: 'Stratégie' }, icon: Lightbulb, accent: '#b7a6ff' },
  business: { label: { en: 'Business', fr: 'Business' }, icon: BriefcaseBusiness, accent: '#e5b56a' },
  growth: { label: { en: 'Growth & Marketing', fr: 'Croissance & Marketing' }, icon: TrendingUp, accent: '#77d4a1' },
  root: { label: { en: 'Command Center', fr: 'Centre de Commande' }, icon: Layers3, accent: '#35e3dc' },
  backend: { label: { en: 'Backend', fr: 'Backend' }, icon: Server, accent: '#6dd7ff' },
  streaming: { label: { en: 'Streaming', fr: 'Streaming' }, icon: Radio, accent: '#35e3dc' },
  analytics: { label: { en: 'Analytics', fr: 'Analytics' }, icon: BarChart3, accent: '#ffd166' },
  gear: { label: { en: 'Gear', fr: 'Equipement' }, icon: Box, accent: '#89f0a8' },
  products: { label: { en: 'Products', fr: 'Produits' }, icon: Package, accent: '#ffb86b' },
  globe: { label: { en: 'Globe', fr: 'Globe' }, icon: Globe2, accent: '#7dd3fc' },
  i18n: { label: { en: 'i18n', fr: 'i18n' }, icon: Languages, accent: '#c4b5fd' },
  ops: { label: { en: 'Ops', fr: 'Ops' }, icon: Wrench, accent: '#fca5a5' },
  archive: { label: { en: 'Archive', fr: 'Archives' }, icon: Archive, accent: '#94a3b8' },
};

const PRIORITY_ORDER = ['root', 'strategy', 'business', 'growth', 'streaming', 'backend', 'analytics', 'gear', 'products', 'globe', 'i18n', 'ops', 'archive'];

const STATIC_HTML_DOCS = [
  {
    id: 'Vuvio_App_Wireflow.html',
    path: 'Vuvio_App_Wireflow.html',
    domain: 'root',
    isIndex: false,
    title: 'App Wireflow',
    status: 'Current',
    readSignal: null,
    description: 'Interactive app navigation wireflow — all screens and transitions.',
    headings: [],
    wordCount: 0,
    htmlSrc: '/Vuvio_App_Wireflow.html',
  },
];

const DOC_ROLES = {
  'Vuvio_App_Wireflow.html': { en: 'Interactive wireflow', fr: 'Wireflow interactif' },
  'README.md': { en: 'Project entry point', fr: 'Point d\'entrée projet' },
  'ADMIN.md': { en: 'Open tasks and decisions', fr: 'Tâches et arbitrages' },
  'CHANGELOG.md': { en: 'Session history', fr: 'Historique des sessions' },
  'AGENTS.md': { en: 'Critical agent rules', fr: 'Règles critiques agent' },
  'journal.architecture.md': { en: 'Product and architecture journal', fr: 'Journal produit et architecture' },
  'Vuvio_Inspirations_Strava_Polarsteps.md': { en: 'Product inspirations', fr: 'Inspirations produit' },
  'docs/README.md': { en: 'Technical docs index', fr: 'Index des docs techniques' },
  'docs/vuvio-complete-overview.md': { en: 'Complete product reference', fr: 'Référence produit complète' },
  'docs/vuvio-reference-produit-non-technique.md': { en: 'Non-technical product reference', fr: 'Référence produit non technique' },
  'docs/business/previsionnel-2027-2029.md': { en: 'Financial forecast 2027–2029', fr: 'Prévisionnel financier 2027–2029' },
};

const COPY = {
  en: {
    aria: 'Admin documentation',
    eyebrow: 'Admin Documentation',
    title: 'Vuvio operating manual',
    subtitle: 'Current rules, domain docs, historical notes, and implementation references in one controlled admin surface.',
    scoreLabel: 'current docs labeled',
    criticalRules: 'Critical rules',
    searchPlaceholder: 'Search docs, rules, paths...',
    allCurrent: 'All Current',
    includeArchive: 'Include archive',
    documents: 'documents',
    allDomains: 'All current domains',
    words: 'words',
    languageNote: 'Language',
    contentNote: 'Admin and changelog are bilingual. Technical docs keep their source language.',
    openDocs: 'Docs',
    openAnalytics: 'Analytics Dashboard',
    domainNavLabel: 'Documentation domains',
    documentListLabel: 'Document list',
    outlineLabel: 'Document outline',
    tabsLabel: 'Admin sections',
    overview: 'Overview',
    tasks: 'Tasks',
    history: 'History',
    docs: 'Docs',
    rules: 'Rules',
    priority: 'Priority',
    status: 'Status',
    source: 'Source',
    sourceTruth: 'Sources of truth',
    nextWork: 'Next work',
    recentWork: 'Recent work',
    criticalDecisions: 'Critical decisions',
    openTasks: 'Open tasks',
    activeDocs: 'Active docs',
    readBeforeCoding: 'Read before coding',
    viewDocs: 'Open docs browser',
    latestSession: 'Latest session',
    needsReview: 'Needs review',
    reviewDocs: 'Docs to verify',
    sourceOfTruth: 'Source of truth',
    indexDoc: 'Index',
    referenceDoc: 'Reference',
    reviewDoc: 'To verify',
    archiveDoc: 'Archive',
    high: 'high',
    medium: 'medium',
    low: 'low',
    labeled: 'labeled',
    unlabeled: 'Unlabeled',
    historical: 'Historical',
  },
  fr: {
    aria: 'Documentation admin',
    eyebrow: 'Documentation Admin',
    title: 'Manuel opérationnel Vuvio',
    subtitle: 'Règles actuelles, docs par domaine, notes historiques et références d\'implémentation dans une interface admin unique.',
    scoreLabel: 'docs actuelles classées',
    criticalRules: 'Règles critiques',
    searchPlaceholder: 'Chercher docs, règles, chemins...',
    allCurrent: 'Tout actuel',
    includeArchive: 'Inclure les archives',
    documents: 'documents',
    allDomains: 'Tous les domaines actifs',
    words: 'mots',
    languageNote: 'Langue',
    contentNote: 'Les écrans, statuts et docs racine sont localisés. Les longues docs techniques gardent leur langue source.',
    openDocs: 'Docs',
    openAnalytics: 'Dashboard analytics',
    domainNavLabel: 'Domaines de documentation',
    documentListLabel: 'Liste des documents',
    outlineLabel: 'Plan du document',
    tabsLabel: 'Sections admin',
    overview: 'Vue d\'ensemble',
    tasks: 'Tâches',
    history: 'Historique',
    docs: 'Docs',
    rules: 'Règles',
    priority: 'Priorité',
    status: 'Statut',
    source: 'Source',
    sourceTruth: 'Sources de vérité',
    nextWork: 'Prochain travail',
    recentWork: 'Travail récent',
    criticalDecisions: 'Décisions critiques',
    openTasks: 'Tâches ouvertes',
    activeDocs: 'Docs actives',
    readBeforeCoding: 'À lire avant de coder',
    viewDocs: 'Ouvrir le navigateur docs',
    latestSession: 'Dernière session',
    needsReview: 'À vérifier',
    reviewDocs: 'Docs à vérifier',
    sourceOfTruth: 'Source de vérité',
    indexDoc: 'Index',
    referenceDoc: 'Référence',
    reviewDoc: 'À vérifier',
    archiveDoc: 'Archive',
    high: 'haute',
    medium: 'moyenne',
    low: 'basse',
    labeled: 'classées',
    unlabeled: 'Non classé',
    historical: 'Historique',
  },
};

const ADMIN_TABS = [
  { id: 'overview', icon: Layers3, label: { en: 'Overview', fr: 'Vue d\'ensemble' } },
  { id: 'tasks', icon: ClipboardList, label: { en: 'Tasks', fr: 'Tâches' } },
  { id: 'history', icon: History, label: { en: 'History', fr: 'Historique' } },
  { id: 'docs', icon: BookOpen, label: { en: 'Docs', fr: 'Docs' } },
  { id: 'rules', icon: ShieldCheck, label: { en: 'Rules', fr: 'Règles' } },
  { id: 'moderation', icon: ShieldAlert, label: { en: 'Moderation', fr: 'Modération' } },
];

const ADMIN_TASKS = parseAdminTasks(docModules['../../ADMIN.md'] || '');

const FALLBACK_HISTORY_ITEMS = [
  {
    date: '2026-09-09',
    type: { en: 'Bug', fr: 'Bug' },
    title: { en: 'Mobile equipment scroll fix', fr: 'Fix scroll équipement mobile' },
    body: {
      en: 'Scrolling the equipment sheet no longer triggers live feed swipe navigation on iPhone.',
      fr: 'Le scroll du sheet équipement ne déclenche plus le swipe du live feed sur iPhone.',
    },
    files: ['HomePage.jsx', 'EquipmentKit.jsx', 'components.css'],
  },
  {
    date: '2026-09-04',
    type: { en: 'UX', fr: 'UX' },
    title: { en: 'Start a live simplification', fr: 'Simplification Start a live' },
    body: {
      en: 'The “More categories” panel now uses one flat alphabetical list.',
      fr: 'Le panel “More categories” utilise maintenant une liste flat alphabétique.',
    },
    files: ['BottomNav.jsx', 'components.css'],
  },
  {
    date: '2026-09-03',
    type: { en: 'Docs', fr: 'Docs' },
    title: { en: 'Docs consolidation', fr: 'Consolidation docs' },
    body: {
      en: 'Scattered Markdown files were consolidated into an architecture journal and admin entry point.',
      fr: 'Les fichiers Markdown épars ont été consolidés dans un journal d\'architecture et un point d\'entrée admin.',
    },
    files: ['journal.architecture.md'],
  },
];

const SOURCE_TRUTH = [
  { topic: { en: 'Critical agent rules', fr: 'Règles critiques agent' }, source: 'AGENTS.md' },
  { topic: { en: 'Open tasks and decisions', fr: 'Tâches et arbitrages' }, source: 'ADMIN.md' },
  { topic: { en: 'Session history', fr: 'Historique des sessions' }, source: 'CHANGELOG.md' },
  { topic: { en: 'Architecture overview', fr: 'Vue architecture' }, source: 'journal.architecture.md' },
  { topic: { en: 'Domain technical detail', fr: 'Détail technique par domaine' }, source: 'docs/' },
];

const CRITICAL_RULES = [
  {
    title: { en: 'HLS stays primary', fr: 'HLS reste prioritaire' },
    body: {
      en: 'Viewer playback must prefer HLS. Do not make WHEP the primary multi-viewer path.',
      fr: 'La lecture spectateur doit préférer HLS. Ne pas faire de WHEP le chemin principal multi-viewer.',
    },
    domain: { en: 'Streaming', fr: 'Streaming' },
  },
  {
    title: { en: 'Keep replay metadata', fr: 'Garder les métadonnées replay' },
    body: {
      en: 'Do not delete activeLives documents in client end-live flows. Backend jobs need cloudflareLiveInputId.',
      fr: 'Ne pas supprimer les documents activeLives côté client à la fin du live. Les jobs backend ont besoin de cloudflareLiveInputId.',
    },
    domain: { en: 'Backend', fr: 'Backend' },
  },
  {
    title: { en: 'Pinned live navigation', fr: 'Navigation live épinglée' },
    body: {
      en: 'When ?live=ID is present, that live must be first in the Watch feed.',
      fr: 'Quand ?live=ID est présent, ce live doit être le premier dans le feed Watch.',
    },
    domain: { en: 'Watch', fr: 'Watch' },
  },
  {
    title: { en: 'Functions dependencies', fr: 'Dépendances Functions' },
    body: {
      en: 'Any new third-party function import must be declared in functions/package.json.',
      fr: 'Tout nouvel import tiers dans les functions doit être déclaré dans functions/package.json.',
    },
    domain: { en: 'Ops', fr: 'Ops' },
  },
];

const LOCALIZED_DOCS = {
  'README.md': {
    fr: `# Vuvio

Vuvio est une application mobile-first de live streaming POV pour les créateurs outdoor, aventure, craft et terrain.

Le produit organise la découverte autour des lives géolocalisés, des profils créateurs, des replays/recaps et de l'équipement comme couche communautaire et monétisable.

Stack, commandes et règles critiques → [AGENTS.md](AGENTS.md).  
Architecture, décisions et questions ouvertes → [journal.architecture.md](journal.architecture.md).

## Carte de documentation

- [AGENTS.md](AGENTS.md) — règles critiques pour les agents de code.
- [journal.architecture.md](journal.architecture.md) — source de vérité produit, architecture, décisions et questions ouvertes.
- [docs/README.md](docs/README.md) — index des docs techniques, guides par domaine et notes historiques.
- [agents/README.md](agents/README.md) — stratégie marché et prospection créateurs.

## Règles non négociables

- La lecture viewer utilise HLS en premier. Ne pas prioriser WHEP pour plusieurs viewers.
- Garder les streams \`?live=ID\` en premier dans le feed Watch.
- Ne pas supprimer \`activeLives/{liveId}\` dans le flow de fin de live.
- Garder les URLs vidéo mock centralisées dans \`src/data/mockVideoUrls.js\`.
- Google Sign-In utilise popup, pas redirect.
- Le texte UI de l'app reste en anglais.`,
  },
  'ADMIN.md': {
    en: `# Admin — Vuvio

Single entry point for navigating project documentation.

---

## Changelog
→ [\`CHANGELOG.md\`](./CHANGELOG.md) — Work session history: what changed, when, and why.

---

## Sources of Truth

| Topic | Source |
|-------|--------|
| Critical rules for AI agents | [\`AGENTS.md\`](./AGENTS.md) |
| Open tasks and decisions | \`ADMIN.md\` |
| Session history | [\`CHANGELOG.md\`](./CHANGELOG.md) |
| Product and architecture overview | [\`journal.architecture.md\`](./journal.architecture.md) |
| Domain-level technical detail | [\`docs/\`](./docs/) |

---

## Open Tasks

| Priority | Task | Context |
|----------|------|---------|
| High | Merge \`HomePage\` + \`WatchPage\` into shared \`<LiveFeed>\` | Duplicated live feed code, asymmetric bugs |
| High | Decide replay/recording strategy | RTMPS relay reverted on 2026-08-20; Cloudflare WHIP does not record automatically |
| Medium | Rebuild globe clusters | Start from altitude clustering and verify counts after zoom |
| Medium | Migrate gear localStorage → Firestore | Firestore path prepared, migration not done |
| Low | i18n extraction — 350+ hardcoded strings | Not planned yet |
| Low | Equipment affiliate tracking | \`affiliateUrl\` exists, backend is missing |
| Low | Firestore messaging | Schema documented, not implemented |

---

## Technical References

| Doc | Content |
|-----|---------|
| [\`AGENTS.md\`](./AGENTS.md) | Critical dev rules, stack, commands |
| [\`journal.architecture.md\`](./journal.architecture.md) | Product vision and detailed architecture |
| [\`docs/\`](./docs/) | Domain docs: analytics, backend, streaming, globe… |
| [\`agents/\`](./agents/) | Market strategy, prospecting, AI agents |

---

**Production URL:** https://vuvio.app`,
  },
  'docs/README.md': {
    fr: `# Vuvio Docs

Ce dossier contient les références techniques et les notes d'implémentation historiques.

Pour comprendre le projet, commencer par :

- [../AGENTS.md](../AGENTS.md) — règles critiques à suivre.
- [../journal.architecture.md](../journal.architecture.md) — source de vérité architecture, décisions et questions ouvertes.
- [../README.md](../README.md) — aperçu court du projet et commandes.
- [vuvio-complete-overview.md](vuvio-complete-overview.md) — référence complète produit, storytelling, architecture, business model et roadmap.
- [../Vuvio_Inspirations_Strava_Polarsteps.md](../Vuvio_Inspirations_Strava_Polarsteps.md) — inspirations pour Experiences, Adventures, mémoire de profil et découverte géographique.

## Classification Admin Docs

Admin Docs classe les fichiers Markdown via leur chemin et leurs métadonnées en haut du fichier.

Ajouter \`Status:\` tout en haut d'un fichier Markdown pour le marquer comme classé :

\`\`\`md
Status: Current
Read before coding: Source of truth before touching GlobeTest2 behavior.

# Globe Test 2
\`\`\`

Conventions de statut :

- \`Status: Current\` — source de vérité active.
- \`Status: Current index\` — index actif d'un dossier.
- \`Status: Partially current\` — utile, mais vérifier le code avant de s'appuyer dessus.
- \`Status: Historical note\` — contexte conservé, pas comportement courant.
- \`Status: Requires verification\` — nécessite une vérification produit ou code.

\`Read before coding:\` est optionnel. Si présent, le fichier remonte dans "À lire avant de coder".

Le domaine est déduit du dossier : \`docs/globe/\`, \`docs/backend/\`, \`docs/streaming/\`, \`docs/analytics/\`, \`docs/gear/\`, \`docs/products/\`, \`docs/i18n/\`, \`docs/ops/\`, \`docs/archive/\`.

Les fichiers racine du Centre de commande ont chacun un rôle clair : \`README.md\` pour l'entrée projet, \`ADMIN.md\` pour les tâches, \`CHANGELOG.md\` pour l'historique, \`AGENTS.md\` pour les règles, \`journal.architecture.md\` pour la vision, et \`Vuvio_Inspirations_Strava_Polarsteps.md\` pour les inspirations produit.

## Guides par domaine

- [backend/](backend/) — backend, Firestore, messaging et lifecycle stream.
- [analytics/](analytics/) — architecture analytics, audit, statut et intégration.
- [gear/](gear/) — système d'équipement créateur.
- [products/](products/) — catalogue produit, Icecat, thumbnails et affiliation.
- [streaming/](streaming/) — relay, live/replay pipeline, Cloudflare, highlights.
- [globe/](globe/) — notes d'expérimentation globe.
- [i18n/](i18n/) — audit internationalisation.
- [ops/](ops/) — corrections de déploiement et notes opérationnelles.

## Notes historiques

Les notes de phases et correctifs ponctuels vivent dans [archive/](archive/). Les traiter comme contexte historique, pas comme source de vérité actuelle.`,
  },
};

function t(value, lang) {
  if (typeof value === 'string') return value;
  return value?.[lang] || value?.en || '';
}

const STATUS_TRANSLATIONS = {
  Current: { fr: 'Actuel' },
  'Current index': { fr: 'Index actuel' },
  'Partially current': { fr: 'Partiellement actuel' },
  'Historical note': { fr: 'Note historique' },
  'Requires verification': { fr: 'À vérifier' },
  'Globe experiment note, partially current': { fr: 'Note expérimentation globe, partiellement actuelle' },
  'Architecture reference, partially current': { fr: 'Référence architecture, partiellement actuelle' },
  'Integration reference': { fr: 'Référence intégration' },
  'Backend implementation guide, requires current-code verification': { fr: 'Guide backend, nécessite vérification du code actuel' },
  'Product-system quickstart, partially current': { fr: 'Quickstart produits, partiellement actuel' },
  'Historical status report, partially current': { fr: 'Rapport historique, partiellement actuel' },
  'MVP testing quickstart, partially current': { fr: 'Quickstart test MVP, partiellement actuel' },
  'Product-system reference, partially current': { fr: 'Référence produits, partiellement actuelle' },
  'Integration reference, requires credential and current-code verification': { fr: 'Référence intégration, nécessite identifiants et vérification code' },
  'MVP implementation reference, partially current': { fr: 'Référence implémentation MVP, partiellement actuelle' },
};

const READ_SIGNAL_TRANSLATIONS = {
  'Check open tasks and current project decisions before changing docs, admin, globe, or streaming behavior.': {
    fr: 'Vérifier les tâches ouvertes et décisions actuelles avant de modifier docs, admin, globe ou streaming.',
  },
  'Required before editing core app behavior, streaming, replay, auth, deployment, or Firebase logic.': {
    fr: 'Obligatoire avant de modifier le comportement coeur, streaming, replay, auth, déploiement ou Firebase.',
  },
  'Product and architecture context for major UX, backend, streaming, monetization, and roadmap changes.': {
    fr: 'Contexte produit et architecture pour les changements UX, backend, streaming, monétisation et roadmap.',
  },
  'Product inspiration reference for Experiences, Adventures, profile memory, and geographic discovery.': {
    fr: 'Référence d\'inspiration produit pour Experiences, Adventures, mémoire de profil et découverte géographique.',
  },
};

function normalizePath(path) {
  return path.replace('../../', '');
}

function getDomain(path) {
  if (!path.startsWith('docs/')) return 'root';
  const part = path.split('/')[1];
  return DOMAIN_META[part] ? part : 'root';
}

function getTitle(markdown, path) {
  const match = markdown.match(/^#\s+(.+)$/m);
  if (match) return stripMarkdown(match[1]);
  return path.split('/').pop().replace(/\.md$/, '').replaceAll('-', ' ');
}

function getStatus(markdown, domain) {
  const status = markdown.match(/^Status:\s*(.+)$/m)?.[1]
    || markdown.match(/^\*\*(?:Overall Status|Status|Original status):\*\*\s*(.+)$/m)?.[1];
  if (status) return stripMarkdown(status).replace(/[✅🟡🔜⏸️❌✓🚀]/g, '').trim();
  return domain === 'archive' ? 'Historical' : 'Unlabeled';
}

function formatStatus(status, lang) {
  if (status === 'Unlabeled') return COPY[lang].unlabeled;
  if (status === 'Historical') return COPY[lang].historical;
  if (lang === 'fr' && STATUS_TRANSLATIONS[status]?.fr) return STATUS_TRANSLATIONS[status].fr;
  return status;
}

function formatReadSignal(signal, lang) {
  if (lang === 'fr' && READ_SIGNAL_TRANSLATIONS[signal]?.fr) return READ_SIGNAL_TRANSLATIONS[signal].fr;
  return signal;
}

function getDocKind(doc) {
  const status = doc.status.toLowerCase();
  if (doc.domain === 'archive' || status.includes('historical')) return 'archive';
  if (status.includes('requires verification') || status.includes('partially current')) return 'review';
  if (doc.isIndex) return 'index';
  if (status.includes('current')) return 'truth';
  return 'reference';
}

function formatDocKind(kind, lang) {
  const copy = COPY[lang];
  return {
    archive: copy.archiveDoc,
    review: copy.reviewDoc,
    index: copy.indexDoc,
    truth: copy.sourceOfTruth,
    reference: copy.referenceDoc,
  }[kind] || copy.referenceDoc;
}

function getReadSignal(markdown) {
  return markdown.match(/^Read before coding:\s*(.+)$/m)?.[1]?.trim() || null;
}

function getDescription(markdown) {
  const lines = markdown.split('\n').map((line) => line.trim());
  for (const line of lines) {
    if (!line || line.startsWith('#') || line.startsWith('Status:') || line.startsWith('Last reviewed:') || line.startsWith('Read before coding:')) continue;
    if (line.startsWith('-') || line.startsWith('>')) continue;
    return stripMarkdown(line).slice(0, 180);
  }
  return 'Documentation reference.';
}

function stripMarkdown(text) {
  return text
    .replace(/[`*_#>]/g, '')
    .replace(/\[(.*?)\]\((.*?)\)/g, '$1')
    .trim();
}

function parseAdminTasks(markdown) {
  const section = markdown.match(/##\s+Tâches ouvertes[\s\S]*?(?=\n##\s|\n---\s*$|$)/)?.[0] || '';
  const rows = section.split('\n').filter((line) => /^\|\s*[🔴🟡🟠]/.test(line));
  return rows.map((row) => {
    const cells = row.split('|').map((c) => c.trim()).filter(Boolean);
    const priorityRaw = cells[0] || '';
    const title = stripMarkdown(cells[1] || '');
    const context = stripMarkdown(cells[2] || '');
    const priority = priorityRaw.includes('🔴') ? 'high' : priorityRaw.includes('🟡') ? 'medium' : 'low';
    return {
      priority,
      area: '',
      title,
      context,
      status: priority === 'high' ? 'Open' : 'Later',
      source: 'ADMIN.md',
    };
  });
}

function makeDocs() {
  const mdDocs = Object.entries(docModules).map(([modulePath, content]) => {
    const path = normalizePath(modulePath);
    const domain = getDomain(path);
    const isIndex = path.endsWith('/README.md') || ['README.md', 'AGENTS.md', 'journal.architecture.md'].includes(path);
    return {
      id: path,
      path,
      content,
      domain,
      isIndex,
      title: getTitle(content, path),
      status: getStatus(content, domain),
      readSignal: getReadSignal(content),
      description: getDescription(content),
      headings: [...content.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => stripMarkdown(match[1])).slice(0, 8),
      wordCount: content.trim().split(/\s+/).filter(Boolean).length,
    };
  });
  return [...mdDocs, ...STATIC_HTML_DOCS].sort((a, b) => {
    const domainDelta = PRIORITY_ORDER.indexOf(a.domain) - PRIORITY_ORDER.indexOf(b.domain);
    if (domainDelta !== 0) return domainDelta;
    if (a.isIndex !== b.isIndex) return a.isIndex ? -1 : 1;
    return a.title.localeCompare(b.title);
  });
}

function getDocContent(docs, path, lang) {
  const doc = docs.find((item) => item.path === path);
  return LOCALIZED_DOCS[path]?.[lang] || doc?.content || '';
}

function resolveDocHref(currentPath, href) {
  if (!href || /^(https?:|mailto:|tel:|#)/i.test(href)) return null;

  const cleanHref = decodeURIComponent(href).split('#')[0].split('?')[0];
  if (!cleanHref) return null;

  if (cleanHref.startsWith('/')) {
    const candidate = cleanHref.replace(/^\/+/, '');
    return candidate || null;
  }

  // Resolve all relative paths (with or without ./ prefix) against current doc's directory
  const base = currentPath.includes('/') ? currentPath.split('/').slice(0, -1) : [];
  const parts = [...base, ...cleanHref.split('/')];
  const resolved = [];
  parts.forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') { resolved.pop(); return; }
    resolved.push(part);
  });
  let candidate = resolved.join('/');

  if (candidate.endsWith('/')) candidate += 'README.md';
  if (!candidate.endsWith('.md') && candidate.startsWith('docs/')) candidate = `${candidate}/README.md`;

  return candidate || null;
}

function parseChangelog(markdown) {
  const sections = markdown.split(/\n(?=##\s+)/).filter((section) => /^##\s+/.test(section.trim()));
  return sections.map((section) => {
    const lines = section.trim().split('\n');
    const heading = stripMarkdown(lines[0].replace(/^##\s+/, ''));
    const dateMatch = heading.match(/^(\d{4}-\d{2}-\d{2})\s+[-—]\s+(.+)$/);
    const metaLine = lines.find((line) => line.trim().startsWith('`')) || '';
    const type = metaLine.match(/`([^`]+)`/)?.[1] || 'Docs';
    const files = [...section.matchAll(/`([^`]+\.(?:jsx|tsx|ts|js|css|md))`/g)]
      .map((match) => match[1])
      .filter((file, index, list) => list.indexOf(file) === index)
      .slice(0, 5);
    const bodyLine = lines.find((line) => {
      const trimmed = line.trim();
      return trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('`') && !trimmed.startsWith('-') && !trimmed.startsWith('---');
    });

    return {
      date: dateMatch?.[1] || '',
      type,
      title: dateMatch?.[2] || heading,
      body: bodyLine ? stripMarkdown(bodyLine).replace(/^(Problem|Problème|Context|Contexte|Finding|Constat)\s*:\s*/i, '') : '',
      files,
    };
  }).filter((item) => item.title && item.date);
}

function escapeHtml(text) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function formatInline(text) {
  return escapeHtml(text)
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>');
}

function markdownToHtml(markdown) {
  const lines = markdown.split('\n');
  let html = '';
  let inList = false;
  let inOrderedList = false;
  let inCodeBlock = false;
  let code = '';

  const closeLists = () => {
    if (inList) html += '</ul>';
    if (inOrderedList) html += '</ol>';
    inList = false;
    inOrderedList = false;
  };
  let inTable = false;

  const closeTable = () => {
    if (inTable) html += '</div>';
    inTable = false;
  };

  const closeBlocks = () => {
    closeLists();
    closeTable();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith('```')) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(code.replace(/\n$/, ''))}</code></pre>`;
        code = '';
        inCodeBlock = false;
      } else {
        closeBlocks();
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      code += `${rawLine}\n`;
      continue;
    }

    if (!line.trim()) {
      closeBlocks();
      continue;
    }

    if (line.trim() === '---') {
      closeBlocks();
      html += '<hr>';
      continue;
    }

    if (line.startsWith('# ')) {
      closeBlocks();
      html += `<h1>${formatInline(line.slice(2))}</h1>`;
      continue;
    }

    if (line.startsWith('## ')) {
      closeBlocks();
      html += `<h2>${formatInline(line.slice(3))}</h2>`;
      continue;
    }

    if (line.startsWith('### ')) {
      closeBlocks();
      html += `<h3>${formatInline(line.slice(4))}</h3>`;
      continue;
    }

    if (line.startsWith('>')) {
      closeBlocks();
      html += `<blockquote>${formatInline(line.replace(/^>\s?/, ''))}</blockquote>`;
      continue;
    }

    if (/^\|.+\|$/.test(line)) {
      const cells = line.split('|').map((cell) => cell.trim()).filter(Boolean);
      if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
      closeLists();
      if (!inTable) {
        html += '<div class="admin-docs-md__table">';
        inTable = true;
      }
      html += `<div class="admin-docs-md__table-row" style="--table-cols:${cells.length}">${cells.map((cell) => `<span>${formatInline(cell)}</span>`).join('')}</div>`;
      continue;
    }

    if (/^[-*]\s+/.test(line.trim())) {
      closeTable();
      if (!inList) {
        closeLists();
        html += '<ul>';
        inList = true;
      }
      html += `<li>${formatInline(line.trim().replace(/^[-*]\s+/, ''))}</li>`;
      continue;
    }

    if (/^\d+\.\s+/.test(line.trim())) {
      closeTable();
      if (!inOrderedList) {
        closeLists();
        html += '<ol>';
        inOrderedList = true;
      }
      html += `<li>${formatInline(line.trim().replace(/^\d+\.\s+/, ''))}</li>`;
      continue;
    }

    closeBlocks();
    html += `<p>${formatInline(line)}</p>`;
  }

  closeBlocks();
  return html;
}

function DomainIcon({ domain, size = 18 }) {
  const Icon = DOMAIN_META[domain]?.icon || FileText;
  return <Icon size={size} strokeWidth={1.8} />;
}

function getLocalizedDocTitle(doc, lang) {
  const title = LOCALIZED_DOCS[doc.path]?.[lang]?.match(/^#\s+(.+)$/m)?.[1];
  return title ? stripMarkdown(title) : doc.title;
}

function getDocRole(doc, lang) {
  const role = DOC_ROLES[doc.path];
  if (role) return t(role, lang);

  const domain = t(DOMAIN_META[doc.domain]?.label, lang);
  const kind = formatDocKind(getDocKind(doc), lang);
  return `${domain} · ${kind}`;
}

function DocCard({ doc, active, onSelect, lang }) {
  const meta = DOMAIN_META[doc.domain] || DOMAIN_META.root;
  const kind = getDocKind(doc);

  return (
    <button
      type="button"
      className={`admin-docs-card ${active ? 'is-active' : ''}`}
      onClick={() => onSelect(doc.id)}
      style={{ '--doc-accent': meta.accent }}
    >
      <span className="admin-docs-card__icon">
        <DomainIcon domain={doc.domain} size={17} />
      </span>
      <span className="admin-docs-card__body">
        <strong>{getLocalizedDocTitle(doc, lang)}</strong>
        <small>{getDocRole(doc, lang)}</small>
        <em>{doc.path}</em>
      </span>
      <span className={`admin-docs-card__kind admin-docs-card__kind--${kind}`}>{formatDocKind(kind, lang)}</span>
      <span className="admin-docs-card__status">{formatStatus(doc.status, lang)}</span>
    </button>
  );
}

function DomainRail({ domains, activeDomain, onSelect, lang }) {
  return (
    <nav className="admin-docs-rail" aria-label={COPY[lang].domainNavLabel}>
      {domains.map((domain) => {
        const meta = DOMAIN_META[domain.id] || DOMAIN_META.root;
        const Icon = meta.icon;
        return (
          <button
            key={domain.id}
            type="button"
            className={`admin-docs-domain ${activeDomain === domain.id ? 'is-active' : ''}`}
            onClick={() => onSelect(domain.id)}
            style={{ '--doc-accent': meta.accent }}
          >
            <span><Icon size={17} strokeWidth={1.8} /></span>
            <strong>{t(meta.label, lang)}</strong>
            <small>{domain.count}</small>
          </button>
        );
      })}
    </nav>
  );
}

function PriorityBadge({ priority, lang }) {
  return <span className={`admin-docs-priority admin-docs-priority--${priority}`}>{COPY[lang][priority]}</span>;
}

function MetricPanel({ label, value, detail }) {
  return (
    <article className="admin-docs-metric">
      <strong>{value}</strong>
      <span>{label}</span>
      {detail ? <small>{detail}</small> : null}
    </article>
  );
}

function TaskTable({ tasks, lang }) {
  return (
    <div className="admin-docs-task-table">
      {tasks.map((task, index) => (
        <article key={`${task.source}-${task.area}-${task.priority}-${t(task.title, lang)}-${index}`} className="admin-docs-task-row">
          <div>
            <PriorityBadge priority={task.priority} lang={lang} />
            <span>{task.area}</span>
          </div>
          <div>
            <h3>{t(task.title, lang)}</h3>
            <p>{t(task.context, lang)}</p>
          </div>
          <div>
            <strong>{formatTaskStatus(task.status, lang)}</strong>
            <small>{task.source}</small>
          </div>
        </article>
      ))}
    </div>
  );
}

function formatTaskStatus(status, lang) {
  if (lang !== 'fr') return t(status, lang);
  if (status === 'Open') return 'Ouvert';
  if (status === 'Later') return 'Plus tard';
  return t(status, lang);
}

function HistoryTimeline({ items }) {
  return (
    <div className="admin-docs-timeline">
      {items.map((item) => (
        <article key={`${item.date}-${item.title}`} className="admin-docs-history-item">
          <time>{item.date}</time>
          <div>
            <span>{typeof item.type === 'string' ? item.type : t(item.type, 'en')}</span>
            <h3>{typeof item.title === 'string' ? item.title : t(item.title, 'en')}</h3>
            <p>{typeof item.body === 'string' ? item.body : t(item.body, 'en')}</p>
            {item.files.length ? <small>{item.files.join(' · ')}</small> : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function SourceTruthGrid({ lang }) {
  return (
    <div className="admin-docs-source-grid">
      {SOURCE_TRUTH.map((item) => (
        <article key={item.source}>
          <span>{t(item.topic, lang)}</span>
          <strong>{item.source}</strong>
        </article>
      ))}
    </div>
  );
}

function SectionHeader({ eyebrow, title, action }) {
  return (
    <div className="admin-docs-section-head">
      <div>
        <span>{eyebrow}</span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function OverviewPanel({ lang, docs, currentWithStatus, historyItems, onOpenDocs }) {
  const copy = COPY[lang];
  const highTasks = ADMIN_TASKS.filter((task) => task.priority === 'high');
  const readBeforeCoding = docs.filter((doc) => doc.readSignal && doc.domain !== 'archive').slice(0, 4);
  const docsToReview = docs.filter((doc) => getDocKind(doc) === 'review');
  const latestHistory = historyItems[0] || FALLBACK_HISTORY_ITEMS[0];

  return (
    <div className="admin-docs-dashboard">
      <section className="admin-docs-metrics">
        <MetricPanel label={copy.openTasks} value={ADMIN_TASKS.length} detail={`${highTasks.length} ${copy.high}`} />
        <MetricPanel label={copy.recentWork} value={latestHistory.date} detail={typeof latestHistory.title === 'string' ? latestHistory.title : t(latestHistory.title, lang)} />
        <MetricPanel label={copy.activeDocs} value={docs.filter((doc) => doc.domain !== 'archive').length} detail={`${currentWithStatus} ${copy.labeled}`} />
        <MetricPanel label={copy.needsReview} value={docsToReview.length} detail={copy.reviewDocs} />
      </section>

      <section className="admin-docs-dashboard-grid">
        <article className="admin-docs-panel admin-docs-panel--wide">
          <SectionHeader eyebrow={copy.nextWork} title={copy.openTasks} />
          <TaskTable tasks={ADMIN_TASKS.slice(0, 5)} lang={lang} />
        </article>

        <article className="admin-docs-panel">
          <SectionHeader eyebrow={copy.latestSession} title={typeof latestHistory.title === 'string' ? latestHistory.title : t(latestHistory.title, lang)} />
          <HistoryTimeline items={historyItems.slice(0, 3)} />
        </article>

        <article className="admin-docs-panel">
          <SectionHeader eyebrow={copy.source} title={copy.sourceTruth} />
          <SourceTruthGrid lang={lang} />
        </article>

        <article className="admin-docs-panel">
          <SectionHeader
            eyebrow={copy.docs}
            title={copy.readBeforeCoding}
            action={<button type="button" onClick={onOpenDocs}>{copy.viewDocs}</button>}
          />
          <div className="admin-docs-read-list">
            {readBeforeCoding.map((doc) => (
              <div key={doc.id}>
                <strong>{getLocalizedDocTitle(doc, lang)}</strong>
                <span>{doc.path}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="admin-docs-panel">
          <SectionHeader eyebrow={copy.status} title={copy.reviewDocs} />
          <div className="admin-docs-read-list">
            {docsToReview.slice(0, 4).map((doc) => (
              <div key={doc.id}>
                <strong>{getLocalizedDocTitle(doc, lang)}</strong>
                <span>{doc.path}</span>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}

function RulesPanel({ lang }) {
  const copy = COPY[lang];
  return (
    <div className="admin-docs-dashboard">
      <section className="admin-docs-dashboard-grid admin-docs-dashboard-grid--rules">
        {CRITICAL_RULES.map((rule) => (
          <article key={rule.title.en} className="admin-docs-panel">
            <SectionHeader eyebrow={t(rule.domain, lang)} title={t(rule.title, lang)} />
            <p className="admin-docs-panel-copy">{t(rule.body, lang)}</p>
          </article>
        ))}
      </section>
      <article className="admin-docs-panel">
        <SectionHeader eyebrow={copy.criticalDecisions} title="AGENTS.md" />
        <p className="admin-docs-panel-copy">
          {lang === 'fr'
            ? 'Les règles complètes restent dans AGENTS.md. Cette vue sert de rappel rapide avant de modifier le streaming, les replays, la navigation Watch ou les Functions.'
            : 'Full rules stay in AGENTS.md. This view is a quick reminder before changing streaming, replay, Watch navigation, or Functions code.'}
        </p>
      </article>
    </div>
  );
}

const TIER_COLOR = {
  trusted: '#89f0a8',
  standard: '#35e3dc',
  new: '#94a3b8',
  'at-risk': '#ffd166',
  suspended: '#fca5a5',
};

function TierBadge({ tier }) {
  return (
    <span style={{
      background: `${TIER_COLOR[tier] ?? '#94a3b8'}22`,
      color: TIER_COLOR[tier] ?? '#94a3b8',
      border: `1px solid ${TIER_COLOR[tier] ?? '#94a3b8'}55`,
      borderRadius: 6,
      padding: '2px 8px',
      fontSize: 11,
      fontWeight: 600,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
    }}>{tier ?? 'unscored'}</span>
  );
}

function ModerationPanel() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    getDocs(query(collection(db, 'users'), orderBy('trustScore', 'desc')))
      .then((snap) => {
        setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    if (filter === 'all') return users;
    return users.filter((u) => u.trustTier === filter);
  }, [users, filter]);

  const counts = useMemo(() => ({
    trusted: users.filter((u) => u.trustTier === 'trusted').length,
    standard: users.filter((u) => u.trustTier === 'standard').length,
    new: users.filter((u) => u.trustTier === 'new').length,
    'at-risk': users.filter((u) => u.trustTier === 'at-risk').length,
    suspended: users.filter((u) => u.trustTier === 'suspended').length,
    unscored: users.filter((u) => !u.trustTier).length,
  }), [users]);

  return (
    <main className="admin-docs-dashboard">
      <section className="admin-docs-metrics">
        <MetricPanel label="Total users" value={users.length} />
        <MetricPanel label="Trusted" value={counts.trusted} detail={`${counts.standard} standard`} />
        <MetricPanel label="At-risk" value={counts['at-risk']} detail={`${counts.suspended} suspended`} />
        <MetricPanel label="Unscored" value={counts.unscored} detail="no live yet" />
      </section>

      <article className="admin-docs-panel">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {['all', 'trusted', 'standard', 'new', 'at-risk', 'suspended'].map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setFilter(t)}
              style={{
                padding: '4px 12px',
                borderRadius: 6,
                border: '1px solid',
                borderColor: filter === t ? (TIER_COLOR[t] ?? '#35e3dc') : 'rgba(255,255,255,0.1)',
                background: filter === t ? `${TIER_COLOR[t] ?? '#35e3dc'}22` : 'transparent',
                color: filter === t ? (TIER_COLOR[t] ?? '#35e3dc') : 'rgba(255,255,255,0.5)',
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {t} {t !== 'all' ? `(${counts[t] ?? 0})` : `(${users.length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <p style={{ color: 'rgba(255,255,255,0.4)', padding: '24px 0' }}>Loading…</p>
        ) : (
          <div className="admin-docs-task-table">
            {filtered.map((u) => (
              <article key={u.id} className="admin-docs-task-row">
                <div>
                  <TierBadge tier={u.trustTier} />
                </div>
                <div>
                  <h3 style={{ margin: 0 }}>{u.displayName || u.username || u.id}</h3>
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.5 }}>{u.id}</p>
                </div>
                <div>
                  <strong style={{ fontSize: 20, color: TIER_COLOR[u.trustTier] ?? '#94a3b8' }}>
                    {u.trustScore ?? '—'}
                  </strong>
                  <small>{u.trustUpdatedAt?.toDate?.()?.toLocaleDateString() ?? 'never'}</small>
                </div>
              </article>
            ))}
            {filtered.length === 0 && (
              <p style={{ color: 'rgba(255,255,255,0.3)', padding: '24px 0' }}>No users in this tier.</p>
            )}
          </div>
        )}
      </article>
    </main>
  );
}

export default function AdminDocsPage() {
  const { user, authLoading } = useAuth();
  const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);
  const isLocalDev = import.meta.env.DEV || isLocalHost;
  const docs = useMemo(() => makeDocs(), []);
  const [lang, setLang] = useState('en');
  const [activeDomain, setActiveDomain] = useState('root');
  const [activeView, setActiveView] = useState('overview');
  const [query, setQuery] = useState('');
  const [showArchive, setShowArchive] = useState(false);
  const [selectedId, setSelectedId] = useState(() => docs.find((doc) => doc.path === 'ADMIN.md')?.id || docs[0]?.id);

  const isAdmin = isLocalDev || user?.email?.endsWith('@vuvio.app') || user?.email === 'alexandre.ranson@gmail.com' || user?.email === 'doug.benchetrit@gmail.com' || user?.email === 'cecilia.ranson@outlook.com' || user?.email === 'christophe.ranson@gmail.com';

  const domains = useMemo(() => {
    const counts = docs.reduce((acc, doc) => {
      if (doc.domain === 'archive' && !showArchive) return acc;
      acc[doc.domain] = (acc[doc.domain] || 0) + 1;
      return acc;
    }, {});
    return PRIORITY_ORDER.filter((id) => counts[id]).map((id) => ({ id, count: counts[id] }));
  }, [docs, showArchive]);

  const filteredDocs = useMemo(() => {
    const q = query.trim().toLowerCase();
    return docs.filter((doc) => {
      if (doc.domain === 'archive' && !showArchive) return false;
      const domainMatch = activeDomain === 'all' || doc.domain === activeDomain;
      const queryMatch = !q || `${doc.title} ${doc.path} ${doc.status} ${doc.description} ${doc.headings.join(' ')}`.toLowerCase().includes(q);
      return domainMatch && queryMatch;
    });
  }, [activeDomain, docs, query, showArchive]);

  const selectedDoc = docs.find((doc) => doc.id === selectedId) || filteredDocs[0] || docs[0];
  const selectedMeta = DOMAIN_META[selectedDoc?.domain] || DOMAIN_META.root;
  const selectedContent = LOCALIZED_DOCS[selectedDoc?.path]?.[lang] || selectedDoc?.content || '';
  const selectedTitle = getLocalizedDocTitle(selectedDoc, lang);
  const rendered = useMemo(() => selectedContent ? markdownToHtml(selectedContent) : '', [selectedContent]);
  const selectedHeadings = useMemo(
    () => [...selectedContent.matchAll(/^#{2,3}\s+(.+)$/gm)].map((match) => stripMarkdown(match[1])).slice(0, 8),
    [selectedContent],
  );
  const currentDocs = docs.filter((doc) => doc.domain !== 'archive');
  const currentWithStatus = currentDocs.filter((doc) => doc.status !== 'Unlabeled').length;
  const copy = COPY[lang];
  const changelogContent = getDocContent(docs, 'CHANGELOG.md', lang);
  const historyItems = useMemo(() => parseChangelog(changelogContent), [changelogContent]);

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

  const openDocPath = (path) => {
    const doc = docs.find((item) => item.path === path);
    if (!doc) return false;
    setSelectedId(doc.id);
    setActiveView('docs');
    setActiveDomain(doc.domain);
    return true;
  };

  const handleMarkdownClick = (event) => {
    const link = event.target.closest?.('a');
    if (!link) return;

    const href = link.getAttribute('href');
    const path = resolveDocHref(selectedDoc.path, href);
    if (!path) return;

    if (openDocPath(path)) {
      event.preventDefault();
    }
  };

  const docsBrowser = (
    <section className="admin-docs-shell">
      <aside className="admin-docs-sidebar">
        <div className="admin-docs-search">
          <Search size={16} strokeWidth={1.8} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={copy.searchPlaceholder}
          />
        </div>

        <button
          type="button"
          className={`admin-docs-domain admin-docs-domain--all ${activeDomain === 'all' ? 'is-active' : ''}`}
          onClick={() => setActiveDomain('all')}
        >
          <span><BookOpen size={17} strokeWidth={1.8} /></span>
          <strong>{copy.allCurrent}</strong>
          <small>{currentDocs.length}</small>
        </button>

        <DomainRail domains={domains} activeDomain={activeDomain} onSelect={setActiveDomain} lang={lang} />

        <label className="admin-docs-toggle">
          <input type="checkbox" checked={showArchive} onChange={(event) => setShowArchive(event.target.checked)} />
          <span>{copy.includeArchive}</span>
        </label>
      </aside>

      <div className="admin-docs-list" aria-label={copy.documentListLabel}>
        <div className="admin-docs-list__header">
          <strong>{filteredDocs.length} {copy.documents}</strong>
          <span>{activeDomain === 'all' ? copy.allDomains : t(DOMAIN_META[activeDomain]?.label, lang)}</span>
        </div>
        {filteredDocs.map((doc) => (
          <DocCard key={doc.id} doc={doc} active={selectedDoc?.id === doc.id} onSelect={setSelectedId} lang={lang} />
        ))}
      </div>

      <main className="admin-docs-reader" style={{ '--doc-accent': selectedMeta.accent }}>
        <div className="admin-docs-reader__topline">
          <span><DomainIcon domain={selectedDoc.domain} size={16} /> {t(selectedMeta.label, lang)}</span>
          <span>{selectedDoc.wordCount.toLocaleString()} {copy.words}</span>
        </div>

        <div className="admin-docs-reader__title">
          <div>
            <p>{selectedDoc.path}</p>
            <h2>{selectedTitle}</h2>
          </div>
          <span>{formatStatus(selectedDoc.status, lang)}</span>
        </div>

        {selectedDoc.path === 'docs/business/previsionnel-2027-2029.md' && (
          <FinancialForecastViewer url={import.meta.env.VITE_FINANCIAL_FORECAST_URL} lang={lang} />
        )}

        {selectedDoc.readSignal ? (
          <div className="admin-docs-reader__signal">
            <CheckCircle2 size={17} strokeWidth={1.9} />
            <span>{formatReadSignal(selectedDoc.readSignal, lang)}</span>
          </div>
        ) : null}

        {selectedHeadings.length ? (
          <div className="admin-docs-outline" aria-label={copy.outlineLabel}>
            {selectedHeadings.map((heading, index) => <span key={`${heading}-${index}`}>{heading}</span>)}
          </div>
        ) : null}

        {selectedDoc.htmlSrc ? (
          <iframe
            src={selectedDoc.htmlSrc}
            title={selectedTitle}
            style={{ width: '100%', height: '72vh', border: 'none', borderRadius: 8, background: '#fff' }}
          />
        ) : (
          <article
            className="admin-docs-md"
            onClick={handleMarkdownClick}
            dangerouslySetInnerHTML={{ __html: rendered }}
          />
        )}
      </main>
    </section>
  );

  return (
    <section className="admin-docs" aria-label={copy.aria}>
      <a href="/watch" title="Fermer" style={{ position: 'fixed', top: 16, right: 16, zIndex: 999, width: 36, height: 36, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.6)', fontSize: 18, textDecoration: 'none', lineHeight: 1 }}>✕</a>
      <header className="admin-docs-hero">
        <div className="admin-docs-hero__copy">
          <p>{copy.eyebrow}</p>
          <h1>{copy.title}</h1>
          <span>
            {copy.subtitle}
          </span>
        </div>
        <div className="admin-docs-hero__side">
          <div className="admin-docs-language" aria-label={copy.languageNote}>
            <span>{copy.languageNote}</span>
            <div>
              <button type="button" className={lang === 'en' ? 'is-active' : ''} onClick={() => setLang('en')}>EN</button>
              <button type="button" className={lang === 'fr' ? 'is-active' : ''} onClick={() => setLang('fr')}>FR</button>
            </div>
            <small>{copy.contentNote}</small>
          </div>
          <div className="admin-docs-actions">
            <a href="/admin/docs" className="is-active">{copy.openDocs}</a>
            <a href="/admin/marketing">Marketing</a>
            <a href="/admin/investor-crm">Investor CRM</a>
            <a href="/admin/analytics">{copy.openAnalytics}</a>
          </div>
          <div className="admin-docs-hero__score">
            <strong>{currentWithStatus}/{currentDocs.length}</strong>
            <span>{copy.scoreLabel}</span>
          </div>
        </div>
      </header>

      <nav className="admin-docs-tabs" aria-label={copy.tabsLabel}>
        {ADMIN_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={activeView === tab.id ? 'is-active' : ''}
              onClick={() => setActiveView(tab.id)}
            >
              <Icon size={16} strokeWidth={1.9} />
              <span>{t(tab.label, lang)}</span>
            </button>
          );
        })}
      </nav>

      {activeView === 'overview' ? (
        <OverviewPanel lang={lang} docs={docs} currentWithStatus={currentWithStatus} historyItems={historyItems} onOpenDocs={() => setActiveView('docs')} />
      ) : null}

      {activeView === 'tasks' ? (
        <main className="admin-docs-dashboard">
          <article className="admin-docs-panel">
            <SectionHeader eyebrow={copy.nextWork} title={copy.openTasks} />
            <TaskTable tasks={ADMIN_TASKS} lang={lang} />
          </article>
        </main>
      ) : null}

      {activeView === 'history' ? (
        <main className="admin-docs-dashboard">
          <article className="admin-docs-panel">
            <SectionHeader eyebrow={copy.recentWork} title={copy.history} />
            <HistoryTimeline items={historyItems} />
          </article>
        </main>
      ) : null}

      {activeView === 'docs' ? docsBrowser : null}

      {activeView === 'rules' ? <RulesPanel lang={lang} /> : null}
      {activeView === 'moderation' ? <ModerationPanel /> : null}
    </section>
  );
}
