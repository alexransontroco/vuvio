# Codex Changes

## 2026-08-14

### Explore
- Desktop Explore now includes live `createdLives` from Firestore and prioritizes live streams in the grid.
- Live cards in the desktop Explore page now show the stream image and a live badge instead of a static placeholder.

### Watch
- Removed the cover/poster flash on active video playback in Watch.
- Removed the background cover image behind active remote live playback so video starts directly.

### Finish / Replay
- Added a backend `POST /api/streams/:id/finish` route.
- `Finish` now marks the stream as completed in Firestore without deleting the Cloudflare live input immediately.
- Replay cleanup is deferred until Cloudflare sends `video.ready`, so replay polling can still find the live input and complete.
- When replay is ready, the webhook now stores replay metadata in Firestore and deletes the Cloudflare live input.

### Validation
- `npm run build` passes.

## 2026-09-05

### RTMPS Relay — pipeline end-to-end validé + nettoyé (v12)

**Objectif :** Prouver Browser → WebRTC → relay local → FFmpeg → RTMPS → Cloudflare recording end-to-end, puis shipper une version propre.

#### Root causes trouvés et fixés
1. **React StrictMode double-mount tue le broadcast** — cleanup set `active = false` avant que l'ingest RTMPS puisse démarrer.
   Fix `src/routes/WatchPage.jsx` : delayed cleanup via `broadcastCleanupTimerRef` (500ms) + cancellation par ref.
2. **FFmpeg ne démarre jamais sans audio track** — RTMPS exige audio.
   Fix `relay/server.js` : attente 1.5s après premier frame vidéo, puis fallback `anullsrc` silence stéréo 48kHz.
3. **Replays tronqués à ~2s** — relay droppait les frames quand `videoPipe.write()` retournait `false`. Node stream queues en interne, `false` = signal backpressure, pas "drop".
   Fix `relay/server.js` : copie du buffer natif WebRTC dans `Buffer.allocUnsafe` puis `write()` systématique.

#### Nettoyage v11 → v12
- Suppression tee muxer + local FLV + fifo (outils de debug).
- Logs simplifiés, `INACTIVITY_MS` configurable par env var.
- Shutdown : destroy pipes (100ms) → SIGTERM (300ms) → SIGKILL fallback (10s).

#### Fichiers touchés
- `relay/server.js` — réécriture complète (version prod).
- `src/routes/WatchPage.jsx` — StrictMode-safe broadcast cleanup.
- `src/services/webrtcService.js` — log diagnostique tracks dans `startRtmpRelayIngest`.

#### Validation
- v11 : 468 frames → **9.59s replay Cloudflare ready** ✅
- v12 (clean) : 638 frames → **7.2s replay Cloudflare ready** ✅ (truncation résiduelle → voir diagnostic ci-dessous)

---

### RTMPS Relay — Diagnostic truncation (server.diag.js)

#### Outil créé : `relay/server.diag.js`
Version identique à `server.js` + horodatage relatif, stats 5s Node (frames received/written/writableLength/drain/backpressure), capture stderr FFmpeg, tracking exact de qui initie le stop.

#### Résultats du test diagnostique (154s de live)

| Question | Réponse |
|----------|---------|
| A. Frames WebRTC arrivent sur toute la durée ? | ✅ 1897 frames à ~12fps pendant 154s |
| B. FFmpeg encode jusqu'à la fin ? | ❌ Bloqué après 11.83s encodés (144 frames) |
| C. Qui ferme la connexion RTMPS ? | ❌ Personne — la `write()` syscall bloque indéfiniment |

**Timeline clé :**
```
+0.00s   session created
+0.05s   ICE connected
+0.43s   first frame 480x270 (~12fps browser)
+2.04s   FFmpeg started (pid 3709, silence-lavfi)
+2.77s   first pipe drain — FFmpeg lit activement
+14.30s  dernier drain (#145) — FFmpeg arrête de lire pipe:3
elapsed=+5s   frame=62,  time=5.2s,  speed=1.04x  (RTMPS ok)
elapsed=+10s  frame=124, time=10.2s, speed=1.02x  (RTMPS ok)
elapsed=+15s  frame=144, time=11.83s speed=0.789x (BLOQUAGE)
elapsed=+150s frame=144, time=11.83s speed=0.08x  (toujours gelé)
+154.81s SIGTERM envoyé par nous
+154.97s stats FFmpeg flushées d'un coup (buffering stderr non-TTY)
+154.99s EXIT code=255, runtime=152.95s
Cloudflare: 7.2s enregistrés (11.83s encodés, ~4.6s perdus dans buffers TCP)
```

