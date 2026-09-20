# Vuvio — Infrastructure vidéo, relay et hébergement

**Dernière mise à jour : septembre 2026**

## 1. Situation actuelle

Vuvio utilise actuellement plusieurs services spécialisés plutôt qu'un serveur unique pour toute l'application.

Architecture actuelle / prévue :

```text
Frontend
   │
   ├── Firebase Hosting
   │
   ▼
Firebase
   ├── Authentication
   ├── Firestore
   ├── Cloud Functions
   └── Storage
   │
   └── gestion des utilisateurs, lives, profils, messages, métadonnées, etc.
   
Streaming vidéo
   │
   ▼
Navigateur / téléphone
   │
   ├── WebRTC
   │
   ▼
Vuvio Relay
   │
   ├── Node.js
   ├── WebRTC / ICE
   └── FFmpeg
   │
   ├── RTMPS
   ▼
Cloudflare Stream
   │
   ├── diffusion du live
   ├── encodage
   └── création du replay
```

---

## 2. Pourquoi Vuvio a besoin d'un relay

Le téléphone de l'utilisateur peut envoyer directement un live vers Cloudflare avec **WHIP/WebRTC**.

Cela fonctionne très bien pour le direct.

Le problème est le replay.

Cloudflare Stream ne permet actuellement pas de transformer automatiquement un live reçu en WHIP en replay de la même manière qu'un live reçu en RTMPS.

Pour obtenir :

```text
LIVE + REPLAY
```

Vuvio utilise donc un relay intermédiaire :

```text
Téléphone
   ↓ WebRTC
Vuvio Relay
   ↓ RTMPS
Cloudflare Stream
   ↓
Live + Replay
```

Le relay reçoit donc la vidéo WebRTC du navigateur puis utilise FFmpeg pour l'envoyer vers Cloudflare en RTMPS.

---

## 3. Validation du relay

Le système a déjà été validé en local.

Pipeline testé :

```text
Téléphone
   ↓
WebRTC
   ↓
Relay local
   ↓
FFmpeg
   ↓
RTMPS
   ↓
Cloudflare Stream
```

Résultats obtenus :

* connexion ICE établie ;
* audio + vidéo reçus par le relay ;
* codec VP8 reçu correctement ;
* FFmpeg démarre au premier frame ;
* pas de restart continu de FFmpeg ;
* résolution progressivement stabilisée jusqu'à 854×480 ;
* flux envoyé correctement vers Cloudflare ;
* replay créé après la fin du live.

Le principe technique est donc validé.

---

## 4. Pourquoi le relay local fonctionne

Pendant le développement, le relay tourne directement sur le Mac :

```text
https://localhost:8787
```

Le Mac agit temporairement comme serveur de streaming.

C'est suffisant pour :

* développer ;
* tester ;
* vérifier les replays ;
* tester le pipeline Cloudflare ;
* corriger les problèmes FFmpeg/WebRTC.

Coût :

```text
0 €
```

Tant que Vuvio n'a pas d'utilisateurs externes, il n'est pas nécessaire d'héberger ce relay sur Internet.

---

## 5. Pourquoi Cloud Run n'est pas adapté au relay

Une première version du relay a été déployée sur Google Cloud Run.

Le serveur HTTP répondait correctement :

```text
Browser → POST /sessions → Cloud Run
                    ← 200 OK
```

Mais la connexion média WebRTC restait bloquée :

```text
ICE state: connecting
```

puis :

```text
Relay ICE connection timeout
```

Le relay WebRTC nécessite une infrastructure réseau adaptée aux connexions ICE et au trafic média.

Cloud Run est très adapté aux APIs HTTP stateless, mais pas à ce type de relay WebRTC temps réel.

Conséquence :

```text
Cloud Run
    ↓
ICE timeout
    ↓
fallback WHIP
    ↓
Live fonctionne
    ↓
Mais pas de replay
```

Le relay doit donc être hébergé sur une machine ayant un contrôle réseau plus classique.

---

## 6. Solution pour la bêta publique : VPS

Quand Vuvio accueillera ses premiers vrais utilisateurs, le relay local sera déplacé vers un **VPS**.

VPS = **Virtual Private Server**.

