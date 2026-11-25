# Architecture cible et wireframes de travail

L’organisation proposée conserve les six pages Admin de `dev` ; les entrées futures restent des emplacements logiques, pas des fonctionnalités à développer tout de suite. Priorité à l’état réel des données et aux tâches quotidiennes.

## Navigation proposée

```text
VUVIO ADMIN                 [Recherche] [Période] [Profil]
Vue d’ensemble              KPIs définis, incidents, tâches du jour
Produit & usages            Analytics, retours, expérimentations
Créateurs & communauté      Créateurs, recrutement, modération (si disponible)
Lives & opérations          Lives actifs, programmés, streaming health
Croissance                  Acquisition, événements, marketing
Entreprise                  Prévisionnel, étude de marché (après fusion)
Financement                 Plan CRM investisseurs, puis CRM réel
Technologie                 Laboratoires et outils internes réservés
Documentation               Visionneuse actuelle
Paramètres                  Préférences et accès
```

Ne pas remplir toutes les rubriques avec des écrans vides. Afficher uniquement des destinations existantes ; un lien « à venir » n’a pas sa place dans le menu opérationnel.

## Wireframe A : navigation compacte

```text
┌───────────────┬──────────────────────────────────────────────┐
│ Vuvio Admin   │ Fil d’Ariane   Recherche            Profil    │
│ Vue d’ensemble│ Titre + provenance + dernière MAJ           │
│ Produit       │                                              │
│ Créateurs     │ Contenu / tableaux / actions de la page      │
│ Lives         │                                              │
│ Croissance    │                                              │
│ Entreprise    │                                              │
│ Financement   │                                              │
│ Technologie   │                                              │
│ Documents     │                                              │
└───────────────┴──────────────────────────────────────────────┘
```

Alternative à tester à 1280 px : rail de six groupes repliables, avec pages internes visibles dans un sous-menu contextuel. Le menu mobile devient un tiroir ; l’action principale reste dans l’en-tête de contenu.

## Wireframe B : Executive Dashboard

```text
Vue d’ensemble                                  Période 7 j  [Actualisé 10:32]
Créateurs actifs | 2e live | Spectateurs récurrents | Heures vues | Coût réel
─────────────────────────────────────────────────────────────────────────────
Actions requises : incidents streaming, échecs de sync, rappels en échec
Acquisition → activation → rétention (même cohorte, définitions accessibles)
Lives pilotes récents                           Prochaines expériences
```

Chaque carte doit afficher valeur ou « indisponible », unité, source et variation si comparable. Aucune courbe sans question de pilotage.

## Wireframe C : page de données dense

```text
Titre / définition courte / source / dernière MAJ
[Période] [Environnement] [Recherche] [Exporter si autorisé]
Filtres actifs : ... [Effacer]
Tableau : colonne principale figée | valeurs alignées | tri documenté
État vide / erreur explicite          Pagination ou requête bornée
```

## Wireframe D : Entreprise

```text
Entreprise  [Prévisionnel] [Étude de marché] [Économie unitaire]
Prévision 2027–2029 — source Google Sheets — sync du ...
Hypothèses clés | scénario | sensibilité
Tableau financier avec unités / notes / lien source
```

## Wireframe E : monitoring technique

```text
Services : Firebase | Cloudflare | Email      État / vérification à ...
Incidents ouverts [gravité] [début] [responsable] [lien logs]
Flux live : création → ingest → playback → replay, avec délais observés
Coût : mesuré ou indisponible, jamais zéro par défaut
Outils de test réservés (actions destructives séparées et confirmées)
```

Ces wireframes sont des schémas textuels à confronter aux captures de l’Admin actuel. Ils ne valent pas validation d’un design final.
