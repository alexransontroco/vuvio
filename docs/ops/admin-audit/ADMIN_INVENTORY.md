# Inventaire Admin

État de `dev` à `71d891b`. Sources : `src/App.jsx`, `src/routes/`, `src/components/admin/`, `functions/src/`, `firestore.rules`.

| Route | Module | Nature | Données / action | Accès UI |
|---|---|---|---|---|
| `/admin` | `App.jsx` | Redirection | `/admin/docs` | Lien Settings |
| `/admin/docs` | `AdminDocsPage.jsx` | Documentation + navigation | Markdown embarqué au build ; vue FinancialForecastViewer | Via `/admin` |
| `/admin/analytics` | `AnalyticsPage.jsx` | Pilotage analytics | Firestore `streamStats`, `creatorStats`, `categoryStats`, `users`, `activeLives`, `visitorActivity`, `websiteStats` | Depuis Docs/Marketing |
| `/admin/marketing` | `AdminMarketingPage.jsx` | Tableau de bord marketing | `creatorStats`, `users`, `activeLives` | Depuis Docs |
| `/admin/business` | `AdminBusinessPage.jsx` | Prévisionnel financier | GET/POST `/api/admin/financial/*`, cache `adminFinancialData/forecast`, Google Sheets | Settings |
| `/admin/investor-crm` | `AdminInvestorCrmPage.jsx` | Brief statique, aucun contact persisté | Constantes locales | Depuis Docs |
| `/admin/realtime-test` | `AdminRealtimeTestPage.jsx` | Laboratoire SFU | Callable `createRealtimeSession`, caméra/micro, diagnostics | URL directe ; aucun lien de menu repéré |
| `/internal/streams` | `InternalStreamAdminPage.jsx` | Console API de test | `streamApi.ts` : création, démarrage, fin, heartbeat, gear, analytics | URL directe ; hors `/admin` |

Composant Admin partagé explicite : `FinancialForecastViewer.jsx`. Les autres pages portent leur propre layout, cartes, navigation et styles. Fichiers CSS principaux : `admin-docs.css`, `analytics.css`, `admin-business.css`, `admin-realtime-test.css`, `internal-stream-admin.css`. **Possibilités de mutualisation :** en-tête, retour, état d’erreur, badge de provenance, tableau et filtres ; d’abord recenser les motifs réellement répétés.

Backend : `functions/src/admin/financialService.ts` lit cinq plages de Google Sheets ; `syncFinancialDataHandler.ts` authentifie puis écrit le cache. `functions/src/index.ts` expose les deux routes financières et des endpoints analytics ; `functions/src/analytics/` gère ingestion et agrégation. Firestore protège les collections statistiques en lecture Admin, interdit leur écriture client. `adminFinancialData` est lu Admin et écrit seulement par SDK serveur.

Fonctionnalités cachées / incomplètes : SFU et console streams par URL ; Investor CRM sans pipeline ; aucun Executive Dashboard dédié ; pas de surface Admin unifiée pour signalements, coûts techniques, feature flags ou tests créateurs dans `dev`. Ces absences ne justifient pas leur création automatique.

Branches observées le 25/11 : `feat/creator-pilots` porte des changements en cours, dont des fichiers non commités ; `codex/market-research-20261125` porte Market Research et traductions. Ce document ne les confond pas avec `dev`.
