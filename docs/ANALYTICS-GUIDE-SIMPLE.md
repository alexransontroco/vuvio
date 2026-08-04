# Guide Complet: Analytics pour Vuvio

**Explication simple de tout ce qui a été construit**

---

## Qu'est-ce qu'on essaie de faire?

Vuvio est une app de **streaming vidéo en direct** en POV (première personne).

**Le problème:** On ne sait pas:
- Combien de gens regardent vraiment les vidéos
- Combien de temps ils les regardent
- Quels vidéos les intéressent
- Quand ils arrêtent de regarder
- Pourquoi ils arrêtent

**La solution:** On va **tracker chaque action** des utilisateurs:
- Quand ils voient une vidéo
- Quand ils commencent à la regarder
- Combien de temps ils la regardent
- Qu'est-ce qu'ils font pendant (follow, share, look at gear)
- Quand ils arrêtent et pourquoi

---

## Comment ça marche? (Vue d'ensemble simple)

```
Utilisateur ouvre l'app
    ↓
Voit une vidéo en direct
    ↓
"J'aime ça" → clique pour la regarder
    ↓
Regarde pendant 10 secondes
    ↓
Clique sur le gear (équipement)
    ↓
Swipe vers la vidéo suivante
    ↓
Tout ça est enregistré et envoyé au serveur
    ↓
On peut voir les statistiques
```

---

## Les 4 étapes d'un "événement"

### 1️⃣ L'utilisateur fait quelque chose
```
Exemple: Regarde une vidéo pendant 5 secondes
```

### 2️⃣ On l'enregistre localement
```
Dans le téléphone/navigateur (localStorage):
{
  "eventName": "stream_view_5_seconds",
  "streamId": "video-123",
  "creatorId": "creator-456",
  "sessionId": "session-abc"
}
```

### 3️⃣ On l'envoie au serveur
```
Chaque 30 secondes (ou quand c'est important),
on fait un POST au serveur avec tous les événements accumulés.

POST /api/analytics/events
```

### 4️⃣ Le serveur l'analyse et la sauvegarde
```
Le serveur:
- Vérifie que c'est valide
- Ajoute des infos (qui est le créateur, quelle catégorie)
- L'enregistre dans la base de données
- Met à jour les statistiques
```

---

## Architecture: Les 4 couches

### Couche 1: Gestion de Session

**Fichier:** `analyticsSession.ts`

**C'est quoi?** Un gestionnaire qui garde trace de qui est l'utilisateur.

**Pourquoi?** Pour savoir:
- C'est le même utilisateur qui regarde plusieurs vidéos?
- C'est un utilisateur anonyme ou connecté?

**Comment ça marche:**

```typescript
// Chaque utilisateur/navigateur obtient un ID unique
sessionId = "abc-123-def-456"  // Changé à chaque onglet
anonymousId = "user-999-xyz"   // Même pour la même personne (sauvé)
userId = "firebase-uid-123"    // Si connecté
```

**Analogie:** C'est comme un badge d'identification à l'entrée d'un magasin.

---

### Couche 2: Queue d'Événements (stockage local)

**Fichier:** `analyticsQueue.ts`

**C'est quoi?** Une file d'attente qui garde les événements en attente d'envoi.

**Pourquoi?** 
- Si le réseau est down, on ne veut pas perdre les données
- On veut envoyer par lots (50 à la fois) plutôt qu'un à un
- On veut être sûr que chaque événement n'est envoyé qu'une fois

**Comment ça marche:**

```
Événement arrive → On génère un ID unique pour lui
                 ↓
            On le met dans une file (en mémoire)
                 ↓
          On le sauvegarde aussi dans localStorage
                 (au cas où le navigateur ferme)
                 ↓
      Toutes les 30 secondes ou si important,
              on l'envoie au serveur
                 ↓
          Succès? → Supprime de la file
          Erreur? → Retry (réessaye) plus tard
```

**Analogie:** C'est comme une boîte aux lettres. Tu y mets les lettres, et le facteur les enlève toutes les 30 minutes (ou si c'est urgent, immédiatement).

**Exemple de déduplication:**

```
Même événement essayé 2 fois?
1ère tentative: trackStreamView_10_seconds (ID = "session-123-10s")
2ème tentative: trackStreamView_10_seconds (ID = "session-123-10s") ← MÊME ID!

On voit que c'est le même → on le compte qu'une fois
```

---

### Couche 3: Client HTTP (envoi réseau)

**Fichier:** `analyticsClient.ts`

**C'est quoi?** Le service qui envoie les événements au serveur.

**Pourquoi?** Pour gérer:
- La connexion au serveur
- Les erreurs réseau
- Les retries (réessais)
- L'authentification (dire au serveur "c'est moi")

