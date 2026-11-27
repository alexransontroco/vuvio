# Audit global de l’Admin Vuvio

**Référence :** `dev` à `71d891b`, 25 novembre 2026. **Nature :** audit du code et essais locaux, sans accès administrateur de production. Les constats portent sur cet état précis ; les branches Market Research et Creator Pilots sont décrites séparément. Aucun KPI réel ni permission de production n’a été validé.

## Conclusion exécutive

L’Admin actuel rassemble une visionneuse documentaire, deux tableaux de bord de données, une page marketing, un brief « Investor CRM » et un laboratoire de temps réel. Il ne constitue pas encore un centre de pilotage unifié : `/admin` ouvre la documentation, les informations de décision sont dispersées, et plusieurs libellés donnent à des approximations ou à des propositions le statut de mesures opérationnelles.

Les priorités sont (1) corriger les métriques susceptibles d’induire une décision erronée, (2) aligner les droits frontend, Firestore et fonctions, (3) distinguer explicitement données réelles, prévisions et démonstrations, puis (4) construire une entrée Executive Dashboard simple à partir de KPI définis. Une refonte générale serait prématurée.

## Couverture et score

Le tableau décrit **toutes les routes Admin de `dev` et l’outil interne adjacent**. « Score : non attribué » est volontaire : les critères fonctionnement, rendu aux cinq tailles, performance navigateur et permissions réelles n’ont pas pu être éprouvés. Une note /100 serait factice. La grille de notation est dans [ADMIN_FUNCTIONAL_TESTS.md](ADMIN_FUNCTIONAL_TESTS.md).

| Page | État démontré | Score /100 | Problème majeur | Recommandation |
|---|---|---|---|---|
| `/admin` | Redirection code vers Docs | Non attribué, navigation navigateur non vérifiée | Pas de synthèse exécutive | Définir 5 à 8 KPI et alertes avant création |
| `/admin/docs` | Visionneuse codée, test visuel bloqué | Non attribué | Entrée Admin dominée par la documentation ; traduction de l’interface distincte de la langue globale | Conserver en Documentation, unifier langue et liens |
| `/admin/analytics` | Requêtes et graphiques codés, données réelles non testées | Non attribué | Entonnoir mélange sessions, inscriptions et vues issues de fenêtres/cohortes différentes | Corriger définitions et affichage « indisponible » |
| `/admin/marketing` | Requêtes codées, données réelles non testées | Non attribué | « Lives enregistrés » = 100 documents récents maximum ; « viewers cumulés » = somme de pics approximatifs | Renommer ou calculer côté serveur |
| `/admin/business` | API authentifiée et cache Firestore codés, Google Sheet non testé | Non attribué | Prévisionnel sans provenance visible au niveau de chaque indicateur | Afficher source, période, version et nature prévisionnelle |
| `/admin/investor-crm` | Contenu de cadrage statique | Non attribué | Le titre suggère un CRM opérationnel inexistant | Renommer « Plan CRM investisseurs » jusqu’à implémentation |
| `/admin/realtime-test` | Laboratoire WebRTC codé, appel réel non testé | Non attribué | Coût « $0 » codé en dur ; accès direct par URL | Libeller « non mesuré » et isoler sous outils techniques |
| `/internal/streams` | Console API codée, appels réels non testés | Non attribué | Route seulement `ProtectedRoute`, pas `AdminRoute` ; appels créent/modifient des streams | Restreindre l’UI et vérifier chaque autorisation serveur |

**Éléments absents de `dev` :** la route Market Research et la page événement Creator Pilots sont sur branches distinctes. Ne pas les compter comme en service ni les fusionner dans cet audit.

## Registre des problèmes

