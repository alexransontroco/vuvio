# Matrice de tests fonctionnels

**Légende :** « code présent » signifie qu’une action est implémentée dans le code, sans preuve d’exécution. Aucune ligne ci-dessous n’est déclarée Working. Ne pas envoyer de créations de streams, de sync Google Sheets ou de mutations en production pendant l’audit.

| Page / contrôle | Résultat au 25/11 | Preuve et test restant |
|---|---|---|
| `/admin` redirection | Code présent, navigateur non testé | `App.jsx:158` ; ouvrir puis rafraîchir |
| Docs : recherche, filtres, FR/EN, liens, lecture | Code présent, navigateur non testé | `AdminDocsPage.jsx` ; tester recherche, document lié, URL avec `?doc=`, retour, export/impression si affichés |
| Analytics : période, environnement, recherche lives, filtres créateur/catégorie, refresh | Code présent, données non testées | `AnalyticsPage.jsx:403-1085` ; injecter jeux contrôlés en émulateur, vérifier total et erreurs |
| Marketing : quatre cartes, top créateurs, lives récents | Partiellement conforme au sens des libellés ; exécution non testée | Source bornée à 100 lives, erreurs converties en valeurs vides |
| Business : lecture cache, année, synchronisation, ouverture Sheet | Code présent, API/Sheet non testés | Vérifier 401/403, cache absent, cache périmé, échec Google, valeurs non numériques |
| Investor CRM : pipeline et contacts | **Not implemented** | Page descriptive statique ; aucun formulaire ni persistance de contacts |
| Realtime test : joindre/quitter, micro/caméra, diagnostics | Code présent, session réelle non testée | Consentement caméra, callable SFU, nettoyage tracks, 2 participants ; coût simulé |
| Internal streams : create/start/heartbeat/end/gear/events | Code présent, actions réelles non testées | Tester uniquement sur émulateur ou projet de test, avec compte non admin et admin |

Le serveur Vite `127.0.0.1:5190` retourne 200 pour `/admin/docs`. Chrome headless échoue à terminer même `about:blank` ; aucune capture ou interaction Admin valide n’a été produite. Ce 200 est une vérification du serveur SPA, pas une preuve de rendu.

`npm test` (Node 20.20.2) : **51 tests passent, deux suites ne démarrent pas** (`pauseLive.test.js`, `replayApi.test.js`) car elles importent `node:test` sous Vitest. Le code de sortie de la commande est non nul. Ne pas résumer ce résultat par « tous les tests passent ».

## Script de validation à exécuter

Pour chaque page : accès direct, navigation depuis le menu, rafraîchissement, chargement, état vide, erreur réseau, clavier, bouton retour. Pour les pages à données : valeurs contrôlées, période, source, dernière mise à jour, permissions Admin/non Admin. Pour les actions : succès, échec et absence de double exécution. Pour l’UI : cinq tailles demandées et captures horodatées. Ne noter Working que si ces critères sont observés.

## Barème des scores futurs

Fonctionnement 25 ; fiabilité des données 20 ; UX 15 ; lisibilité 15 ; performances 10 ; sécurité 10 ; maintenabilité 5. Saisir chaque sous-score uniquement après preuve correspondante, joindre capture ou log, puis sommer. Si un critère manque, laisser le score total « non attribué » et indiquer la couverture. La revue statique actuelle ne couvre ni UX ni rendu ni permissions de production ; aucune note /100 définitive n’est donc publiée.
