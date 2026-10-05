# SEO Audit - Vuvio

Date: 2026-10-06
Domaine canonique: https://vuvio.app

## Ce qui existait

- App React/Vite avec routing client via React Router.
- `index.html` contenait deja une meta description, Open Graph, Twitter Card, PWA manifest et favicon.
- `robots.txt` et `sitemap.xml` existaient depuis la premiere passe SEO, mais restaient minimaux.
- Les previews sociales de `/share/live/:id` sont servies par Firebase Functions via `functions/src/og/ogMetaHandler.ts`.
- Routes publiques principales:
  - `/watch`
  - `/explore`
  - `/explore/live`
  - `/globe`
  - `/profile/:creatorId`
  - `/live/:liveId/recap`
  - `/terms`
  - `/privacy`
  - `/help`
- Donnees publiques disponibles cote client:
  - `src/data/mockStreams.js`
  - `src/data/newPovStreams.js`
  - `src/data/creatorProfiles.js`
  - `src/data/activityCategories.js`
- Les profils publics affichent deja du texte utile: nom, bio, metier, ville, pays, categories, lives, replays et equipement public.

## Problemes trouves

- Le HTML initial Vite reste une coquille SPA: les pages profils, categories et lives ont besoin de JavaScript pour afficher leur contenu complet.
- La home n'avait pas encore le title et la description exacts du positionnement SEO souhaite.
- Pas de composant SEO centralise: les balises devaient etre gerees page par page.
- Pas de JSON-LD applicatif centralise pour Organization, WebSite, ProfilePage, Person, BroadcastEvent ou VideoObject.
- Pas de pages categorie indexables pour les grands univers Vuvio.
- `/discover` redirige vers `/watch`; aucune route categorie publique n'existait.
- Les pages auth etaient accessibles sans `noindex` explicite cote composant.
- Le sitemap ne listait pas encore les categories ni les profils publics stables.
- La route wildcard redirigeait silencieusement vers `/watch`, ce qui masquait les erreurs 404 cote UX et SEO.
- Les chunks lourds restent importants:
  - `GlobeTest2Page`
  - `maps`
  - `hls`
  - bundle app principal

## Changements effectues

- Ajout de `src/components/SEO.jsx`:
  - title
  - description
  - canonical
  - robots
  - Open Graph
  - Twitter Card
  - JSON-LD
- Mise a jour de `index.html`:
  - title home: `Vuvio — Métiers, passions et expériences en direct`
  - meta description du positionnement Vuvio
  - canonical `https://vuvio.app/`
  - Open Graph/Twitter alignes sur le domaine canonique
  - JSON-LD `Organization` et `WebSite`
- Ajout de `src/utils/seoData.js` pour deriver les donnees SEO depuis les contenus existants.
- Ajout de pages categories publiques:
  - `/discover/music`
  - `/discover/cooking`
  - `/discover/craft`
  - `/discover/sport`
  - `/discover/travel`
  - `/discover/work`
  - `/discover/outdoor`
- Ajout de SEO dynamique sur:
  - `/profile/:creatorId`
  - `/@:creatorId`
  - `/watch`
  - `/watch?live=:id`
  - `/live/:liveId/recap`
- Ajout JSON-LD:
  - `ProfilePage`
  - `Person`
  - `BroadcastEvent`
  - `VideoObject` quand un replay URL existe
  - `CollectionPage` pour les categories
- Ajout d'une vraie page 404 client `src/routes/NotFoundPage.jsx`, en `noindex`.
- Ajout `noindex,follow` sur:
  - `/login`
  - `/signup`
  - `/forgot-password`
  - pages 404
  - recaps prives ou introuvables
- Renforcement de `robots.txt`:
  - auth
  - admin
  - internal
  - settings
  - messages
  - pages de test
  - edition profil/equipement
- Enrichissement de `sitemap.xml` avec les categories et quelques profils publics stables.
- Mise a jour de la description du manifest PWA.

## Limites actuelles

- Le contenu detaille des pages publiques reste majoritairement rendu par JavaScript.
- Google peut indexer des SPA, mais les snippets et la decouverte initiale seront meilleurs avec du prerender.
- Les profils Firebase reels ne sont pas encore injectes automatiquement dans le sitemap statique.
- Les lives/replays Firebase publics ne sont pas encore injectes automatiquement dans le sitemap.
- `/live/:liveId` est actuellement reserve au flow broadcaster protege; la page publique de live reste `/watch?live=:id`.
- Les recaps peuvent etre prives selon `creatorUid`; la couche SEO n'indexe pas les recaps prives.

## Phase 2 recommandee

Mettre en place un prerender cible, sans migrer vers Next.js:

1. Generer au build des HTML statiques pour:
   - `/`
   - `/watch`
   - `/discover/:category`
   - profils publics stables
   - replays publics stables
2. Ou servir via Firebase Functions des HTML meta-rich pour:
   - profils publics
   - lives publics
   - replays publics
3. Ajouter un endpoint sitemap dynamique:
   - profils publics
   - lives publics
   - replays publics
   - categories stables
4. Garder le fallback SPA Firebase pour l'experience app.

## A surveiller

- Ne pas indexer les pages privees ou techniques.
- Ne pas creer de pages categorie vides.
- Ne pas generer de pages longue traine sans contenu reel.
- Garder une canonical stable pour eviter les doublons avec query params et URLs de partage.
