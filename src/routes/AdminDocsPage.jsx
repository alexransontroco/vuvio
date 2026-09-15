import {
  Archive,
  BarChart3,
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
  ShieldCheck,
  Wrench,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const docModules = import.meta.glob([
  '../../README.md',
  '../../ADMIN.md',
  '../../CHANGELOG.md',
  '../../AGENTS.md',
  '../../journal.architecture.md',
  '../../docs/**/*.md',
], { query: '?raw', import: 'default', eager: true });

const DOMAIN_META = {
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

const PRIORITY_ORDER = ['root', 'streaming', 'backend', 'analytics', 'gear', 'products', 'globe', 'i18n', 'ops', 'archive'];

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
    subtitle: 'Règles actuelles, docs par domaine, notes historiques et références d’implémentation dans une interface admin unique.',
    scoreLabel: 'docs actuelles qualifiées',
    criticalRules: 'Règles critiques',
    searchPlaceholder: 'Chercher docs, règles, chemins...',
    allCurrent: 'Tout actuel',
    includeArchive: 'Inclure les archives',
    documents: 'documents',
    allDomains: 'Tous les domaines actifs',
    words: 'mots',
    languageNote: 'Langue',
    contentNote: 'Admin et changelog sont bilingues. Les docs techniques gardent leur langue source.',
    openDocs: 'Docs',
    openAnalytics: 'Dashboard analytics',
    domainNavLabel: 'Domaines de documentation',
    documentListLabel: 'Liste des documents',
    outlineLabel: 'Plan du document',
    tabsLabel: 'Sections admin',
    overview: 'Vue d’ensemble',
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
    high: 'haute',
    medium: 'moyenne',
    low: 'basse',
    labeled: 'qualifiées',
    unlabeled: 'Non qualifié',
    historical: 'Historique',
  },
};

const ADMIN_TABS = [
  { id: 'overview', icon: Layers3, label: { en: 'Overview', fr: 'Vue d’ensemble' } },
  { id: 'tasks', icon: ClipboardList, label: { en: 'Tasks', fr: 'Tâches' } },
  { id: 'history', icon: History, label: { en: 'History', fr: 'Historique' } },
  { id: 'docs', icon: BookOpen, label: { en: 'Docs', fr: 'Docs' } },
  { id: 'rules', icon: ShieldCheck, label: { en: 'Rules', fr: 'Règles' } },
];

