# Audit de performance Admin

**Portée :** structure des requêtes et du code de `dev`, plus build de production local. Temps d’interaction, mémoire, Web Vitals et coût Firestore réel restent non mesurés tant que le navigateur headless local ne fonctionne pas.

Le build local `VITE_DISABLE_COPY_PUBLIC=1 npm run build` sur Node 20.20.2 réussit en 1 min 42 s. Chunks Admin : Docs **810,55 Ko / 280,81 Ko gzip**, Analytics 29,90 / 8,09, Investor CRM 14,02 / 4,77, Marketing 7,88 / 2,92, Business 7,03 / 2,69, Realtime Test 7,78 / 2,41, Internal Streams 6,24 / 2,07. Ces tailles concernent les chunks, pas le coût total des dépendances partagées ni le temps réseau réel. Journal : `/private/tmp/vuvio-admin-audit-build.log`.

| Page | Charge visible dans le code | Risque | Mesure ou correction proposée |
|---|---|---|---|
| Analytics | 5 collections/compteurs, jusqu’à 30 documents `websiteStats`, 400 lives, 30 visiteurs, jusqu’à 30 lectures individuelles de profils | Nombre de lectures élevé à chaque changement de période/environnement ; waterfall pour noms créateurs | Mesurer dans DevTools, agrégat serveur borné, cache et champ nom déjà résolu |
| Marketing | 12 `creatorStats`, 100 `activeLives`, 50 `users`, count users | Double logique analytics, statistiques partielles, coût récurrent | Réutiliser les agrégats de pilotage |
| Business | Un GET cache, POST sync manuelle de 5 plages Sheets | Faible charge frontend, latence externe à mesurer | Afficher durée et état de sync ; éviter synchronisations simultanées |
| Docs | 1 378 lignes de composant et import statique de nombreux Markdown (`import.meta.glob` eager) | Bundle Admin documentaire potentiellement lourd | Mesurer poids du chunk Docs, charger le document choisi à la demande si utile |
| Investor CRM | Constantes statiques | Faible charge réseau | Garder séparé du dashboard principal |
| Realtime test | `setInterval` diagnostics toutes les 2 s quand rejoint | Risque de fuite si tracks et PC ne sont pas nettoyés | Test caméra/PC join/leave et profiler mémoire |

Les pages sont importées avec `lazy()` dans `App.jsx` ; cela limite le coût initial, mais la taille de chaque chunk reste à mesurer. Les requêtes Firestore `getDocs` sont bornées par `limit` sauf les count queries et les lectures journalières ; la borne peut néanmoins fausser les indicateurs. Ne pas optimiser en supprimant des documents avant d’avoir défini la métrique correcte.

## Mesures à compléter

1. Pour chaque route : navigation froide/chaude, waterfall, nombre de lectures et délai du premier contenu utile à 1280×800.
2. Après 30 allers-retours Analytics/Docs : listeners, mémoire, requêtes répétées.
3. Mesurer coûts Firestore depuis les compteurs/quotas du projet de test, sans interroger la production uniquement pour l’audit.

**Aucune mesure de temps de chargement navigateur ou mémoire n’est disponible à ce stade.** Le serveur Vite répond 200, ce qui ne mesure pas la page React.