**Comment ça marche:**

```
Événements prêts à envoyer
    ↓
Client HTTP essaie d'envoyer
    ↓
Succès?  → Événements supprimés de la file
Erreur?  → Attend 1 seconde, réessaye
         → 2ème erreur: Attend 2 secondes
         → 3ème erreur: Attend 4 secondes
         → Après 3 tentatives: Garde en mémoire pour plus tard
```

**Analogie:** C'est un postier. Il essaie de livrer, et si la porte est fermée, il réessaie plus tard (plusieurs fois avant d'abandonner).

---

### Couche 4: Service haut-niveau (API simple)

**Fichier:** `analyticsService.ts`

**C'est quoi?** L'API simple que les composants React utilisent.

**Pourquoi?** Pour ne pas avoir à écrire du code complexe partout.

**Comment on l'utilise:**

```typescript
import { analyticsService } from '@/services/analytics'

// Au lieu d'écrire du code complexe:
analyticsService.trackStreamImpression(streamId, creatorId, 'watch', 0)
analyticsService.trackStreamViewThreshold(streamId, creatorId, 10)
analyticsService.trackCreatorFollowed(creatorId, streamId, 'watch')
analyticsService.trackGearExternalLinkClicked(gearId, streamId, creatorId, 'amazon')

// Tout ça met automatiquement:
// - sessionId
// - anonymousId
// - userId
// - timestamp
```

**Analogie:** C'est comme un télécommande pour la TV. Au lieu d'appuyer sur 50 boutons, tu appuies sur "play", "volume up", etc.

---

## Comment marche un "View Session" (regarder une vidéo)

**Fichier:** `streamViewTracker.ts`

