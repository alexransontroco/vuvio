# Audit UI/UX

**Couverture :** revue du JSX/CSS uniquement ; aucune capture valide. Les jugements visuels ci-dessous sont des hypothèses de contrôle, pas des résultats de test aux tailles demandées.

## Observations vérifiables dans le code

- Trois familles visuelles coexistent : Docs/Investor CRM (`admin-docs.css`), Analytics (`analytics.css`), Marketing (styles inline) et Business (`admin-business.css`). Cartes, headers et boutons ont des implémentations séparées. `AdminMarketingPage.jsx` utilise notamment des tailles fixes 40 px et 32 px ; tester leur densité sur petit laptop.
- Docs contient une navigation à onglets, une navigation de domaines et plusieurs tableaux ; `admin-docs.css` prévoit des ruptures à 1180 et 760 px et du défilement horizontal pour les tableaux (`min-width: 720px`). La présence du CSS ne prouve pas l’utilisabilité mobile.
- Marketing affiche « Bonjour Cecilia » en dur, quel que soit l’admin. Cela nuit à la confiance et à la personnalisation.
- Investor CRM combine anglais et français. Docs gère sa langue avec un état local initialement anglais sur `dev` ; les autres pages n’utilisent pas un système Admin commun.
- Plusieurs pages ont un bouton « fermer » vers `/watch` et un retour historique ; l’action attendue pour revenir au centre Admin n’est pas cohérente.

## Vérifications visuelles restantes

| Largeur | Contrôles prioritaires | Capture attendue |
|---|---|---|
| 1920×1080 | Largeur utile, lignes très longues, grands vides | Chaque page |
| 1440×900 | Densité des tableaux, hiérarchie des KPI | Docs, Analytics, Business |
| 1280×800 | Navigation, scroll, actions dans premier écran | Toutes les pages |
| Tablette 768×1024 | Colonnes, onglets, tableaux, clavier | Docs, Analytics, CRM |
| Smartphone 390×844 | Menus, filtres, cartes, boutons accessibles | Toutes les pages |

Capture prévue sous `docs/ops/admin-audit/captures/` avec convention `route-largeur-date.png`, mais **aucun fichier image n’a été créé** : Chrome local expire même sur une page vide. Une annotation doit relier chaque capture à un problème du registre principal.

## Améliorations ciblées proposées

Unifier en premier lieu l’en-tête, la navigation secondaire, la provenance des KPI, les états vide/erreur et les badges de statut. Conserver les couleurs, typographies et icônes Vuvio. Tester la lisibilité des tableaux à 1280 px avant d’envisager un nouveau système de composants. Ne pas développer de composant générique pour un seul usage.