| ID | Priorité | Page | Preuve | Impact | Cause probable | Action | Complexité / risque |
|---|---|---|---|---|---|---|---|
| A01 | P1 | Analytics | `AnalyticsPage.jsx:579-595, 822-839` | Entonnoir trompeur, taux potentiellement >100 % | Vues top 10 toutes périodes comparées aux sessions de la période | Définir une cohorte événementielle et recalculer côté serveur | M / moyen |
| A02 | P1 | Marketing | `AdminMarketingPage.jsx:139-165` | Volumes sous-estimés, erreurs prises pour zéro | Lecture limitée à 100 lives + `safe(...).catch(() => null)` | Agrégats bornés avec état d’erreur distinct | M / moyen |
| A03 | P1 | Analytics | `AnalyticsPage.jsx:471-476, 490-520` | Filtre production/development incohérent sur visiteurs et sources | Comptes `visitorActivity` non filtrés par environnement | Définir clairement les dimensions et les rendre cohérentes | M / moyen |
| A04 | P1 | Sécurité | `firestore.rules:317-326`, `adminEmails.js` | Périmètre des lecteurs analytics plus large que l’UI | Wildcard `@vuvio.app` dans rules, liste explicite dans UI/API | Aligner une seule politique, tester en émulateur avant déploiement | M / élevé |
| A05 | P1 | Streams internes | `App.jsx:246-253`, `InternalStreamAdminPage.jsx:38-90` | Outil de mutation visible par utilisateur connecté | `ProtectedRoute` seul | Vérifier les handlers, puis appliquer garde Admin à la route | S / moyen |
| A06 | P2 | Investor CRM | `AdminInvestorCrmPage.jsx:176-377` | Confusion entre plan et suivi réel | Brief statique sous titre CRM | Renommer et lier au futur registre persisté | S / faible |
| A07 | P2 | Temps réel | `AdminRealtimeTestPage.jsx:200-211` | Coût technique faussement égal à zéro | Valeur constante « Free tier » | Remplacer par « non mesuré » | S / faible |
| A08 | P2 | Navigation | `App.jsx:158-164`, `SettingsPage.jsx:78-85` | Découverte difficile ; `/admin` mène aux docs | Croissance par pages autonomes | Créer plan d’information et point d’entrée unique après validation | M / moyen |
| A09 | P2 | Documents | `AdminDocsPage.jsx:1143,1175` | FR/EN partiel et indépendant de la préférence app sur `dev` | État local et traductions partielles | Réutiliser le travail de branche Market Research, vérifier l’intégration | S / faible |
| A10 | P2 | Tests | `npm test`, 25/11/2026 | Deux suites ne démarrent pas | Fichiers `node:test` sous parcours Vitest | Séparer les runners | S / faible |
| A11 | P2 | Realtime test | `AdminRealtimeTestPage.jsx:229`, capture 27/11 | Page inaccessible même en dev local — "Admin access required. Please log in." | Guard interne `if (!user)` ignore `isLocalDev` de `AdminRoute` | Supprimer guard interne ou aligner avec logique `AdminRoute` | S / faible |
| A12 | P2 | Marketing | Capture 27/11 — sections sous KPI vides | Impossible de distinguer chargement, erreur et absence de données | `safe(...).catch(() => null)` silencieux + aucun état vide/skeleton | Ajouter états "Chargement…", "Erreur", "Aucun résultat" distincts | S / faible |
| A13 | P2 | Business | Capture 27/11 — bloqué sur "Chargement…" | Aucun feedback après échec Google Sheets — page inutilisable hors prod | Pas de timeout ni gestion d'erreur après promesse | Ajouter timeout (10 s) + message d'erreur actionnable | S / faible |
| A14 | P2 | Navigation transverse | Captures 27/11 — boutons fermer incohérents | Navigation Admin fragmentée — pas de hub central accessible depuis toutes les pages | Croissance page par page sans hub | Unifier bouton retour vers un hub Admin (après validation A08) | S / faible |

**P0 confirmé : aucun.** La règle `products` autorise tout compte authentifié à créer/modifier un produit (`firestore.rules:373`) ; c’est un risque transversal à traiter avec l’équipe produit avant exposition, mais son exploitation et sa portée Admin n’ont pas été testées. Le signaler en revue sécurité prioritaire, sans conclure à une faille exploitable à partir du seul code.

## Décisions à valider avec les fondateurs

1. Les cinq KPI du tableau exécutif et leurs définitions exactes : proposer activation créateur, deuxième live, spectateurs récurrents, visionnage qualifié et coût de diffusion, avec acquisition et incidents en contexte.
2. La politique d’accès Admin : allowlist nominative ou rôle/claim contrôlé ; supprimer l’écart `@vuvio.app` après tests.
3. Le sort de l’outil `/internal/streams` : laboratoire réservé, ou retrait de l’Admin de production après revue de dépendance.
4. L’emplacement du brief Investor CRM et l’intégration des branches Market Research / Creator Pilots quand elles seront prêtes.

## Documents associés

[Inventaire](ADMIN_INVENTORY.md) · [Routes](ADMIN_ROUTE_MAP.md) · [Tests](ADMIN_FUNCTIONAL_TESTS.md) · [UI/UX](ADMIN_UI_UX_AUDIT.md) · [Données](ADMIN_DATA_AUDIT.md) · [Sécurité](ADMIN_SECURITY_AUDIT.md) · [Performance](ADMIN_PERFORMANCE_AUDIT.md) · [Architecture cible](ADMIN_INFORMATION_ARCHITECTURE.md) · [Roadmap](ADMIN_IMPROVEMENT_ROADMAP.md) · [Progression](ADMIN_AUDIT_PROGRESS.md).
