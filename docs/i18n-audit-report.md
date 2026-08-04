# Vuvio i18n Audit Report

Audit date: 2026-07-24  
Scope: repository-wide audit only. No application migration was started.

## 1. Executive summary

| Metric | Result |
| --- | ---: |
| Total repository files inspected, excluding generated/dependency directories | 290 |
| Relevant text/application files inspected | 91 |
| Files containing French terms, accents, or mixed-language candidates | 32 |
| Runtime app/metadata files with confirmed French or mixed-language findings, excluding `fr.json` and archived references | 10 |
| Confirmed French or mixed-language findings in runtime app/metadata, excluding locale resources | 25 |
| Estimated user-facing strings still present in code/data/config | 350+ |
| Estimated hardcoded English interface strings still outside locale files | 180+ |
| Technical names requiring review | 40+ icon/category identifiers, plus several persistent keys |
| Persistent keys requiring caution | 9 localStorage/custom-event key groups |
| Routes requiring review | 0 French routes; 3 legacy/debug aliases to evaluate |
| Overall migration risk | Medium |

Highest-priority findings:

- `src/routes/ProfilePage.jsx:174` contains the mixed visible CTA `Send un message`.
- `src/routes/EditProfilePage.jsx:244-249` contains French visible form labels: `Informations publiques`, `Nom d’utilisateur`, `Ville`, `Pays`.
- `src/components/globe/TestGlobe.jsx`, `src/components/globe/VuvioGlobeLab.jsx`, `src/routes/MapPage.jsx`, and `src/components/map/LiveMap.jsx` contain French visible/accessibility labels for globe controls.
- `index.html:2` still declares `<html lang="fr">`, while the app is intended to default to English.
- `public/manifest.webmanifest:4` has French PWA metadata: `Lives POV immersifs autour du monde.`
- `src/services/messagingService.js:75-76` has a French fallback user name/username and `src/services/messagingService.js:222` uses `Autre` as a report reason.
- Existing i18n is partially configured, but many components and data files still use hardcoded English strings that need extraction later.

## 2. Current language architecture

The project already includes `i18next`, `react-i18next`, and `i18next-browser-languagedetector` in `package.json`. The app imports `src/i18n/index.js` from `src/main.jsx`.

Current setup:

- `src/i18n/index.js` defines `en` and `fr` resources.
- `lng: 'en'` and `fallbackLng: 'en'` force English as the active/default language.
- Browser detection exists and stores the language under `localStorage` key `vuvio-language`.
- `convertDetectedLanguage` currently maps every detected language, including French, to `en`.
- `src/i18n/locales/en.json` contains a useful base namespace structure: `common`, `navigation`, `home`, `explore`, `globe`, `live`, `profile`, `messages`, `settings`, `create`, `categories`, `errors`.
- `src/i18n/locales/fr.json` exists and contains French translations, but French is intentionally not activated by detection.

Missing or incomplete:

- Many runtime strings are still hardcoded in page components, utilities, mock data, and metadata.
- Date/time/countdown strings are still returned from utilities as English literals instead of translation keys.
- Mock/demo content is not separated from UI labels.
- No full locale strategy exists yet for route metadata, PWA metadata, browser notifications, or external error mapping.

## 3. User-facing French strings

These are confirmed French strings in runtime app or public metadata, excluding `src/i18n/locales/fr.json`.