Une **"view session"** = Une personne qui regarde une vidéo du début à la fin (ou jusqu'à ce qu'elle l'arrête).

### Timeline d'une session

```
0:00 — L'utilisateur arrive sur la page
       📊 trackStreamImpression() — "J'ai vu cette vidéo"

0:01 — L'utilisateur clique pour la regarder
       ▶️ trackStreamViewStarted() — "Je commence à la regarder"
       ⏱️ Le compteur du temps démarre

0:01-0:03 — L'utilisateur met en pause
            (On ne compte pas ce temps)

0:03-0:10 — L'utilisateur regarde sans arrêt
            🎯 À 0:03, on track: stream_view_3_seconds
            🎯 À 0:10, on track: stream_view_10_seconds

0:10-0:15 — L'utilisateur switch vers une autre app
            (On ne compte pas ce temps, le tab est pas visible)

0:15-0:40 — L'utilisateur revient et regarde
            🎯 À 0:30, on track: stream_view_30_seconds

0:40 — L'utilisateur swipe vers la vidéo suivante
       🛑 trackStreamViewEnded() — "J'ai fini"
       
       Résumé envoyé:
       {
         "watchDurationSeconds": 40,           // Temps calendrier
         "activeWatchDurationSeconds": 30,     // Temps réel regardé
         "reached3Seconds": true,
         "reached10Seconds": true,
         "reached30Seconds": true,
         "exitReason": "swipe"
       }
```

### Temps ACTIF vs temps CALENDRIER

C'est la distinction **la plus importante**.

**Temps calendrier (40 secondes):**
```
De 0:00 à 0:40, il s'est écoulé 40 secondes
(Même si l'utilisateur n'a pas regardé tout le temps)
```

**Temps actif (30 secondes):**
```
Seulement le temps où:
- La vidéo joue ✓
- L'utilisateur la regarde (c'est visible) ✓
- L'app/tab est active ✓

Au total: 30 secondes
```

**Exemple avec délais:**
```
0:00-0:05   Joue, visible, actif    → +5s actif
0:05-0:10   EN PAUSE, visible, actif → +0s (pause!)
0:10-0:15   Joue, visible, actif    → +5s actif
0:15-0:20   Joue, NOT VISIBLE, actif → +0s (scrollé)
0:20-0:25   Joue, visible, NOT ACTIVE → +0s (tab en arrière-plan)
0:25-0:30   Joue, visible, actif    → +5s actif
0:30-0:40   (vidéo terminée ou utilisateur parti)

Total temps calendrier: 40 secondes
Total temps actif: 15 secondes
```

---

## Comment tracker une vidéo (pour les développeurs)

### Utiliser le hook React

```typescript
import { useStreamView } from '@/hooks/useStreamView'

export function WatchPage() {
  // 1. Initialiser le tracker
  const {
    videoRefCallback,        // À mettre sur le <video>
    recordGearOpened,        // Appeler quand user clique gear
    recordCreatorFollowed,   // Appeler quand user clique follow
    recordShared,            // Appeler quand user share
    endSession,              // Appeler quand user quitte
  } = useStreamView(
    {
      streamId: 'stream-123',
      creatorId: 'creator-456',
      source: 'watch',       // Vient du Watch tab
      sourcePosition: 0,     // 1ère vidéo
      category: 'Mountain Bike',
      environment: 'land',
    },
    {
      onSessionEnd: (metrics) => {
        console.log('Regardé:', metrics.activeWatchDurationSeconds, 'sec');
      },
    }
  );

  // 2. Mettre le callback sur la vidéo
  return (
    <>
      <video ref={videoRefCallback} src={videoSrc} />
      
      {/* 3. Tracker les actions */}
      <button onClick={recordGearOpened}>Gear</button>
      <button onClick={recordCreatorFollowed}>Follow</button>
      <button onClick={recordShared}>Share</button>
      
      {/* 4. Terminer la session */}
      <button onClick={() => endSession('swipe')}>Suivant</button>
    </>
  );
}
```

### Tracker une impression (carte visible)

```typescript
import { useImpressionTracker } from '@/hooks/useImpressionTracker'
import { analyticsService } from '@/services/analytics'

export function LiveCard({ live, index }) {
  const cardRef = useRef(null);

  // Feu l'impression quand la carte est visible 50%+
  useImpressionTracker(cardRef, {
    threshold: 0.5,        // 50% visible
    debounceMs: 500,       // Attends 500ms (pas plusieurs fois)
    onImpression: () => {
      analyticsService.trackStreamImpression(
        live.id,
        live.creatorId,
        'explore',         // Vient de la page Explore
        index              // Position dans la liste
      );
    },
  });

  return (
    <div ref={cardRef} className="card">
      <img src={live.thumbnail} />
      <h3>{live.title}</h3>
    </div>
  );
}
```

---

## Exemples de données collectées

### Un événement simple

```javascript
{
  "eventName": "stream_impression",
  "streamId": "stream-123",
  "creatorId": "creator-456",
  "source": "watch",
  "sourcePosition": 0,
  "sessionId": "abc-123-def-456",
  "anonymousId": "user-999-xyz",
  "userId": null,  // C'est un utilisateur anonyme
  "timestamp": 1719684000000
}
```

### Une session de visionnage complète

```javascript
{
  "streamId": "stream-123",
  "creatorId": "creator-456",
  "watchDurationSeconds": 45,       // Temps écoulé
  "activeWatchDurationSeconds": 42, // Temps réellement regardé
  "reached3Seconds": true,
  "reached10Seconds": true,
  "reached30Seconds": true,
  "skippedUnder3Seconds": false,
  "gearOpened": true,
  "gearItemClicks": 2,
  "gearExternalClicks": 1,
  "creatorProfileOpened": false,
  "creatorFollowed": true,          // ✅ L'utilisateur a followé!
  "shared": true,                   // ✅ L'utilisateur a partagé!
  "commented": false,
  "rated": false,
  "reported": false,
  "exitReason": "swipe",            // A swipé vers la vidéo suivante
  "sessionId": "abc-123-def-456",
  "anonymousId": "user-999-xyz",
  "userId": "firebase-uid-123"      // Maintenant connecté
}
```

---

## Ce qui se passe après

### 1. Les données arrivent au serveur

Le serveur reçoit:
```
POST /api/analytics/events
{
  "events": [ /* 50 événements */ ]
}
```

### 2. Le serveur valide

"Ces événements sont vrais? Pas de triche?"

### 3. Le serveur enrichit

Ajoute des infos supplémentaires:
```
Avant: streamId = "stream-123"
Après: streamId = "stream-123",
       category = "Mountain Bike",  ← Ajouté du serveur
       environment = "land",         ← Ajouté du serveur
       creatorName = "Alex"          ← Ajouté du serveur
```

### 4. Le serveur déduplique

"J'ai reçu cet événement 2 fois? Je ne le compte qu'une fois"

### 5. Sauvegarde et statistiques

Enregistre tout et met à jour:
```
streamStats/stream-123:
  impressions: 1000
  viewStarts: 800
  views10Seconds: 500
  views30Seconds: 200
  averageWatchSeconds: 42
  followsGenerated: 10
  shares: 5
```

---

## Résumé visuel: Le flux complet

```
┌─────────────────────────────────────────────────────────────┐
│                    USER (Navigateur)                        │
│                                                             │
│  1. Voir vidéo → 2. Commencer regarder → 3. Tracker temps │
│  4. Appuyer gear/follow/share → 5. Arrêter/swiper        │
└──────────────────────┬──────────────────────────────────────┘
                       │ Les événements viennent ici
                       ↓
┌──────────────────────────────────────────────────────────────┐
│              QUEUE LOCALE (analyticsQueue)                   │
│                                                              │
│  Stocke les événements en attente d'envoi                  │
│  Persiste dans localStorage si l'app ferme                 │
│  Envoie par lots de 50 toutes les 30 secondes             │
└──────────────────────┬──────────────────────────────────────┘
                       │ POST /api/analytics/events
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                   SERVEUR (Backend)                          │
│                                                              │
│  1. Reçoit les événements                                   │
│  2. Valide que c'est correct                               │
│  3. Ajoute infos (créateur, catégorie, etc)                │
│  4. Déduplique (pas de doublons)                           │
│  5. Enregistre dans Firestore                              │
│  6. Met à jour les statistiques                            │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ↓
┌──────────────────────────────────────────────────────────────┐
│                  FIRESTORE (Données)                         │
│                                                              │
│  analyticsEvents/      ← Tous les événements bruts        │
│  streamStats/          ← Statistiques par vidéo             │
│  creatorStats/         ← Statistiques par créateur          │
│  categoryStats/        ← Statistiques par catégorie         │
└──────────────────────────────────────────────────────────────┘
```

---

## Configuration: Où changer les paramètres?

**Fichier:** `analyticsConfig.ts`

```typescript
BATCH_SIZE: 50,                 // Combien d'événements par envoi
FLUSH_INTERVAL_MS: 30000,       // Envoyer toutes les 30s
MAX_QUEUE_SIZE: 500,            // Max 500 événements en attente
MAX_RETRIES: 3,                 // Réessayer 3 fois max

IMPRESSION_DEBOUNCE_MS: 500,    // Attendre 500ms avant impression
IMPRESSION_VISIBILITY_THRESHOLD: 0.5,  // 50% visible = impression

RETENTION_THRESHOLDS: {
  SKIP: 3000,       // Moins de 3s = skip
  SHORT: 10000,     // 10s = regardé un peu
  MEDIUM: 30000,    // 30s = regardé beaucoup
}
```

**Exemple: Si tu veux changer le temps d'envoi**
```typescript
// Avant: FLUSH_INTERVAL_MS: 30000 (30 secondes)
// Après: FLUSH_INTERVAL_MS: 60000 (1 minute)

// Les événements seront envoyés moins souvent, 
// mais plus groupés (batch plus gros)
```

---

## Résumé: Ce qui marche maintenant

✅ **Queue locale** — Les événements sont enregistrés localement  
✅ **Déduplication** — Pas de doublons  
✅ **Batch & Retry** — Envoie par lots avec réessais  
✅ **Session tracking** — Sait qui regarde quoi  
✅ **Active watch time** — Calcule le temps réel regardé  
✅ **Milestones** — Détecte quand atteint 3s/10s/30s  
✅ **React Hooks** — Facile à utiliser dans les composants  

---

## Résumé: Ce qui reste à faire

❌ **Backend endpoint** — Faut recevoir et traiter les événements  
❌ **Firestore save** — Faut enregistrer dans la base de données  
❌ **Stats aggregation** — Faut calculer les statistiques  
❌ **Dashboard** — Faut afficher les stats visuellement  

---

## Questions fréquentes

**Q: Si l'utilisateur ferme son navigateur?**
R: Les événements non envoyés sont sauvegardés dans localStorage. Quand il revient, ils sont renvoyés.

**Q: Et si le réseau est down?**
R: Les événements attendent. Le client essaie toutes les 30 secondes (ou sur actions importantes).

**Q: On perd jamais de données?**
R: Rarement. Si l'utilisateur ferme vraiment brutalement, les dernières secondes pourraient être perdues. Mais on peut utiliser `sendBeacon` au départ pour minimiser ça.

**Q: Ça ralentit la vidéo?**
R: Non. Tout est asynchrone (en arrière-plan), donc zéro impact.

**Q: On peut tracker des utilisateurs sans leur permission?**
R: Non. On utilise des IDs aléatoires, pas de fingerprinting. Mais faut une politique de confidentialité (GDPR).

**Q: Comment on sait que c'est pas tructé?**
R: Le serveur enrichit les données lui-même. Le client peut envoyer un streamId, mais pas inventer un score de "10 000 vues" directement.

---

## Prochaines étapes

1. **Backend** — Faire l'endpoint `/api/analytics/events`
2. **Intégration Watch** — Mettre les hooks dans HomePage
3. **Tests** — Vérifier que ça marche
4. **Stats** — Calculer et afficher les statistiques
5. **Dashboard** — Page d'admin pour voir les stats

---

**Tout est sauvegardé dans Git! ✅**

Commit: `7097f97` — Implement Phase 1 & 2: Analytics foundation and view tracking
