# Roadmap d’amélioration Admin

**Aucune correction applicative n’est engagée par cet audit.** L’ordre proposé dépend de la validation des définitions de KPI et des droits.

| Lot | Horizon | Livrable vérifiable | Dépendances / décision |
|---|---|---|---|
| 0 — Preuves | Avant tout design | Captures cinq tailles, matrice d’interactions, tests de règles, mesures de coûts/latence | Navigateur fonctionnel, compte Admin de test, émulateurs |
| 1 — Exactitude | P1 | Funnel cohérent, source et période des KPI, état « indisponible », bornes explicites | Définition des cohortes par fondateurs |
| 2 — Accès | P1 | Allowlist/claims unifiés, console streams protégée et vérifiée | Politique d’accès ; tests serveur + Firestore Rules |
| 3 — Transparence | P2 | Badges Réel/Prévision/Simulation, Investor CRM renommé, coût SFU non mesuré | Validation éditoriale |
| 4 — Navigation | P2 | Entrée Admin par vue exécutive, menu cohérent, Docs sous Documentation | Validation de l’arborescence et des 5–8 KPI |
| 5 — Composants | P2/P3 | Header, filtres, tableau et états réutilisés là où duplication prouvée | Captures et retours utilisateurs internes |

Les fonctionnalités plus larges (CRM investisseurs réel, monitoring de coûts automatisé, Creator Pilots, Market Research) doivent entrer dans l’Admin après fusion et preuve de valeur de leurs branches respectives. Ne pas créer d’ERP de substitution.

## Critères de passage d’un lot

Tests d’accès admin/non-admin, erreurs et états vides ; assertions sur valeurs contrôlées ; inspection 1920, 1440, 1280, tablette et mobile ; mesure de requêtes et bundles ; `npm test` sans suites exclues par erreur ; build ; aucune régression sur Watch, auth ou streaming. Chaque lot est isolé en commit et revu avant déploiement. Aucune mise en production sans accord explicite.