**Cause suspectée / à confirmer : RTMP Window Acknowledgement.**
Après ~491KB envoyés (~12s à 340kbps), le protocole RTMP exige un ACK côté serveur. Hypothèse : Cloudflare met trop longtemps à ACKer (il a reçu 12s d'avance et attend que le temps réel rattrape). La `write()` syscall FFmpeg bloque indéfiniment. Ce n'est pas un timeout (`-rw_timeout=5s` n'a pas tué FFmpeg — il est resté vivant 152s). D'autres causes possibles : GOP/CBR incorrects, timestamps non conformes, problème réseau. À discriminer via tests discriminants.

**Notes techniques :**
- Les stats FFmpeg (`-stats_period 5`) étaient bufferisées en interne (stderr non-TTY = full buffering) → visibles seulement au SIGTERM. Pour monitoring temps-réel : utiliser `stdbuf -o0` ou `-progress pipe:N`.
- `framesWritten` gelé à 154 depuis +15s : le videoPipe est détruit (EPIPE après que FFmpeg a arrêté de lire) mais `session.videoPipe` reste non-null, causing silent failed writes.

---

### Tests discriminants (2 tests pour isoler la cause)

#### Test 1 — FFmpeg synthétique 60s direct → même Cloudflare Live Input

Commande :
```
ffmpeg -f lavfi -i "testsrc=size=480x270:rate=30" \
  -f lavfi -i "sine=frequency=440:sample_rate=48000:beep_factor=0" \
  -c:v libx264 -preset veryfast -profile:v baseline -pix_fmt yuv420p \
  -b:v 800k -minrate 800k -maxrate 800k -bufsize 1600k \
  -g 120 -keyint_min 120 -sc_threshold 0 -x264-params "nal-hrd=cbr" \
  -c:a aac -b:a 128k -ar 48000 -ac 2 -t 62 \
  -stats -stats_period 5 -f flv rtmps://live.cloudflare.com:443/live/...
```

Résultats : speed=3.2-3.35x constant, exit=0, **Cloudflare 60.02s enregistrés** (uid `0cb257b403cabbe5d40fa06667980111`).
HLS segments : 4.021s / 4.000s / 4.000s ... → keyframe interval = 4s ✓ conforme Cloudflare.

**Conclusion : Cloudflare et le réseau sont innocents.** Le problème vient exclusivement de la façon dont notre relay génère le flux FFmpeg.

#### Test 2 — Métriques Cloudflare + analyse config FFmpeg actuelle

**Config FFmpeg server.js (paramètres clés) :**

| Paramètre | relay actuel | synthetic |
|---|---|---|
| `-g` | **30** (1s théorique, ~2.4s effectif à 12fps) | **120** (4s) |
| `-keyint_min` | 30 | 120 |
| `-sc_threshold` | **absent** (scenecut actif) | **0** |
| `-b:v` | **absent** (VBR) | 800k CBR |
| `-minrate/-maxrate` | **absent** | 800k/800k |
| `-bufsize` | **absent** | 1600k |
| `-vsync` | **vfr** | absent (CFR via lavfi) |
| `-use_wallclock_as_timestamps` | **1** | absent |
| `-framerate` input | 30 déclaré (12fps réel) | 30 exact |
| `-rw_timeout` | 5000000 | absent |

**Segments HLS relay (test diagnostique) :** 2.391s / 2.400s / 2.433s → GOP effectif ~2.4s (dans la plage Cloudflare 2-8s, ✓ acceptable).
**Cloudflare API** : `state: ready`, `errorReasonCode: ''` sur tous les replays — pas d'erreur côté Cloudflare.

#### Tableau comparatif final

| | relay actuel | synthetic FFmpeg |
|---|---|---|
| Durée demandée | 154s | 62s |
| Durée encodée FFmpeg | 11.83s | 62.0s |
| Durée Cloudflare | 7.22s | **60.02s** |
| Blocage RTMPS à | elapsed+15s | **aucun** |
| Keyframe interval (HLS) | ~2.4s | **4.0s** |
| Upload/Duration | 7.22/11.83 = 61% | 60.02/62 = **97%** |
| Bitrate | ~340kbps VBR | 937kbps CBR |
| FFmpeg speed | ≈1x → 0.08x (stall) | **3.2x constant** |
| Erreur Cloudflare API | ready, no error | ready, no error |
| FFmpeg exit | 255 (SIGTERM nous) | **0** |

#### Hypothèses sur la cause du blocage relay (à confirmer par test)

Trois différences majeures entre relay et synthetic, non exclusives :

1. **`-use_wallclock_as_timestamps 1` + input 12fps réel déclaré 30fps** — timestamps vidéo depuis la wallclock (horloge absolue), timestamps audio depuis lavfi (samples/48000). Les deux horloges dérivent. Le FLV muxer interleave vidéo (wallclock) + audio (lavfi) : le désalignement croissant peut provoquer un deadlock de buffering interne FFmpeg autour de 12-15s.

2. **`-vsync vfr`** — flux VFR (12fps variable). La source synthétique est CFR stricte (lavfi 30fps). La combinaison VFR + timestamps mixtes produit des FLV packets à intervalles irréguliers qui peuvent saturer le write buffer RTMPS de façon non récupérable.

3. **VBR sans contrainte** — absence de `-bufsize` pour lisser les pics bitrate. Un pic sur une frame I peut momentanément saturer le write kernel buffer. Sans CBR/bufsize, le muxer n'a pas de backpressure interne et peut bloquer sur un gros paquet.

**Prochaine étape suggérée** : tester le relay avec `-use_wallclock_as_timestamps` supprimé, `-vsync cfr` (ou `-fps_mode cfr`), et bitrate contraint (`-b:v 800k -maxrate 800k -bufsize 1600k`) — une variable à la fois si possible.

## 2026-09-05

### RTMPS Relay — end-to-end pipeline validated + cleaned

**Goal:** Prove Browser → WebRTC → local relay → FFmpeg → RTMPS → Cloudflare recording works end-to-end, then ship a production-clean version.

#### Root causes found and fixed
1. **React StrictMode double-mount killed broadcast setup** — the cleanup function set `active = false` before the RTMPS relay ingest could start.
   - Fix in `src/routes/WatchPage.jsx`: delayed cleanup via `broadcastCleanupTimerRef` (500 ms) + ref-based cancellation on remount; removed `if (!active)` guard between `startBroadcast` and `startRtmpRelayBroadcast`.
2. **FFmpeg never spawned when browser sent no audio track** — RTMPS requires audio.
   - Fix in `relay/server.js`: after first video frame, wait up to 1.5 s for audio; if none, fall back to `anullsrc` (silent lavfi stereo 48 kHz).
3. **Cloudflare replays truncated to ~2 s (main issue)** — relay was silently dropping video frames whenever `videoPipe.write()` returned `false`. Node streams queue internally, so `false` is a backpressure signal, not a "must drop" instruction.
   - Fix in `relay/server.js`: never drop; copy the native WebRTC buffer into a fresh `Buffer.allocUnsafe` and always `write()`.

#### Additional relay changes (v11 → v12 cleanup)
- Removed tee muxer + local FLV output + fifo wrapper (were only for isolation testing).
- Removed `[RELAY] / [FFMPEG] / [CLOUDFLARE] / [LOCAL-FLV]` diagnostic tags and per-frame stats.
- Kept working FFmpeg config: `-framerate 30 -use_wallclock_as_timestamps 1` on video input; `-vsync vfr`; `-preset ultrafast -profile:v baseline`; `anullsrc` fallback.
- Shutdown sequence: close pipes (100 ms) → SIGTERM (300 ms, needed because `anullsrc` is infinite so video EOF alone doesn't stop FFmpeg) → SIGKILL fallback (10 s).
- `INACTIVITY_MS` now configurable via env var (default 2000 ms).

#### Files touched
- `relay/server.js` — full rewrite (clean production version).
- `src/routes/WatchPage.jsx` — StrictMode-safe broadcast cleanup.
- `src/services/webrtcService.js` — track diagnostic log in `startRtmpRelayIngest`.

#### Validation
- v11 test: 468 frames received → 147 encoded → **9.59 s Cloudflare replay ready** ✅
- v12 (cleaned) test: 638 frames received → **7.2 s Cloudflare replay ready** (UID `8d7ad88923d1a7674ceff60b711ce56a`) ✅
- Cloudflare live input: `e484467f4d8ee11b561790cef8d33a32` (recording=automatic).
- Watch base URL: `https://customer-j07oorpjh7x2xiuf.cloudflarestream.com/{uid}/watch`.

#### Key learnings (for future work)
- Never drop on Node stream backpressure — `write()` returning `false` is normal; the stream queues internally.
- Cloudflare RTMPS ingest **requires** an audio track — always ensure one is present (real or synthesized silence).
- FFmpeg with `anullsrc` won't stop on video pipe EOF because lavfi is infinite → send SIGTERM explicitly to finalize the FLV trailer.
- React StrictMode double-invokes effects in dev; any effect that starts an async pipeline needs a delayed-cleanup pattern.

---

## 2026-09-05

### RTMPS Relay — Root cause du stall confirmé + fix (tests A2/A3)

#### Contexte

Après le diagnostic v12, les replays Cloudflare étaient encore tronqués (~7s max sur des lives >60s). FFmpeg stall absolu documenté à ~11.83s d'encodé : frame count gelé pendant 45+ secondes. Cause suspectée : `-vsync vfr` + `-use_wallclock_as_timestamps 1`.

#### Test A2 — Suppression wallclock + déclaration fps correcte

**Config** : suppression de `-use_wallclock_as_timestamps 1`, `-framerate 30` → `-framerate 12` (fps réel mesuré). Tout le reste identique à server.js.

**Bug découvert** : WebRTC ramp-up de résolution (320x180 → 480x270 → 640x360 → 960x540 → 1280x720) pendant les ~30 premières secondes. La vérification `byteLen === expectedSize` (basée sur la résolution du frame #0) rejette tous les frames de résolution différente. Fix : attendre 800ms de stabilité avant de démarrer FFmpeg, logger les rejets.

**Résultat A2** : **STALL NON CORRIGÉ.** Segment 480x270 (audio=silence-lavfi) :
```
elapsed=5s:  frame=71,  time=5.91s, speed=1.18x
elapsed=10s: frame=125, time=10.41s, speed=1.04x
elapsed=15s: frame=125, time=10.41s, speed=0.694x  ← GELÉ
elapsed=20s: frame=125, time=10.41s, speed=0.52x   ← GELÉ 45s+
```
`-use_wallclock_as_timestamps` n'est pas la cause du stall.

#### Test A3 — `-vsync vfr` → `-fps_mode cfr`

**Config** : A2 keepé + `-fps_mode cfr` remplace `-vsync vfr`. Fix supplémentaire : restart FFmpeg automatique sur changement de résolution (chaque résolution = connexion RTMPS distincte, enregistrement Cloudflare séparé).

**Résultat A3** : **STALL RÉSOLU.** Segment 960x540 (18s runtime FFmpeg) :
```
elapsed=5s:  frame=64,  time=5.33s,  speed=1.07x
elapsed=10s: frame=125, time=10.41s, speed=1.04x  ← A2 gelait ici
elapsed=15s: frame=185, time=15.41s, speed=1.03x  ← VIVANT
elapsed=17s: frame=194, time=16.16s, speed=0.922x ← exit propre (notre SIGTERM)
```
Segment 1280x720 (25s runtime FFmpeg) :
```
elapsed=10s: frame=106, time=8.83s, speed=0.883x
elapsed=20s: frame=133, time=11.08s, speed=0.554x ← dépassé le seuil critique
elapsed=24s: frame=145, time=12.08s, speed=0.489x ← exit propre (res-change)
```
Frame count jamais gelé. Aucun blocage RTMPS.

#### Cause confirmée

**`-vsync vfr`** produisait des FLV packets à intervalles temporels irréguliers. Le protocole RTMPS (et son mécanisme de Window Acknowledgement) exige une cadence temporelle régulière côté muxer. Avec VFR et une source WebRTC à ~12fps variable, les timestamps FLV devenaient assez irréguliers pour bloquer le write syscall de façon permanente autour de 10-12s d'encodé.

**`-fps_mode cfr`** force une cadence de sortie constante (12fps) en dupliquant les frames si l'entrée est trop lente, ce qui produit des FLV packets réguliers compatibles avec le flow control RTMPS.

#### Bug fix additionnel : résolution WebRTC instable

Le browser WebRTC ramp up sa résolution pendant les ~30 premières secondes (320x180 → 480x270 → 640x360 → 960x540 → 1280x720). Solution : restart FFmpeg à chaque changement de résolution. Chaque segment crée sa propre connexion RTMPS → enregistrement Cloudflare séparé.

#### Fichiers créés
- `relay/server.a2.js` — test A2 (no wallclock, fps=12) [archivé]
- `relay/server.a3.js` — test A3 (CFR + auto-resize) [base pour prod]

#### Prochaine étape
Porter les fix de server.a3.js vers server.js (prod) : `-fps_mode cfr`, restart sur resize, stabilisation résolution 800ms.

---

## 2026-09-06

### Stale Cloudflare credentials bug — root cause + fix

#### Symptôme
Chaque nouveau live dans Vuvio envoyait au relay les credentials de l'ancien Live Input Cloudflare supprimé (`e484467f...`). FFmpeg = `broken pipe (code=224)` immédiatement. Aucun enregistrement Cloudflare. Le Live Input `8a9bc4b9...` (vuvio-test-timeout10) n'avait reçu 0 vidéos.

#### Trace exacte du bug

1. **Firestore** `created-1788646481818` avait `webRTCUrl: PRESENT`, `streamKey: PRESENT`, `cloudflareLiveInputId: e484467f...` (Live Input depuis longtemps supprimé côté Cloudflare).

2. **WatchPage.jsx ligne 1390** : `if (live.webRTCUrl && live.streamKey)` → bypass complet du backend `/api/cloudflare/live-input/create`. Le frontend réutilisait silencieusement les credentials Firestore stales (WHIP). `relayCredentials` restait `null`.

3. **Standalone override path** : lisait `sessionStorage.getItem('vuvio.rtmpsIngestUrl')` et `vuvio.rtmpsStreamKey` persistés lors d'une session précédente avec `?relayLocal=1&rtmpsIngestUrl=...&rtmpsStreamKey=...`. Ces clés sessionStorage pointaient sur le même Live Input supprimé.

4. **Relay** recevait `liveInputId=created-1788646481818` + streamKey `...ke484467f...` → broken pipe immédiat (Cloudflare = 404 sur ce Live Input).

#### Fixes appliqués

**`functions/src/cloudflare/createLiveInputHandler.ts`** :
- Suppression du `const useRelay` inutilisé.
- Avant de créer un nouveau Live Input : lecture du doc Firestore existant, vérification via `client.getLiveInput(existingCfUid)`. Log explicite si stale/supprimé.
- Log ajoutés : `[createLiveInput] requested for Vuvio live=X`, `Cloudflare UID = Y`, `timeoutSeconds = 10`.
- Vérification post-création : `client.getLiveInput(newUid)` immédiate, log `exists=true/false`.

**`src/routes/WatchPage.jsx`** :
- **Suppression du bypass** `if (live.webRTCUrl && live.streamKey)` : le backend est TOUJOURS appelé pour obtenir des credentials frais.
- `?relayLocal=1` remplace le relay URL par `http://localhost:8787` mais utilise les credentials renvoyés par le backend (jamais depuis sessionStorage).
- Suppression de la "standalone override path" entière (lisait `sessionStorage` avec des RTMPS creds potentiellement stales).
- sessionStorage : ne persiste plus que `relayLocal`, jamais `rtmpsIngestUrl`/`rtmpsStreamKey`/`liveInputId`.
- Log pre-relay : `[INGEST][PRE-RELAY]` juste avant `startRtmpRelayBroadcast` → affiche Vuvio live id, CF liveInputId, ingestUrl, suffixe streamKey.

#### Invariant après fix
Pour chaque Start Live :
- Le backend crée un NOUVEAU Live Input Cloudflare (credentials frais garantis).
- Le relay reçoit toujours le UID et la streamKey du Live Input créé à l'instant.
- Aucune credential stale possible depuis Firestore ou sessionStorage.

#### Validation
- `npm run build` (functions TypeScript + Vite frontend) : ✅ sans erreur.
- `firebase deploy --only functions,hosting:vuvio-bf328` : ✅ déployé.

#### Test final — objectif atteint ✅

**Config** : local relay (`?relayLocal=1` + sessionStorage persistence), `-fps_mode cfr`, restart-on-resize, `timeoutSeconds=10`.

**Résultat** :
- Live Vuvio : `created-1788648675088`
- CF Live Input : `61c0936510589c6e673dfc942384f2e6`
- Durée du live : ~2m49s (169s)
- **Vidéos Cloudflare : 1** (uid `5f0c64979e1d3709bce6d7c597f5e203`)
- **Durée replay : 125.15s** — state=ready ✅

**1 live Vuvio = 1 Live Input Cloudflare valide = 1 Video ID = 1 replay complet.**

`timeoutSeconds=10` fusionne les reconnexions RTMPS (dues aux restarts FFmpeg sur chaque changement de résolution WebRTC) en une seule vidéo Cloudflare.

#### Note architecture — cloud relay non fonctionnel (Cloud Run / WebRTC ICE)
Le relay déployé sur Cloud Run (`rtmps-relay-221631631138.europe-west1.run.app`) ne peut pas établir de connexion WebRTC ICE depuis le browser : Cloud Run n'expose que HTTPS (TCP), pas les ports UDP nécessaires à ICE. Le relay local (`localhost:8787`) est la solution fonctionnelle. Pour la production, le relay devra tourner sur une VM avec IP publique + ports UDP ouverts, ou avec un serveur TURN.