const ADMIN_TASKS = [
  {
    priority: 'high',
    area: 'Frontend',
    title: { en: 'Extract a shared <LiveFeed>', fr: 'Extraire un <LiveFeed> partagé' },
    context: {
      en: 'HomePage and WatchPage duplicate swipe handlers, equipment sheet logic, and chat behavior.',
      fr: 'HomePage et WatchPage dupliquent les handlers de swipe, le sheet équipement et le chat.',
    },
    status: { en: 'Open', fr: 'Ouvert' },
    source: 'ADMIN.md',
  },
  {
    priority: 'high',
    area: 'Streaming',
    title: { en: 'Decide replay and recording strategy', fr: 'Décider la stratégie replay/enregistrement' },
    context: {
      en: 'RTMPS relay was reverted on 2026-08-20. Current WHIP path must be verified before replay work.',
      fr: 'Le relay RTMPS a été revert le 2026-08-20. Le chemin WHIP actuel doit être vérifié avant les replays.',
    },
    status: { en: 'Decision needed', fr: 'Décision requise' },
    source: 'ADMIN.md',
  },
  {
    priority: 'medium',
    area: 'Globe',
    title: { en: 'Rebuild globe clusters', fr: 'Refaire les clusters du globe' },
    context: {
      en: 'Start from altitude-only clustering and verify counts after zoom.',
      fr: 'Repartir du clustering par altitude et vérifier les counts après zoom.',
    },
    status: { en: 'Open', fr: 'Ouvert' },
    source: 'ADMIN.md',
  },
  {
    priority: 'medium',
    area: 'Gear',
    title: { en: 'Migrate gear from localStorage to Firestore', fr: 'Migrer le gear de localStorage vers Firestore' },
    context: {
      en: 'Firestore path is prepared, but migration is not implemented.',
      fr: 'Le chemin Firestore est préparé, mais la migration n’est pas implémentée.',
    },
    status: { en: 'Open', fr: 'Ouvert' },
    source: 'ADMIN.md',
  },
  {
    priority: 'low',
    area: 'i18n',
    title: { en: 'Extract 350+ hardcoded strings', fr: 'Extraire 350+ chaînes hardcodées' },
    context: {
      en: 'i18next is configured, but many UI strings are still inline.',
      fr: 'i18next est configuré, mais beaucoup de textes UI sont encore inline.',
    },
    status: { en: 'Later', fr: 'Plus tard' },
    source: 'ADMIN.md',
  },
  {
    priority: 'low',
    area: 'Gear',
    title: { en: 'Add equipment affiliate tracking', fr: 'Ajouter le tracking affilié équipement' },
    context: {
      en: 'affiliateUrl exists in the model, but click/commission tracking is missing.',
      fr: 'affiliateUrl existe dans le modèle, mais le tracking clic/commission manque.',
    },
    status: { en: 'Later', fr: 'Plus tard' },
    source: 'ADMIN.md',
  },
  {
    priority: 'low',
    area: 'Messaging',
    title: { en: 'Implement Firestore messaging', fr: 'Implémenter la messagerie Firestore' },
    context: {
      en: 'Schema is documented, implementation is still pending.',
      fr: 'Le schéma est documenté, l’implémentation reste à faire.',
    },
    status: { en: 'Later', fr: 'Plus tard' },
    source: 'docs/backend/messaging-firestore.md',
  },
];

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
      fr: 'Les fichiers Markdown épars ont été consolidés dans un journal d’architecture et un point d’entrée admin.',
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

**Production URL:** https://vuvio-bf328.web.app`,
  },
  'CHANGELOG.md': {
    en: `# Changelog — Vuvio

Work session history, newest first.

---

## 2026-09-09 — Admin docs cockpit redesign
\`UX\` | \`AdminDocsPage.jsx\` \`admin-docs.css\` \`CHANGELOG.md\`

**Context:** The \`/admin/docs\` page was hard to read because it mostly opened as a raw Markdown reader.

**Fix:**
- Added \`Overview\`, \`Tasks\`, \`History\`, \`Docs\`, \`Rules\` tabs
- Promoted open tasks, sources of truth, critical rules, and recent history
- Connected the history timeline directly to \`CHANGELOG.md\`

**Build:** ✓

---

## 2026-09-09 — Mobile equipment scroll fix
\`Bug\` | \`HomePage.jsx\` \`EquipmentKit.jsx\` \`components.css\`

**Problem:** On mobile, scrolling the equipment sheet triggered live feed swipe navigation.

**Cause:** \`HomePage.jsx\` has its own copy of the swipeable live feed and its own \`onPointerDown\`, without protection for the equipment sheet. React portals bubble events through the React tree, so pointer events from the sheet still reached the Home feed handler.

**Fix:**
- \`HomePage.jsx\` \`onPointerDown\`: added \`if (equipmentSheetOpen) return;\` and \`.equipment-viewer-sheet\` to \`closest()\`
- \`HomePage.jsx\` \`onPointerMove\`: added \`if (equipmentSheetOpen || !pointerStart.current) return;\`
- \`EquipmentKit.jsx\`: added \`stopPropagation\` on all pointer events for the sheet container

**Tested:** iPhone

**Technical debt:** \`HomePage\` and \`WatchPage\` duplicate live feed logic → extract a shared \`<LiveFeed>\` component. Tracked in \`ADMIN.md\`.

---

## 2026-09-04 — “Start a live” UX simplification
\`UX\` | \`BottomNav.jsx\` \`components.css\`

**Context:** Make stream launch nearly immediate: + → camera preview → text → category → Go Live.

**Finding:** Most of the work already existed in \`StartLiveFlow\`. Only real change: “More categories” panel now uses a flat alphabetical list instead of Air/Earth/Water group labels.

**Build:** 2475 modules

---

## 2026-09-03 — Docs consolidation + architecture journal
\`Docs\` | \`journal.architecture.md\`

Read memory files and explored the codebase. Consolidated scattered Markdown docs into one architecture journal. Fixed the streaming section after the RTMPS relay revert on 2026-08-20, commit \`6d49ac3\`.

---

## Undocumented sessions — August to September 2026
See \`git log\` for detail: analytics Firestore fixes, RTMPS relay ingest, HLS-first playback, webhook fix, analytics resilient queries.`,
  },
};

