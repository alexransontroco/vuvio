# Audit de sécurité Admin

**Méthode :** lecture statique. Aucun test de règles en émulateur, aucune tentative sur production. Ne pas considérer une garde frontend comme autorisation serveur.

| Surface | Protection observée | Limite / action |
|---|---|---|
| Routes `/admin/*` | `AdminRoute` et vérifications redondantes email ; en dev, accès UI sans session | Acceptable comme facilité locale seulement ; les requêtes restent régies par Firebase. Vérifier les builds et hôtes de prévisualisation. |
| `streamStats`, `creatorStats`, `categoryStats`, `analyticsEvents`, `websiteStats`, `visitorActivity` | Firestore `isAdmin()`, écriture client interdite | Wildcard email vérifié `@vuvio.app` élargit le groupe au-delà de la liste UI. Définir politique unique et tests de règles. |
| `adminFinancialData` | Lecture `isAdmin()`, écriture client interdite | Même écart d’allowlist ; vérifier confidentialité du cache et journal de sync. |
| `/api/admin/financial/data` et `/sync` | Firebase ID token + allowlist backend explicite | Bonne séparation constatée dans le code ; tester 401/403, expiration, fréquence et erreurs Sheets. Sync modifie un cache : ne pas essayer en prod pour l’audit. |
| `/internal/streams` | `ProtectedRoute` (authentification simple) | Outil à actions sensibles. Tester les handlers API pour chaque action, puis limiter l’UI aux admins. |
| `/admin/realtime-test` | `AdminRoute` + session utilisateur | Vérifier callable SFU côté serveur et cycle de vie caméra/micro. |
| `products` Firestore | Création et mise à jour pour tout utilisateur authentifié | Commentaire « restrict to admins in production » dans rules ; revue prioritaire de portée et tests émulateur. |

Les listes d’emails sont dupliquées entre `src/constants/adminEmails.js`, `functions/src/shared/adminEmails.ts` et `firestore.rules`. Le frontend exclut le wildcard alors que Firestore l’accepte (`firestore.rules:317-326`). Si le domaine est ouvert à des personnes non administratrices, elles peuvent lire les collections statistiques autorisées par rules, indépendamment de l’UI. Vérifier les comptes réellement créés et la politique souhaitée avant modification.

Contrôles manquants à documenter : couverture des tests de rules, journal des actions administratives, limitation de cadence de synchronisation financière, séparation de données utilisateurs, comportement des routes sur hôte local avec build production. Aucun secret n’a été copié dans les rapports.