| Current text | Language | File | Location | User-facing | Recommended English | Suggested i18n key | Priority | Migration risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Informations publiques` | French | `src/routes/EditProfilePage.jsx:244` | Edit profile section heading | Yes | Public information | `profile.edit.publicInformation` | Critical | Low |
| `Nom d’utilisateur` | French | `src/routes/EditProfilePage.jsx:246` | Username field label | Yes | Username | `profile.edit.username` | Critical | Low |
| `Ville` | French | `src/routes/EditProfilePage.jsx:248` | City field label | Yes | City | `profile.edit.city` | High | Low |
| `Pays` | French | `src/routes/EditProfilePage.jsx:249` | Country field label | Yes | Country | `profile.edit.country` | High | Low |
| `User indisponible` | Mixed/French | `src/services/messagingService.js:75` | Missing participant fallback | Yes | Unavailable user | `messages.unavailableUser` | High | Medium |
| `indisponible` | French | `src/services/messagingService.js:76` | Missing participant username fallback | Potentially | unavailable | `messages.unavailableUsername` | Medium | Medium |
| `Autre` | French | `src/services/messagingService.js:222` | Default report reason | Potentially | Other | `report.reasons.other` | Medium | Medium |
| `` `${...} en live` `` | Mixed/French | `src/services/profileService.js:108` | Generated profile live title fallback | Yes | `${...} live` / `Live: ${...}` | `profile.liveTitleFallback` | High | Medium |
| `Choisir le globe` | French | `src/routes/MapPage.jsx:119` | Globe switcher aria label | Accessibility | Choose globe | `globe.switcher.aria` | Medium | Low |
| `Actuel` | French | `src/routes/MapPage.jsx:126` | Globe switcher button | Yes | Current | `globe.switcher.current` | Medium | Low |
| `Recentrer` | French | `src/components/map/LiveMap.jsx:609` | Map control aria label | Accessibility | Recenter | `globe.controls.recenter` | Medium | Low |
| `Globe Actuel Vuvio` | Mixed/French | `src/components/globe/TestGlobe.jsx:615` | Globe screen aria label | Accessibility | Current Vuvio globe | `globe.currentAria` | Medium | Low |
| `erreur: {mapError}` | French | `src/components/globe/TestGlobe.jsx:619` | Map error message | Yes | Error: `{mapError}` | `errors.map` | High | Low |
| `Choisir le globe` | French | `src/components/globe/TestGlobe.jsx:622` | Globe switcher aria label | Accessibility | Choose globe | `globe.switcher.aria` | Medium | Low |
| `Actuel` | French | `src/components/globe/TestGlobe.jsx:631` | Globe switcher button | Yes | Current | `globe.switcher.current` | Medium | Low |
| `Zoomer` | French | `src/components/globe/TestGlobe.jsx:650` | Zoom button aria label | Accessibility | Zoom in | `globe.controls.zoomIn` | Medium | Low |
| `Recentrer` | French | `src/components/globe/TestGlobe.jsx:656` | Recenter button aria label | Accessibility | Recenter | `globe.controls.recenter` | Medium | Low |
| `Choisir le globe` | French | `src/components/globe/VuvioGlobeLab.jsx:256` | Globe switcher aria label | Accessibility | Choose globe | `globe.switcher.aria` | Medium | Low |
| `Actuel` | French | `src/components/globe/VuvioGlobeLab.jsx:258` | Globe switcher button | Yes | Current | `globe.switcher.current` | Medium | Low |
| `Zoomer` | French | `src/components/globe/VuvioGlobeLab.jsx:270` | Zoom button aria label | Accessibility | Zoom in | `globe.controls.zoomIn` | Medium | Low |
| `Recentrer` | French | `src/components/globe/VuvioGlobeLab.jsx:276` | Recenter button aria label | Accessibility | Recenter | `globe.controls.recenter` | Medium | Low |
| `Lien` | French | `src/styles/pages/messages.css:817` | CSS selector matching an aria-label | Accessibility-coupled | Link | `messages.composer.link` | Medium | Medium |
| `Lives POV immersifs autour du monde.` | French | `public/manifest.webmanifest:4` | PWA manifest description | Yes, browser/install UI | Immersive POV lives around the world. | `metadata.pwa.description` | High | Low |
| `<html lang="fr">` | French locale metadata | `index.html:2` | HTML language attribute | Yes, browser/a11y/SEO | `<html lang="en">` | n/a | Critical | Low |

## 4. Hardcoded English interface strings

English will be the source language, but these strings still need extraction to locale files. This list groups high-volume files and gives representative examples from actual findings.

| File | Representative hardcoded strings | Suggested namespace | Priority | Notes |
| --- | --- | --- | --- | --- |
| `src/routes/VisionPage.jsx` | `OUR VISION`, `See the world through someone else’s eyes.`, `Internal presentation`, `Experiences. Emotions. Live.`, `Join the Vuvio journey.` | `vision.*` | High | Internal page is entirely hardcoded English and not in i18n. |
| `src/routes/ProfilePage.jsx` | `This is how your profile appears to others.`, `Show less`, `Show more`, `Edit my profile`, `Schedule a live`, `No scheduled live.`, `Profile updated` | `profile.*` | High | Many strings duplicate existing `en.json` entries but are not wired to `t()`. |
| `src/routes/EditProfilePage.jsx` | `Display name`, `Profession or activity`, `Spoken languages`, `Categories`, `Profile updated` | `profile.edit.*` | High | Same file also contains French labels. |
| `src/routes/MessagesPage.jsx` | `All`, `Unread`, `Requests`, `Try another name, username or live stream.`, `Explore live streams`, `Message filters` | `messages.*` | High | Some strings already use `t()`, others remain hardcoded. |
| `src/routes/ConversationPage.jsx` | `Today`, `Back to messages`, composer/actions and request handling copy | `messages.conversation.*` | High | Needs line-by-line extraction in migration. |
| `src/routes/LivePage.jsx` | `Saving…`, `Reminder on`, `Notify me`, `Try again`, `Open details for`, `Live now`, `Starting soon`, `Upcoming`, `Share`, `Location to be confirmed` | `home.upcoming.*`, `common.*` | High | Some overlap with existing `common` keys. |
| `src/routes/MapPage.jsx` | `Live created locally`, `Live now`, globe switch labels | `globe.*` | Medium | Also contains French switcher labels. |
| `src/components/globe/TestGlobe.jsx` | `Lab`, `Test`, `Map controls`, `Filter experiences`, `Close selected live` | `globe.*` | Medium | Debug/lab UI may still be reachable. |
| `src/components/globe/VuvioGlobeLab.jsx` | `Selected live: ...`, `Close card`, `Globe controls`, `Filter experiences` | `globe.lab.*` | Medium | Prototype page, still routed. |
| `src/components/equipment/EquipmentKit.jsx` | `Gear in this live`, `Gear for this live`, `Add equipment`, `Example: GoPro`, `Close`, `Skip for now`, remove labels | `equipment.*` | High | Equipment flow is visible from live/create/profile. |
| `src/components/SearchBar.jsx` | `Search a craft, a city, a passion...`, `Open filters` | `common.search.*` | Medium | Shared component. |
| `src/components/SplashScreen.jsx` | `Loading Vuvio` | `common.loadingVuvio` | Low | Accessibility/status copy. |
| `src/components/UpcomingItem.jsx` | `Notification active`, `Enable notification` | `home.upcoming.*` | Medium | Could be legacy but user-facing. |
| `src/utils/countdown.js` | `Date unavailable`, `Live now`, `Starting soon`, `Starting in`, `Starts in`, `Today`, `Tomorrow`, plural `day/days` | `time.*`, `home.upcoming.countdown.*` | High | Needs plural/date localization structure. |
| `src/routes/HelpPage.jsx`, `src/routes/PrivacyPage.jsx`, `src/routes/TermsPage.jsx`, `src/routes/SettingsPage.jsx`, `src/routes/ReportProblemPage.jsx` | Large blocks of English support/legal/settings copy | `help.*`, `privacy.*`, `terms.*`, `settings.*`, `report.*` | Medium | Volume is high but language is already English. |
| `src/i18n/locales/en.json` | Existing English locale entries | n/a | n/a | Already extracted; keep as source of truth and expand. |

## 5. Mixed-language interface strings

| Current phrase | File | Location | Recommended English | Suggested i18n key |
| --- | --- | --- | --- | --- |
| `Send un message` | `src/routes/ProfilePage.jsx:174` | Public profile action button | Send message | `profile.sendMessage` |
| `User indisponible` | `src/services/messagingService.js:75` | Missing conversation participant fallback | Unavailable user | `messages.unavailableUser` |
| `` `${content...} en live` `` | `src/services/profileService.js:108` | Generated profile live fallback title | `Live: {{title}}` or `{{title}} live` | `profile.liveTitleFallback` |
| `Globe Actuel Vuvio` | `src/components/globe/TestGlobe.jsx:615` | Globe aria label | Current Vuvio globe | `globe.currentAria` |
| Page-level mixture | `src/routes/EditProfilePage.jsx:244-254` | Edit profile form mixes French labels with English labels | All labels should be English and extracted | `profile.edit.*` |
| Page-level mixture | Globe map/lab files | Switcher/control labels mix French and English | Current / Lab / Test / Zoom in / Recenter | `globe.*` |

## 6. Terminology inconsistencies

| Concept | Current variants found | Preferred English term | Suggested key | Affected files |
| --- | --- | --- | --- | --- |
| Home page | `Home`, `/live`, `/home` redirect | Home | `navigation.home`, `home.*` | `src/App.jsx`, `src/components/BottomNav.jsx`, `src/routes/LivePage.jsx` |
| Discover page | `Discover`, `ExplorePage`, `/discover`, `/explore` redirect, old `Explore` terminology in references | Discover | `navigation.discover`, `explore.*` or future `discover.*` | `src/App.jsx`, `src/routes/ExplorePage.jsx`, `references/*` |
| Globe current mode | `Actuel`, `Current`, `Test`, `Lab` | Current | `globe.switcher.current` | `MapPage.jsx`, globe components |
| Live status | `Live`, `LIVE`, `Live now`, `Live created locally`, `EN DIRECT` in old references | Live / Live now | `live.badge`, `globe.liveNow` | app and references |
| Upcoming/reminders | `Upcoming`, `Don’t miss`, `Notify me`, `Reminder on`, `Notification on` | Upcoming for status; Don’t miss for Home section; Notify me for CTA | `home.upcoming.*` | `LivePage.jsx`, `ProfilePage.jsx`, `en.json` |
| Follow state | `Follow`, `Following`, `Notification on`, `Notifications on` | Follow / Following / Reminder on | `common.follow`, `common.following`, `common.notified` | profile/discover/upcoming |
| Equipment | `Gear`, `Equipment`, `Activity Gear`, old French `Matériel` in user prompts only | Equipment for product area, Gear in compact labels if product-approved | `equipment.*` | `EquipmentKit.jsx`, `EquipmentManagePage.jsx`, `profile` |
| Brand | `Vuvio`, `VuVio` in references/assets paths | Vuvio in text; logo asset may remain | n/a | `references/*`, asset filenames |

## 7. Technical naming

| Current name | File | Symbol type | Usage summary | Recommended English name | Estimated refs | Risk |
| --- | --- | --- | --- | --- | ---: | --- |
| `ExplorePage` | `src/routes/ExplorePage.jsx`, `src/App.jsx` | Component/file | Implements the Discover route | `DiscoverPage` | 2 | Medium |
| `explore.*` i18n namespace | `src/i18n/locales/*.json`, `ExplorePage.jsx` | Translation namespace | Visible Discover copy | `discover.*` | 20+ | Medium |
| `earth` | `src/data/experienceTaxonomy.js`, streams, equipment/live creation | Internal category ID | Represents Land | `land` | 20+ | High |
| `marine` | `src/data/experienceTaxonomy.js`, streams/live creation | POV type ID | Represents water POV | `waterPov` or `underwater` depending semantics | 5+ | High |
| `Metiers` | `src/data/mockStreams.js:19` | Category mapping key | Maps a subcategory to Craft | `Professions` or `Trades` | 1 | Medium |
| `Peche` | `src/data/mockStreams.js:22` | Category mapping key | French unaccented fishing alias | `Fishing` | 1 | Medium |
| `Plongee` | `src/data/mockStreams.js:24` | Category mapping key | French unaccented diving alias | `Diving` | 1 | Medium |
| `Randonnee` | `src/data/mockStreams.js:26` | Category mapping key | French unaccented hiking alias | `Hiking` | 1 | Medium |
| `avion`, `helicoptere`, `montgolfiere`, `planeur`, `fusee` | `src/assets/icons/index.ts:6-15` | Icon IDs/file paths | Internal icon definitions | `airplane`, `helicopter`, `hot-air-balloon`, `glider`, `rocket` | Multiple assets | Medium |
| `eau`, `bateau`, `voilier` | `src/assets/icons/index.ts:17-21` | Icon IDs/category/file paths | Internal icon definitions | `water`, `boat`, `sailboat` | Multiple assets | Medium |
| `terre`, `randonnee`, `marche`, `velo`, `montagne`, `foret` | `src/assets/icons/index.ts:23-38` | Icon IDs/category/file paths | Internal icon definitions | `land`, `hiking`, `walking`, `bicycle`, `mountain`, `forest` | Multiple assets | Medium |
| `voiture`, `camion`, `telepherique` | `src/assets/icons/index.ts:44-53` | Icon IDs/file paths | Internal icon definitions | `car`, `truck`, `cable-car` | Multiple assets | Medium |
| `casque` | `src/assets/icons/index.ts:59` | Icon ID/file path | Live icon definition | `headset` or `helmet` | Asset path | Medium |
| `cuisine`, `boulanger`, `serveur`, `agriculteur`, `pompier`, etc. | `src/assets/icons/index.ts:66-95` | Icon IDs/category/file paths | Profession icon definitions | English slugs by profession | Many | Medium |
| `profil`, `localisation`, `recherche`, `parametres`, `filtre` | `src/assets/icons/index.ts:101-108` | Icon IDs/file paths | Navigation/interface icon definitions | `profile`, `location`, `search`, `settings`, `filter` | Multiple | Medium |
| `createdLives` key spelling | `src/services/createdLiveService.js:1` | localStorage key | Saved local live drafts | Keep unless migration planned | 1 | High |

## 8. Mock and demo data

Most active mock/demo content is already English. It is still user-facing and should later be extracted or classified as seed/user-generated content.

| File | Content type | Classification | Findings | Recommendation |
| --- | --- | --- | --- | --- |
| `src/data/lives.js` | Live titles, descriptions, jobs, comments, places | English mock/user-generated simulation | Titles/descriptions/comments are hardcoded English; proper nouns include real places. | Keep names/places as content; extract reusable UI labels only. Treat comments as mock content, not UI keys unless seeded in locale. |
| `src/data/newPovStreams.js` | 40 POV streams and comments | English mock/user-generated simulation | Large hardcoded English dataset. | Do not translate as UI during first pass; centralize as seed data with locale plan later. |
| `src/data/mockStreams.js` | Stream/category mapping and collections | Mixed identifiers | `Metiers`, `Peche`, `Plongee`, `Randonnee` are French aliases; categories include `Cuisine` as display value. | Normalize aliases only with compatibility mapping. |
| `src/data/mockMessages.js` | Conversations, message lives, preferences | English plus proper nouns | `Léna`, `Nazaré`, `Étretat` are proper nouns; `viewerLabel` uses comma decimal style like `2,4 k`. | Preserve names/places; localize number formatting later. |
| `src/data/creatorProfiles.js` | Profiles, bios, schedules | English mock/profile data | `languages: ['French', 'English']` are display strings; scheduled labels such as `Tomorrow`, `Saturday, July 18` are literal. | Convert language/category labels to IDs and format dates dynamically later. |
| `src/data/equipmentModel.js` | Equipment categories and items | English static data | Labels/descriptions are hardcoded; IDs are stable English. | Safe to extract display labels; keep equipment IDs. |
| `src/routes/VisionPage.jsx` | Internal landing copy | English hardcoded page content | All copy is English but outside locale files. | Extract under `vision.*` after product copy is finalized. |

## 9. Categories and filters

Current category systems are split:

- `src/data/experienceTaxonomy.js` uses family IDs `air`, `earth`, `water` with display labels `Air`, `Land`, `Water`.
- `src/data/mockStreams.js` maps legacy categories such as `Sky`, `City`, `Cuisine`, `Craft`.
- `src/assets/icons/index.ts` uses many French icon IDs and asset paths while display labels are English.
- `src/i18n/locales/en.json` already contains target category labels for `air`, `water`, `land`, and `urban`.

Issues:

| Issue | Location | Display label | Internal value | Risk | Recommendation |
| --- | --- | --- | --- | --- | --- |
| `earth` used for Land | `experienceTaxonomy.js`, stream data, create flow | Land | `earth` | High | Keep existing ID for compatibility; add display key `categories.land.label`; migrate to `land` only with mapping. |
| French icon IDs and folders | `src/assets/icons/index.ts`, SVG asset paths | Mostly English | `eau`, `terre`, `metiers`, `profil`, etc. | Medium | Do not rename assets automatically. Add English aliases if needed. |
| `Cuisine` category | `src/data/mockStreams.js:486` | Cuisine | `Cuisine` | Medium | Prefer `Cooking` display; preserve if data depends on it until mapped. |
| Legacy `Sky` category | `src/data/mockStreams.js` | Sky | `Sky` | Medium | Prefer environment `air`; map display to `Air`. |
| Direct display labels in taxonomy | `src/data/experienceTaxonomy.js:4-46` | Air/Land/Water/POV labels | IDs and labels coupled | Medium | Future pattern: `{ id: "hot-air-balloon", translationKey: "categories.air.hotAirBalloon" }`. |

Future preferred pattern:

```js
{
  id: "hot-air-balloon",
  translationKey: "categories.air.hotAirBalloon"
}
```

Safe migrations: display labels and descriptions.  
Risky migrations: IDs stored in streams, localStorage drafts, icon file paths, URLs, and any future Firebase documents.

## 10. Firebase and persistent storage

No direct Firebase SDK reads/writes were found in `src` during this audit. The app currently relies heavily on local mock services and `localStorage`. Firebase Hosting is configured through `firebase.json`.

| Key/field | Read locations | Write locations | Likely storage | Existing data risk | Recommended future name/action | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `vuvio-language` | `src/i18n/index.js:25` | i18next detector | localStorage | Yes, user language preference | Keep; already English and product-specific | High |
| `vuvio:messages:conversations` | `src/services/messagingService.js:30` | `src/services/messagingService.js:38` | localStorage | Yes, local conversations | Keep key; migrate shape with versioning if needed | High |
| `vuvio:messages:preferences` | `src/services/messagingService.js:49` | `src/services/messagingService.js:57` | localStorage | Yes, message preferences | Keep key; map labels separately | High |
| `vuvio:messages-updated` | `src/services/messagingService.js:11,18,248-249` | custom event | Browser event | Runtime only | Keep | Low |
| `vuvio:ownCreatorProfile` | `src/services/profileService.js:171` | `src/services/profileService.js:209` | localStorage | Yes, profile data | Keep; any field rename needs compatibility | High |
| `vuvio:profile-updated` | `src/services/profileService.js:7,210,220` | custom event | Browser event | Runtime only | Keep | Low |
| `vuvio:following-creators` | `src/services/followService.js:13` | `src/services/followService.js:23` | localStorage | Yes, follow state | Keep | High |
| `vuvio-upcoming-reminders` | `src/services/upcomingReminderService.js:1,12,21` | localStorage | Reminder map | Yes, reminder state | Keep; server migration should read old key | High |
| `vuvio:equipment-library` | `src/services/equipmentService.js:54,61,69` | localStorage | Equipment library | Yes, gear data | Keep; extract labels only | High |
| `vuvio:last-live-equipment` | `src/services/equipmentService.js:132,144,149` | localStorage | Live setup defaults | Yes, draft setup | Keep | High |
| `vuvio:createdLives` | `src/services/createdLiveService.js:1,25,35` | localStorage | Locally created lives | Yes, local content | Keep or version as `vuvio:created-lives:v2` later | High |
| `vuvio-discover-swipe-hint-seen` | `src/routes/ExplorePage.jsx:26,121,167` | localStorage | UI preference | Yes, hint state | Keep | Medium |
| Query param `live` | `ExplorePage.jsx`, `LivePage.jsx`, `MapPage.jsx`, `ProfilePage.jsx` | URL | Deep link | Yes, shared links | Keep | High |
| Query param `tab=equipment` | `ProfilePage.jsx`, `ExplorePage.jsx`, `LivePage.jsx` | URL | Deep link | Yes | Keep or alias later | High |

Fields in profile/conversation/equipment objects are already mostly English. Do not rename persisted fields such as `displayName`, `username`, `upcomingLives`, `recentLives`, `equipment`, `messageNotifications`, `requestNotifications`, `createdAt`, or `updatedAt` without a migration and compatibility layer.

## 11. Routes and URLs

Routes in `src/App.jsx` are English. No French routes were found.

| Current route | Purpose | Recommended route | Dependencies | Risk | Keep temporarily? |
| --- | --- | --- | --- | --- | --- |
| `/live` | Current Home page route | Consider `/home` as canonical later if product wants Home route | `App.jsx`, `BottomNav.jsx`, `LivePage.jsx`, redirects | High | Yes |
| `/home` | Redirects to `/live` | `/home` could become canonical later | `App.jsx:46` | Medium | Yes |
| `/discover` | Discover POV feed | Keep | `App.jsx`, navigation, many deep links | High | Yes |
| `/explore` | Redirects to `/discover` | Keep redirect or remove after analytics review | `App.jsx:72` | Medium | Yes |
| `/globe`, `/map`, `/globe-lab`, `/globe-test` | Globe/current/test routes | Keep public route `/globe`; review debug routes | `App.jsx`, globe components | Medium | Yes |
| `/messages`, `/messages/:conversationId` | Messaging | Keep | Profile/live/messages | High | Yes |
| `/profile`, `/profile/edit`, `/profile/equipment`, `/profile/:creatorId` | Profile routes | Keep | Profile/edit/equipment/deep links | High | Yes |
| `/settings`, `/help`, `/report-problem`, `/terms`, `/privacy`, `/icons`, `/vision` | Settings/support/internal routes | Keep | App routing | Medium | Yes |

Hosting rewrites in `firebase.json` and `vercel.json` send all app routes to `index.html`; no localized route rewrites exist.

## 12. Dates, times, numbers and pluralization

Findings:

- `src/utils/countdown.js` returns English strings directly: `Date unavailable`, `Live now`, `Starting soon`, `Starting in`, `Starts in`, `Today`, `Tomorrow`, and manual `day/days` pluralization.
- `src/routes/LivePage.jsx:52-62` and `src/routes/ExplorePage.jsx:70-73` format compact counts manually using `" k"`.
- `src/routes/ProfilePage.jsx:41` and `src/components/globe/VuvioGlobeLab.jsx:23-24` use `toLocaleString('fr-FR')` for compact numbers despite English being active.
- `src/services/messagingService.js:139` uses `toLocaleTimeString('en-US')`, but day labels like `Today` are literal.
- `src/data/mockMessages.js` contains literal relative dates: `Today`, `Yesterday`, `Monday`, `Sunday`, `yesterday`, `2 min`.
- `src/data/creatorProfiles.js` contains literal dates: `Saturday, July 18`, `Tuesday, July 21`, `Yesterday`, `2 days ago`, `Tomorrow`, `March 2026`.

Future i18n structure:

```json
{
  "time": {
    "todayAt": "Today · {{time}}",
    "tomorrowAt": "Tomorrow · {{time}}",
    "dateUnavailable": "Date unavailable"
  },
  "live": {
    "viewerCount_one": "{{count}} viewer",
    "viewerCount_other": "{{count}} viewers"
  },
  "upcoming": {
    "startsIn": "Starts in",
    "startingIn": "Starting in",
    "startsInDays_one": "{{count}} day",
    "startsInDays_other": "{{count}} days"
  }
}
```

## 13. Accessibility strings

Accessibility copy needing extraction or correction:

| Text | File | Issue | Recommended key |
| --- | --- | --- | --- |
| `Back`, `Profile settings`, `Share profile`, `Edit cover`, `Verified creator`, etc. | `src/routes/ProfilePage.jsx` | Hardcoded English aria/alt labels | `profile.aria.*` |
| `Choisir le globe`, `Zoomer`, `Recentrer` | globe/map files | French accessibility labels | `globe.controls.*` |
| `Lien` | `src/styles/pages/messages.css:817` | CSS depends on French aria-label; fragile for localization | Replace selector strategy later; key `messages.composer.link` |
| `Vuvio private messages`, `Message filters` | `src/routes/MessagesPage.jsx` | Hardcoded English aria labels | `messages.aria.*` |
| `Open live equipment` | `src/routes/ExplorePage.jsx:344`, `src/routes/LivePage.jsx:1071` | Hardcoded English aria | `equipment.openLiveEquipment` |
| `Loading Vuvio` | `src/components/SplashScreen.jsx:5` | Hardcoded status label | `common.loadingVuvio` |
| Empty `alt=""` on decorative images | Multiple card/vision/media files | Usually acceptable if decorative | Review per image during migration |

Avoid announcing one-second countdown updates to screen readers; keep `aria-label` stable or update less frequently.

## 14. PWA and metadata

| File | Finding | Recommendation | Risk |
| --- | --- | --- | --- |
| `index.html:2` | `<html lang="fr">` conflicts with English default | Change to `en` during migration | Low |
| `index.html:10` | Apple app title `Vuvio` is brand; no issue | Keep | Low |
| `index.html:16` | `<title>Vuvio` brand only | Keep or add localized product title later | Low |
| `public/manifest.webmanifest:4` | French description | English source description now; localize manifest later if needed | Low |
| `public/sw.js` | No user-facing offline text or notifications found | No action now | Low |

## 15. External and third-party strings

- Firebase: no runtime Firebase SDK usage was found in `src`; Firebase Hosting only rewrites to `index.html`.
- Browser validation: standard input validation messages may come from the browser if native validation is used; use app-level validation messages for full localization later.
- Map/globe libraries: MapLibre/react-globe visible errors are currently exposed through local strings such as `erreur: {mapError}`. External error objects should be mapped to internal `errors.*` keys.
- Web Share API: share sheets are browser-controlled; localized labels are controlled by the OS/browser.
- Lucide icons: no visible text from the library; all button labels are app responsibility.

## 16. RTL readiness

High-level future RTL concerns:

- Navigation and phone-frame layouts rely on physical left/right positioning and `NavLink` order.
- Discover and live swipe behavior assumes vertical motion, which is mostly RTL-safe, but right-side action rails are hardcoded visually.
- Globe controls and map overlays use absolute `left`/`right` positioning.
- Several CSS files use `margin-left`, `margin-right`, `padding-left`, `padding-right`, and absolute `left`/`right` rather than logical properties.
- Directional icons such as chevrons need mirroring in RTL contexts.
- Text alignment is mostly visual-layout driven and will need per-section review.

Do not implement RTL until English/French extraction is complete.

## 17. Recommended migration order

1. Establish final terminology: `Home`, `Discover`, `Globe`, `Profile`, `Live`, `Upcoming`, `Notify me`, `Reminder on`, `Equipment`.
2. Expand the existing English locale architecture; do not create a second i18n system.
3. Fix metadata source language: `index.html` language and PWA description.
4. Extract shared components: navigation, buttons, badges, CreatorLink, equipment sheet.
5. Extract page-level interface strings in order: Home/LivePage, Discover/ExplorePage, Globe, Profile, Messages, Settings/Support, Vision.
6. Move countdown/date/number labels behind localization helpers with plural support.
7. Classify mock data: UI seed copy versus simulated user-generated content.
8. Add French translations only after English keys stabilize.
9. Add a user-visible language selector and profile preference only after both locale files are complete.
10. Review persistent identifiers only if product requires English IDs; otherwise preserve them and add compatibility aliases.
11. Test all routes, deep links, localStorage state, and Firebase Hosting rewrites.

## 18. Files safe for automatic migration

Likely low-risk first-pass extraction targets:

- `src/components/SearchBar.jsx`
- `src/components/SplashScreen.jsx`
- `src/components/UpcomingItem.jsx`
- `src/routes/EditProfilePage.jsx` visible labels only
- `src/routes/ProfilePage.jsx` visible/aria strings only, excluding stored profile fields
- `src/routes/MessagesPage.jsx` visible/aria strings only
- `src/utils/countdown.js`, if refactored carefully to return keys or receive `t`
- `public/manifest.webmanifest`
- `index.html`

## 19. Files requiring manual review

Sensitive files:

- `src/services/messagingService.js`: localStorage conversation data, report reasons, fallback profiles.
- `src/services/profileService.js`: persisted own profile, generated fallback profiles, compatibility with old fields.
- `src/services/equipmentService.js`: localStorage equipment library and legacy normalization.
- `src/services/createdLiveService.js`: localStorage live drafts and category IDs.
- `src/services/upcomingReminderService.js`: reminder persistence key.
- `src/data/experienceTaxonomy.js`: category IDs and display labels are coupled.
- `src/assets/icons/index.ts` and icon SVG folder names: many French IDs/file paths.
- `src/App.jsx`: routes/deep links should not be renamed without redirects.
- `src/components/BottomNav.jsx`: central navigation and create flow.
- `src/routes/LivePage.jsx`: Home page, live page, upcoming detail, deep links, local timers.
- `src/routes/ExplorePage.jsx`: Discover feed, localStorage hint key, media selection, keyboard/swipe behavior.
- `src/components/globe/*`, `src/components/map/LiveMap.jsx`, `src/routes/MapPage.jsx`: map/globe controls and debug routes.

## 20. Items that should not be translated

Do not translate automatically:

- Brand name `Vuvio`.
- Usernames, creator IDs, and route IDs.
- Real person names and simulated user names, including `Léna Rousseau`, `Thomas Mercier`, `Emma Martin`.
- Real place names such as `Nazaré`, `Étretat`, `Cortina d’Ampezzo`, `Les Arcs`.
- Asset filenames and folder paths unless a coordinated asset migration is planned.
- Firebase project ID `vuvio-bf328`.
- localStorage keys and custom event names without compatibility handling.
- Equipment brand/model names such as `GoPro`, `DJI`, `Canyon`, `POC`.
- URLs and query parameter names.
- Icon library names and source identifiers.
- Raw chat messages if treated as user-generated simulation rather than UI copy.

## 21. Remaining uncertainties

- Production Firebase schema could not be confirmed from local code because no direct Firestore client usage was found.
- It is unclear whether debug routes `/map`, `/globe-lab`, `/globe-test`, and `/icons` are intended to remain accessible in production.
- It is unclear whether `earth` should remain the canonical stored ID for Land or be migrated later.
- The volume of hardcoded English strings is high; this audit gives grouped coverage and representative examples, not a complete line-by-line table for every English sentence.
- Existing dirty/untracked application changes predate this audit; this report does not attempt to classify ownership of those changes.

## 22. Proposed next action

The smallest safe implementation step after this audit is:

1. Keep the current i18n setup.
2. Fix only the confirmed French/mixed runtime UI and metadata findings listed in section 3.
3. Do not rename persistent keys, routes, icon IDs, or category IDs.
4. Add missing English keys to `src/i18n/locales/en.json` and matching French placeholders only after approval.

No migration was performed during this audit.

## Phase 1 English cleanup results

Date: 2026-07-24

### Files modified

| File | Strings corrected |
| --- | --- |
| `index.html` | `<html lang="fr">` → `<html lang="en">` |
| `public/manifest.webmanifest` | `Lives POV immersifs autour du monde.` → `Immersive POV lives around the world.` |
| `src/routes/EditProfilePage.jsx` | `Informations publiques` → `Public information`; `Nom d'utilisateur` → `Username`; `Ville` → `City`; `Pays` → `Country`; `Enregistrement` → `Saving…`; `obligatoire` → `required`; `Edit l'avatar` → `Edit avatar` |
| `src/routes/ProfilePage.jsx` | `Send un message` → `Send message` |
| `src/services/messagingService.js` | `User indisponible` → `Unavailable user`; `indisponible` → `unavailable`; default report reason `Autre` → `Other` |
| `src/services/profileService.js` | `` `${job} en live` `` → `` `Live: ${job}` `` |
| `src/services/reportProblemService.js` | `Les champs obligatoires sont incomplets.` → `Required fields are incomplete.` (not in original audit findings; fixed as it was user-visible French) |
| `src/components/globe/TestGlobe.jsx` | `Globe Actuel Vuvio` → `Current Vuvio globe`; `Globe Test Vuvio` → `Test Vuvio globe`; `erreur: {mapError}` → `Error: {mapError}`; `Choisir le globe` → `Choose globe`; `Actuel` → `Current`; `Zoomer` → `Zoom in`; `Recentrer` → `Recenter` |
| `src/components/globe/VuvioGlobeLab.jsx` | `Choisir le globe` → `Choose globe`; `Actuel` → `Current`; `Zoomer` → `Zoom in`; `Recentrer` → `Recenter` |
| `src/components/map/LiveMap.jsx` | `Recentrer` → `Recenter` |
| `src/routes/MapPage.jsx` | `Choisir le globe` → `Choose globe`; `Actuel` → `Current` |

### Strings corrected: 26

All 25 confirmed audit findings from section 3 were addressed, plus one additional finding (`reportProblemService.js`) discovered during verification search.

### Audit findings intentionally left unchanged

None. All section 3 confirmed French and mixed-language runtime findings were corrected.

### Build result

Build passed. `✓ built in 1m 23s`. No lint or type errors caused by this task.

### Remaining French or mixed-language runtime findings

None confirmed after verification search.

The following items remain out of scope for this phase:

- 350+ hardcoded English strings not yet extracted to locale files (section 4).
- Icon file paths and internal IDs using French slugs (`eau`, `terre`, `avion`, etc.) — section 7.
- Category internal IDs (`earth`, `marine`) — section 7.
- Mock data content (`Léna`, `Nazaré`, real place names) — by design, not UI copy.
- CSS selector `[aria-label="Lien"]` in `messages.css:817` — requires a separate selector strategy change.
- `toLocaleString('fr-FR')` calls in `ProfilePage.jsx` and `VuvioGlobeLab.jsx` — date/number formatting, deferred to a future i18n pass.

### Confirmations

- Routes: unchanged.
- Firebase and persistent localStorage keys: unchanged.
- Component names, variable names, function names, filenames: unchanged.
- Full i18n migration (key extraction, locale files): not started.
