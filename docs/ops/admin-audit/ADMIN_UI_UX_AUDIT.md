# Audit UI/UX

**Mise à jour : 26-27 novembre 2026.** Captures Chrome headless 128 réalisées via CDP/faye-websocket, Vite `127.0.0.1:5190`, Firebase prod configuré, délai 10 s. 24 captures (8 pages × 3 tailles). Aucune auth, donc état non connecté sur les routes nécessitant un vrai `user`.

## Résultats par page

### `/admin/docs` ✅ Rendu complet

**1920 et 1280 :** page entièrement rendue. Disposition bi-colonne (tâches à gauche, Latest Session à droite). Lisible aux deux tailles. Navigation tabbed (Overview / Tasks / History / Docs / Rules / Moderation) visible et fonctionnelle visuellement. Boutons de navigation secondaire (Docs / Marketing / Investor CRM / Analytics Dashboard) présents. KPI header : 13 Open Tasks · 2026-11-24 Recent Work · 86 Active Docs · 7 Needs Review. Compteur "46/86 current docs labeled" dans le panneau droit.

**Problèmes observés :**
- À 1280 px : dense mais lisible, pas d'overflow apparent.
- Bouton fermer (×) en haut à droite redirige vers `/watch`, pas vers un hub Admin.
- "Bonjour Cecilia" hardcodé dans Marketing (pas dans Docs).
- La signification exacte de "46/86 current docs labeled" n'est pas expliquée dans l'UI.
- Langue EN par défaut indépendante de la préférence globale de l'app.

---

### `/admin/analytics` ✅ Rendu, données vides

**1920 et 1280 :** page rendue. Grille KPI website : tous à 0 sauf Registered Users = 60. Conversion : "No data yet". Content : Stream Views 0 · Live Now 0 · Impressions 0 · Engagement Avg 0.0. Tables Top Streams et Top Creators présentes mais vides.

**Problèmes observés :**
- Tous les compteurs de visites à 0 : cohérent avec le bug A03 (filtre Production/Last 7 days + possible écart dev/prod dans `visitorActivity`). Ou absence réelle de données récentes — indiscernable dans l'UI.
- Aucune indication "données absentes" vs "erreur de chargement" — état vide et état d'erreur se ressemblent.
- 1280 px : grille KPI passe sur 2 lignes de 4, lisible.
- Filtre "Production / Last 7 days" : UI sans mention de la cohorte utilisée (bug A01).

---

### `/admin/marketing` ⚠️ Rendu partiel, sections vides sans état explicite

**1920 :** 4 KPI cards (60 Membres · 0 En live · 0 Lives enregistrés · 0 Viewers cumulés), puis deux sections "TOP CRÉATEURS" et "LIVES RÉCENTS" qui affichent uniquement leur titre — aucun contenu, aucun skeleton, aucun message "aucune donnée". Le bas de la page est vide à mi-écran.

**1280 :** rendu responsive correct, même structure.

**Problèmes observés :**
- Sections vides sans état explicite : impossible de distinguer "chargement", "erreur" et "aucun résultat".
- "Bonjour Cecilia" hardcodé — indépendant du compte connecté.
- "Lives enregistrés" label trop optimiste pour 100 docs max (bug A02).
- Grande zone vide sous les cartes sur écran large.

---

### `/admin/business` ⚠️ Bloqué sur chargement

**1920 :** page partiellement rendue. Header "Financial Dashboard / Prévisionnel & métriques financières" visible. Boutons "Sync Now" et "Ouvrir dans Sheets" présents. Corps bloqué sur "• Chargement des données financières..." — Google Sheets API non accessible (credentials absents ou CORS hors prod).

**Problèmes observés :**
- Aucun timeout ni message d'erreur après chargement prolongé.
- Background gradient bleu différent des autres pages admin (incohérence visuelle).
- Impossible de valider les données sans accès Google Sheets.

---

### `/admin/investor-crm` ✅ Rendu riche

**1920 :** page entièrement rendue. Badge "CONFIDENTIEL — ADMIN / FONDATEURS" visible. KPI banner : ~190 HEC profiles · 30-50 k€ target · 150 k€ / 500 k€ Next Rounds · Public-source outreach. Navigation latérale gauche (8 sections : Overview → Quality rules). Contenu de qualification détaillé et structuré.

**Problèmes observés :**
- Titre "CRM" sans aucune fonctionnalité CRM interactive (bug A06 confirmé visuellement).
- Mélange anglais/français dans la page.
- Pas de bouton de navigation vers les autres pages admin dans le header (seulement Docs / Investor CRM / Analytics en haut).

---

### `/admin/realtime-test` ❌ Bug propre au composant

**Toutes tailles :** affiche "Admin access required. Please log in." sur fond sombre vide.

**Cause identifiée :** `AdminRealtimeTestPage.jsx:229` contient son propre guard `if (!user) return <div>Admin access required...</div>`. Contrairement à `AdminRoute` (qui bypasse sur `isLocalDev`), ce composant vérifie `user` directement sans tenir compte de l'environnement local. Sans utilisateur Firebase connecté, la page bloque — même sur `127.0.0.1`.

**Nouveau bug documenté (A11) :** guard interne redondant et incohérent avec `AdminRoute`.

---

### `/internal/streams` ↩️ Redirige vers Login

**Toutes tailles :** page de Login Vuvio rendue (Email + Password + Continue with Google). La route `/internal/streams` est protégée par `ProtectedRoute` (pas `AdminRoute`), donc exige un vrai utilisateur connecté. Sans auth, redirection immédiate.

**Confirme visuellement A05 :** tout utilisateur authentifié peut accéder à l'outil de mutation de streams. La page login elle-même rend correctement.

---

## Tableau de synthèse visuelle

| Page | Rendu | Données | Responsive 1280 | Problèmes visuels |
|---|---|---|---|---|
| `/admin/docs` | ✅ Complet | ✅ Chargées | ✅ OK | "46/86" sans explication ; bouton fermer → Watch |
| `/admin/analytics` | ✅ Complet | ⚠️ Toutes à 0 | ✅ OK | État vide = état erreur visuellement |
| `/admin/marketing` | ⚠️ Partiel | ⚠️ KPI only | ✅ OK | Sections vides sans feedback ; nom hardcodé |
| `/admin/business` | ⚠️ Bloqué | ❌ Loading | Non testé | Pas de timeout/erreur ; fond incohérent |
| `/admin/investor-crm` | ✅ Complet | ✅ Statiques | ✅ OK | Titre CRM sans CRM ; mixte EN/FR |
| `/admin/realtime-test` | ❌ Bloqué | ❌ Aucune | N/A | Bug guard interne (A11) |
| `/internal/streams` | ↩️ Login | N/A | N/A | Accès trop large (A05) |

## Problèmes transverses

- **Navigation Admin incohérente :** certaines pages ont un bouton fermer → `/watch`, d'autres ont un retour historique, certaines n'ont rien. Aucun hub Admin central accessible depuis toutes les pages.
- **États vides non différenciés :** Marketing et Analytics ne distinguent pas "données absentes", "erreur réseau" et "chargement en cours".
- **Familles visuelles multiples :** Docs (`admin-docs.css`), Analytics (`analytics.css`), Marketing (styles inline partiels), Business (`admin-business.css`) — headers, cartes et boutons ont des implémentations séparées.
- **Langue :** Docs a un toggle EN/FR indépendant. Les autres pages sont en FR fixe. Investor CRM mélange les deux.

## Tablette et mobile

Non capturés (CDP limité à desktop dans ce script). À faire manuellement ou avec un script dédié.
