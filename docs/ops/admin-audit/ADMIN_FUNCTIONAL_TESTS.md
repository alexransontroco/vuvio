# Matrice de tests fonctionnels

**Mise à jour : 26-27 novembre 2026.** Captures Chrome headless CDP réalisées. Vite `127.0.0.1:5190` opérationnel avec Firebase prod. 24/24 captures produites. Rendu React confirmé sur 6/8 destinations ; 2 bloquées (voir ci-dessous).

**Légende :** ✅ Vérifié par capture · ⚠️ Partiel · ❌ Bloqué · 🔲 Non testé

| Page / contrôle | État au 27/11 | Preuve et test restant |
|---|---|---|
| `/admin` → redirection `/admin/docs` | ✅ Confirmé par capture | Navigateur charge `/admin/docs` directement |
| Docs : rendu, onglets, KPI, tâches, Latest Session | ✅ Rendu complet 1920+1280 | Interactions (clic onglet, recherche, filtre, lien doc) non testées |
| Docs : toggle EN/FR | ✅ Bouton visible | Clic et changement de langue non testés |
| Analytics : rendu, grille KPI, filtres, tableaux | ✅ Rendu, données à 0 | Données réelles en émulateur non testées ; filtre période non cliqué |
| Marketing : 4 cartes KPI | ✅ Rendues (60/0/0/0) | Top Créateurs et Lives Récents vides sans état explicite |
| Marketing : sections Top Créateurs / Lives Récents | ⚠️ Titres présents, contenu absent | Indiscernable : loading, erreur ou vide réel |
| Business : header, boutons Sync/Sheets | ✅ Visible | Corps bloqué sur "Chargement..." (Google Sheets KO) |
| Business : chargement données Sheet | ❌ Bloqué, aucun timeout | Tester avec credentials valides ; simuler 401/403/timeout |
| Investor CRM : rendu, navigation latérale, KPI | ✅ Complet 1920 | Aucune fonctionnalité interactive — statique uniquement |
| Realtime test : rendu | ❌ "Admin access required" | Bug A11 : guard interne `if (!user)` ignore isLocalDev |
| Realtime test : rejoindre/quitter session SFU | 🔲 Non testé | Nécessite user Firebase connecté ; tester avec compte de test |
| `/internal/streams` : rendu | ↩️ Redirige vers Login | ProtectedRoute sans AdminRoute ; confirme A05 |
| `/internal/streams` : create/start/end stream | 🔲 Non testé | Ne tester qu'en émulateur ; jamais en prod |

## Nouveau bug documenté

**A11 — `/admin/realtime-test` : guard interne redondant**
- Fichier : `AdminRealtimeTestPage.jsx:229`
- Code : `if (!user) return <div>Admin access required. Please log in.</div>`
- Impact : la page est inaccessible sans Firebase auth, même en développement local sur `127.0.0.1`, car elle vérifie `user` directement sans le bypass `isLocalDev` de `AdminRoute`.
- Priorité : P2 / faible risque — cohérence à corriger.
- Correction : remplacer par la même logique que `AdminRoute` (`const isLocalDev = import.meta.env.DEV || ['localhost', '127.0.0.1'].includes(hostname)`) ou supprimer le guard interne si `AdminRoute` suffit.

## Tests restants prioritaires (hors production)

1. **Interactions Docs** : clic onglets, recherche, lien document, retour, export.
2. **Analytics avec données contrôlées** : injecter en émulateur Firestore, vérifier totalisation et filtres.
3. **Marketing chargement** : distinguer état vide, erreur, timeout.
4. **Business Google Sheets** : tester 401, 403, timeout, cache absent/périmé.
5. **Realtime test** : avec compte Firebase de test, tester rejoindre/quitter et diagnostics.
6. **Internal streams** : uniquement en émulateur — créer, démarrer, terminer ; tester avec compte non-admin.
7. **Permissions Firestore** : emulator `firebase emulators:exec` sur `test/liveVisibility.emulator.test.mjs`.
8. **Tablette et smartphone** : captures manuelles ou script CDP étendu.

## État des tests automatisés

`npm test` (Node 18.20.8, Vitest) :
- **51 tests passent** (frontend).
- **2 suites ne démarrent pas** (`pauseLive.test.js`, `replayApi.test.js`) : importent `node:test` sous Vitest — runners incompatibles.
- Sortie non nulle — ne pas déclarer "tous les tests passent".
- Correction A10 : séparer les runners (`vitest` pour `.test.jsx/ts`, `node --test` pour `.test.mjs/js` node:test).

## Scores (non attribués)

Scores /100 non attribués jusqu'à : interactions testées, données contrôlées en émulateur, permissions vérifiées, captures tablette/mobile. Les captures desktop confirment le rendu mais pas la fiabilité fonctionnelle.
