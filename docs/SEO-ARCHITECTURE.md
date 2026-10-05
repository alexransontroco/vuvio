# SEO Architecture - Vuvio

## Objectif

Faire comprendre a Google que Vuvio relie:

Home -> Categories -> Profiles -> Live pages -> Replay pages

Le live attire l'attention.

L'activite cree l'interet.

La personne cree la connexion.

## Routes publiques

### Home

URL: `/`

Role:
- expliquer Vuvio;
- poser l'identite: metiers, passions, experiences en direct;
- fournir Organization + WebSite schema.

Canonical:
- `https://vuvio.app/`

### Categories

URLs:
- `/discover/music`
- `/discover/cooking`
- `/discover/craft`
- `/discover/sport`
- `/discover/travel`
- `/discover/work`
- `/discover/outdoor`

Role:
- regrouper des lives et createurs existants;
- capter les recherches par activite;
- ne pas creer de pages vides.

Canonical:
- `https://vuvio.app/discover/:category`

Schema:
- `CollectionPage`
- `VideoObject` pour les lives listables quand les donnees existent.

### Profiles

URLs actuelles:
- `/profile/:creatorId`
- `/@:creatorId`

Canonical retenue:
- `/profile/:creatorId`

Role:
- presenter la personne;
- indexer nom, bio, metier, ville/pays, categories, lives, replays et equipement public.

Schema:
- `ProfilePage`
- `Person`

Donnees:
- Firestore `users` quand disponible;
- fallback local `creatorProfiles` et contenus publics existants.

### Live pages

URL actuelle:
- `/watch?live=:id`

Role:
- page publique de visionnage;
- meta dynamique selon le live connu cote client;
- JSON-LD `BroadcastEvent`.

Canonical:
- `/watch?live=:id` pour les lives demandes;
- `/watch` pour le feed general.

Note:
- `/live/:id` est reserve au broadcast protege et ne doit pas etre casse.
- Une phase ulterieure peut introduire une route publique dediee comme `/live/:id/watch` ou `/l/:slug`.

### Replay pages

URL actuelle:
- `/live/:liveId/recap`

Role:
- transformer un live termine en page permanente quand le replay est public;
- fournir `VideoObject` si `replayUrl` existe.

Canonical:
- `https://vuvio.app/live/:liveId/recap`

Indexation:
- index si replay public;
- noindex si recap prive ou introuvable.

## Sitemap

Fichier actuel:
- `/sitemap.xml`

Inclut:
- home;
- watch;
- explore/globe;
- categories;
- profils publics stables;
- legal.

Exclut:
- admin;
- auth;
- settings;
- messages;
- edition profil/equipement;
- routes de test;
- donnees non publiques.

## Robots

Fichier actuel:
- `/robots.txt`

Regle:
- autoriser les pages publiques;
- bloquer les surfaces inutiles ou privees exposees par URL;
- rappeler que robots.txt n'est pas une securite.

## Canonicals

Principes:
- domaine canonique unique: `https://vuvio.app`;
- eviter l'indexation des URLs de tracking;
- canonical stable pour `/profile/:creatorId`;
- canonical stable pour `/discover/:category`;
- canonical stable pour `/live/:liveId/recap`.

## Noindex

Routes en noindex:
- `/login`
- `/signup`
- `/forgot-password`
- `/verify-email`
- `/settings`
- `/messages`
- `/admin`
- `/internal`
- routes 404
- recaps prives
- pages de test

## Firebase et prerender

L'architecture actuelle reste une SPA Vite servie par Firebase Hosting.

Strategie phase 2 recommandee:

1. Garder Firebase Hosting pour l'app.
2. Ajouter un prerender cible au build ou via Functions.
3. Generer des HTML riches pour les pages publiques SEO.
4. Laisser React hydrater l'experience app-first apres chargement.
5. Ajouter un sitemap dynamique alimente par Firestore pour les profils/lives/replays publics.

Cette approche evite une migration Next.js prematuree.