function t(value, lang) {
  if (typeof value === 'string') return value;
  return value?.[lang] || value?.en || '';
}

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
  return status;
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

function makeDocs() {
  return Object.entries(docModules).map(([modulePath, content]) => {
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
  }).sort((a, b) => {
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

function DocCard({ doc, active, onSelect, lang }) {
  const meta = DOMAIN_META[doc.domain] || DOMAIN_META.root;

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
        <small>{doc.path}</small>
      </span>
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
      {tasks.map((task) => (
        <article key={`${task.area}-${task.title.en}`} className="admin-docs-task-row">
          <div>
            <PriorityBadge priority={task.priority} lang={lang} />
            <span>{task.area}</span>
          </div>
          <div>
            <h3>{t(task.title, lang)}</h3>
            <p>{t(task.context, lang)}</p>
          </div>
          <div>
            <strong>{t(task.status, lang)}</strong>
            <small>{task.source}</small>
          </div>
        </article>
      ))}
    </div>
  );
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
  const latestHistory = historyItems[0] || FALLBACK_HISTORY_ITEMS[0];

  return (
    <div className="admin-docs-dashboard">
      <section className="admin-docs-metrics">
        <MetricPanel label={copy.openTasks} value={ADMIN_TASKS.length} detail={`${highTasks.length} ${copy.high}`} />
        <MetricPanel label={copy.recentWork} value={latestHistory.date} detail={typeof latestHistory.title === 'string' ? latestHistory.title : t(latestHistory.title, lang)} />
        <MetricPanel label={copy.activeDocs} value={docs.filter((doc) => doc.domain !== 'archive').length} detail={`${currentWithStatus} ${copy.labeled}`} />
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

  const isAdmin = isLocalDev || user?.email?.endsWith('@vuvio.app') || user?.email === 'alexandre.ranson@gmail.com';

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
  const currentDocs = docs.filter((doc) => doc.domain !== 'archive');
  const currentWithStatus = currentDocs.filter((doc) => doc.status !== 'Unlabeled').length;
  const copy = COPY[lang];
  const changelogContent = getDocContent(docs, 'CHANGELOG.md', lang);
  const historyItems = useMemo(() => parseChangelog(changelogContent), [changelogContent]);

  if (authLoading && !isLocalDev) return null;
  if (!user && !isLocalDev) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/watch" replace />;

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

        {selectedDoc.readSignal ? (
          <div className="admin-docs-reader__signal">
            <CheckCircle2 size={17} strokeWidth={1.9} />
            <span>{selectedDoc.readSignal}</span>
          </div>
        ) : null}

        {selectedDoc.headings.length ? (
          <div className="admin-docs-outline" aria-label={copy.outlineLabel}>
            {selectedDoc.headings.map((heading) => <span key={heading}>{heading}</span>)}
          </div>
        ) : null}

        <article
          className="admin-docs-md"
          dangerouslySetInnerHTML={{ __html: rendered }}
        />
      </main>
    </section>
  );

  return (
    <section className="admin-docs" aria-label={copy.aria}>
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
    </section>
  );
}
