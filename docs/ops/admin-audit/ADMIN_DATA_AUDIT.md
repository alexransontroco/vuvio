# Audit des données et des métriques

## Registre de provenance

| Affichage | Source et calcul visibles | Période / fraîcheur | Fiabilité constatée |
|---|---|---|---|
| Unique / New / Returning Visitors | `visitorActivity` : comptes des `lastSeenDate`/`firstSeenDate` puis soustraction | Fenêtre 1/7/30 j, dates UTC locales construites en JS | Définition code vérifiée ; filtrage environnement absent pour ces comptes |
| Sessions, Page Views, Sign-ups | Somme de documents journaliers `websiteStats`, suffixe `_prod`/`_dev` selon filtre | 1/7/30 j ; pas de `updatedAt` affiché | Source réelle possible, mais échecs silencieux remplacés par 0 |
| Visitor → Signup | `signups / uniqueVisitors` | Même période apparente, mais numérateur filtré environnement et dénominateur non filtré | **Incohérent** quand filtre production/development |
| Avg. Time on Site | `totalSessionDurationSeconds / sessionEndCount` | Journaliers | Ne couvre que sessions terminées ; ne pas appeler « temps moyen de tous les visiteurs » |
| Conversion funnel | Sessions → Sign-ups → somme `viewStarts` des 10 meilleurs streams | Sessions/signups de période vs top streams toutes périodes | **Non comparable** ; supprimer ou recalculer |
| Live Now (Analytics) | `rawLives = 30 premiers des 400 derniers`, filtre `status=live` | Pas un inventaire de tous les lives actifs | Peut sous-estimer ; une requête `status=live` dédiée serait pertinente |
| Lives enregistrés (Marketing) | `allLives.length` sur `limit(100)` | 100 derniers documents | Libellé « total » inexact |
| Viewers cumulés (Marketing) | Somme `peakViewerCount || viewers` de 100 lives | Historique borné, pics non uniques | Ni spectateurs uniques ni vues cumulées |
| Forecast Business | Google Sheets, cinq plages fixes ; cache `adminFinancialData/forecast`, `last_sync` | Cache signalé stale après 5 min | **Prévision**, aucune dépense ni revenu réel démontré |
| Investor CRM | Valeurs de cadrage codées en dur, personnes et structures listées | Sans fraîcheur automatique | **Hypothèses/documentation**, pas pipeline réel |
| Realtime estimated cost | Constante 0 | Toujours | **Simulation**, pas coût mesuré |

Les références principales sont `AnalyticsPage.jsx:465-595, 655-675, 815-839`, `AdminMarketingPage.jsx:139-165`, `financialService.ts` et `AdminRealtimeTestPage.jsx:200-211`.

## Règles de présentation à adopter

Afficher un badge de provenance pour chaque KPI : Live, Historique, Manuel, Estimation, Prévision, Simulation ou Indisponible. Afficher période, formule, source et dernière actualisation en détail accessible. `safe(p).catch(() => null)` et `?? 0` doivent produire un état « indisponible » si une requête échoue ; zéro signifie une valeur observée. Les taux exigent numérateur et dénominateur de même périmètre, même environnement et même fenêtre temporelle.

## Métriques à définir avant tableau exécutif

Créateurs actifs, activation après premier live, deuxième live à J+30, spectateurs ayant regardé au moins N secondes, retour J+7/J+30, conversion événement → inscription → visionnage, coût par heure diffusée et par heure vue, incidents bloquants. Définir identifiant, consentement, fuseau, période, déduplication et exclusions (tests internes, mocks) avant toute mise en page.