C'est une petite machine Linux disponible 24/7 sur Internet.

Elle peut faire tourner :

```text
Node.js
FFmpeg
relay/server.js
```

et disposer d'une IP publique avec les ports réseau nécessaires.

L'architecture deviendra :

```text
Utilisateur Vuvio
       │
       │ WebRTC
       ▼
relay.vuvio.app
       │
       │ RTMPS
       ▼
Cloudflare Stream
       │
       ├── Live
       └── Replay
```

---

## 7. Choix envisagé : OVHcloud

Plusieurs hébergeurs ont été envisagés :

* OVHcloud
* Hetzner
* Fly.io
* Google Compute Engine

Pour Vuvio, **OVHcloud est une option particulièrement logique**.

Raisons :

* société européenne/française ;
* VPS simples ;
* IP publique ;
* contrôle du firewall ;
* possibilité de faire tourner Node et FFmpeg ;
* infrastructure pouvant évoluer avec Vuvio ;
* coûts faibles pour commencer ;
* Douglas utilise déjà OVH pour ses propres serveurs et connaît l'environnement.

Pour la bêta, un petit VPS est suffisant pour commencer.

Exemple :

```text
OVH VPS
│
├── Ubuntu
├── Node.js
├── FFmpeg
├── Vuvio Relay
└── HTTPS
```

Adresse possible :

```text
relay.vuvio.app
```

au lieu de :

```text
localhost:8787
```

---

## 8. Le relay ne doit PAS remplacer toute l'infrastructure Vuvio

Le fait d'utiliser OVH pour le relay ne signifie pas qu'il faut migrer tout Vuvio vers OVH.

L'architecture recommandée reste hybride.

### Frontend

```text
Firebase Hosting
```

À conserver.

### Authentication

```text
Firebase Authentication
```

À conserver.

### Base de données

```text
Firestore
```

À conserver.

### Backend / APIs

```text
Firebase Cloud Functions
```

À conserver pour le moment.

### Vidéo

```text
Cloudflare Stream
```

À conserver.

### Relay

```text
OVH VPS
```

C'est la seule partie qui a réellement besoin d'un serveur classique pour le moment.

---

## 9. Fallback de sécurité

Vuvio possède déjà une logique de fallback intéressante.

Si le relay fonctionne :

```text
WebRTC → Relay → RTMPS → Cloudflare → Live + Replay
```

Si le relay ne fonctionne pas :

```text
WebRTC / WHIP → Cloudflare directement → Live (sans replay)
```

Le live peut donc continuer même si le relay est indisponible. Dans ce cas la section replay est masquée dans le récap (`LiveRecapPage` conditionne `{replayUrl && ...}`).

---

## 10. Pourquoi ne pas migrer vers Mux

Mux avait été envisagé comme alternative à Cloudflare (WHIP → Live + Replay sans relay).

Après vérification, ce n'est pas une solution pertinente actuellement : migration coûteuse (APIs, player, webhooks, assets) sans bénéfice clair.

**Décision : Cloudflare Stream conservé.**

---

## 11. Stratégie infrastructure par étapes

### Phase 1 — Développement actuel

```text
Users : 0 / tests internes
Relay : Mac local (https://localhost:8787)
```

Objectif : Stabiliser complètement le live et le replay.

### Phase 2 — Première bêta

Installer le relay sur un petit VPS OVH (`relay.vuvio.app`).

Objectif : Permettre à n'importe quel utilisateur de lancer un live avec replay sans dépendre du Mac de développement.

### Phase 3 — Mesure

Mesurer CPU, RAM, bande passante, nombre de lives simultanés, stabilité ICE avant d'augmenter l'infrastructure.

### Phase 4 — Scaling (si nécessaire)

Load balancer + plusieurs relay VPS. À construire uniquement quand le trafic le justifie.

---

## 12. Décision actuelle

### À conserver

```text
Firebase Hosting / Auth / Firestore / Functions / Storage
Cloudflare Stream
```

### À ajouter avant la bêta publique

```text
1 petit VPS OVH pour le Vuvio Relay
```

### À ne pas faire maintenant

```text
Migrer Firebase vers OVH
Migrer Cloudflare vers Mux
Construire une infrastructure multi-relay
```
