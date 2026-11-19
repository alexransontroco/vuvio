# Outils IA de développement — Claude-Mem et OmniRoute

Status: Current
Last reviewed: 2026-11-18
Read before coding: Consulter avant toute tentative d'installation de Claude-Mem, OmniRoute ou de nouveaux outils IA locaux sur la machine de développement.

---

## 1. Contexte

Cette fiche consigne les recherches et tentatives d'installation menées autour de deux outils IA tiers :

- **Claude-Mem** — mémoire persistante cross-sessions pour agents de code (Claude Code, Codex, Cursor, OpenCode, etc.).
- **OmniRoute** — routeur unifié vers 380+ fournisseurs LLM, avec fallback automatique, APIs compatibles OpenAI, cache/compression des prompts.

L'objectif est de pouvoir reprendre ce sujet ultérieurement sans refaire la recherche, notamment pour un déploiement distant une fois la contrainte macOS levée.

---

## 2. Claude-Mem

### 2.1 Présentation

- **Pitch** : "Persistent memory for AI coding agents: the next session starts where the last one left off."
- **Mécanisme** : hooks qui capturent les transcripts de chaque session, les compressent, les indexent dans une base locale, puis les injectent au démarrage de la session suivante.
- **Interface** : viewer web local `http://localhost:37777` + CLI `claude-mem` + skills `/claude-mem:*` dans Claude Code.
- **Licence** : Apache-2.0.
- **Dépôt** : https://github.com/thedotmack/claude-mem
- **NPM** : https://www.npmjs.com/package/claude-mem (v15.21.0 au 2026-11-17)
- **Publisher** : Alex Newman (`thedotmack`).

### 2.2 Fonctionnalités clés

- Capture automatique des sessions Claude Code via plugin.
- Compression des transcripts (knowledge graph).
- Recherche sémantique cross-sessions (`/claude-mem:mem-search`).
- Skills orchestrateurs : `make-plan`, `do`, `build`, `handoff`, `babysit`, `release`, `learn-codebase`, `smart-explore`, `weekly-digests`, etc.
- Export/sync cloud optionnel via **cmem.ai Pro** (payant, hors scope ici).
- Mode worker + viewer sur `localhost:37777`.

### 2.3 État de l'installation sur la machine actuelle (macOS 10.15.7)

**Installé et fonctionnel**
- CLI global via `npm install -g claude-mem` → `claude-mem` disponible dans le PATH.
- Marketplace clonée dans `~/.claude/plugins/marketplaces/thedotmack` (`git clone https://github.com/thedotmack/claude-mem`).
- Entrée ajoutée dans `~/.claude/plugins/known_marketplaces.json`.
- Plugin activé via `/plugin` dans Claude Code → skills `/claude-mem:*` visibles dans la liste.

**Non fonctionnel**
- Service worker (`claude-mem start`, viewer `localhost:37777`, hooks de capture auto) → nécessite **Bun**.
- Bun non installable sur ce poste (voir §4).
- Conséquence : la capture automatique de session ne tourne pas ; seuls les skills manuels s'exécutent.

### 2.4 Problèmes rencontrés pendant l'install

1. `claude-mem install` → appelle `claude plugin marketplace add thedotmack/claude-mem` qui crashe :
   ```
   dyld: Symbol not found: __ZTVNSt3__115basic_stringbufIc...
   Referenced from: /Users/alexandreranson/.nvm/versions/node/v18.20.8/bin/claude
   (which was built for Mac OS X 13.0)
   ```
   → le CLI `claude` fourni par npm est compilé pour macOS 13+ et n'est pas exécutable sur Catalina.
   **Contournement appliqué** : clone manuel du marketplace + édition manuelle de `known_marketplaces.json` + activation via `/plugin` dans Claude Code (qui tourne, lui, en JS pur).

2. `claude-mem status` → spawn `bun worker-service.cjs status`, qui ne trouve pas Bun.
   **Blocage non résolu** (voir §4).

---

## 3. OmniRoute

### 3.1 Présentation

- **Pitch** : "Unified AI router with 380 providers, RTK+Caveman compression, auto fallback, MCP/A2A, desktop, PWA, and OpenAI-compatible APIs."
- **Site** : https://omniroute.online
- **Dépôt** : https://github.com/cheaper-inference/OmniRoute
- **NPM** : https://www.npmjs.com/package/omniroute (v3.8.53 au 2026-11-17)
- **Licence** : MIT.
- **Mainteneurs** : `eamonnkeak`, `diegosouza.pw`.
- **Taille** : package unpacked **914.9 MB** (contient Next.js, React 19, Ink, 105 dépendances).

### 3.2 Fonctionnalités clés

- Proxy HTTP local exposant une API **compatible OpenAI** (drop-in dans n'importe quel client OpenAI SDK).
- Routage automatique entre fournisseurs : Anthropic, OpenAI, Google, DeepSeek, Mistral, Groq, Together, Fireworks, OpenRouter, Ollama local, etc. — 380+ providers annoncés.
- **Fallback automatique** : si un provider est down / rate-limité / cher, bascule sur un autre selon des règles.
- **Gestion de quotas** (free tier tracking, rotation entre comptes).
- **Compression RTK + "Caveman"** — compression des prompts pour réduire tokens.
- Compatible protocoles **MCP** et **A2A**.
- Interface desktop (Electron/Ink) + PWA + CLI.
- Binaires exposés : `omniroute`, `omniroute-reset-password`.

### 3.3 Intégrations ciblées

- **Claude Code** → en pointant `ANTHROPIC_BASE_URL` (ou équivalent) vers `http://localhost:<port>/anthropic`, Claude Code envoie ses requêtes à OmniRoute qui route derrière.
- **Codex CLI** → endpoint OpenAI-compatible, identique mais pour l'API d'OpenAI.
- **Cursor / Cline / autres clients compatibles OpenAI** → même principe.
- **Bénéfices attendus** : économies via routage vers fournisseurs moins chers / gratuits, résilience aux pannes, visibilité unifiée des coûts, caching et compression.

### 3.4 Tentatives d'installation locale

#### Tentative 1 — install directe
```
npm install -g omniroute
```
→ **ECONNRESET** pendant le téléchargement (915 MB, connexion rompue).

#### Tentative 2 — install avec retries réseau
```
npm install -g omniroute --fetch-retries=5 --fetch-retry-mintimeout=20000
```
→ download OK, mais la dépendance native **`better-sqlite3`** (transitive) échoue en compile :
```
error: invalid value 'c++20' in '-std=c++20'
make: *** [Release/obj.target/better_sqlite3/src/better_sqlite3.o] Error 1
```
→ le Clang de macOS 10.15 ne supporte que **C++17** (pas `c++20`, seulement `c++2a` draft).
Pas de prebuilt binaire pour ce couple darwin-x64 / macOS 10.15 non plus.

#### Analyse post-mortem
- `better-sqlite3` est une dép **transitive** (absente du `dependencies` direct d'omniroute, pullée par un sous-paquet).
- Même en contournant better-sqlite3, omniroute déclare :
  ```json
  "engines": { "node": ">=22.22.2 <23 || >=24.0.0 <27" }
  ```
  → Node ≥ 22.22.2 requis.
- Le poste tourne sur **Node 18.20.8** (nvm).
- Node 22+ nécessite macOS 11+ pour les binaires officiels → impossible d'upgrader via nvm sur Catalina.

#### Nettoyage effectué
- `npm uninstall -g omniroute` → 904 packages retirés, 1.1 GB récupérés dans `node_modules` global.

### 3.5 État final : OmniRoute non installable localement sur ce poste.

---

## 4. Racine commune : macOS Catalina 10.15.7

Tous les blocages rencontrés convergent vers la même limite : **macOS 10.15.7 Catalina + Node 18 + Clang 12** est en dessous des pré-requis actuels de l'écosystème JS moderne.

### 4.1 Diagnostic Bun

Testé en séquence pour faire tourner le worker Claude-Mem :

| Version Bun            | Résultat                                                              |
|------------------------|-----------------------------------------------------------------------|
| 0.5.9 (avril 2023)     | Tourne, mais trop vieux pour parser le `worker-service.cjs` moderne.  |
| 1.0.0                  | `--version` OK, mais le worker reste bloqué 90s+ à 54 % CPU.          |
| 1.1.0 x64              | SIGILL — nécessite AVX2, absent du CPU.                               |
| 1.1.0 baseline         | dyld `_pwritev$NOCANCEL` manquant → nécessite macOS 11+.              |
| 1.2+ (current)         | Compilé pour macOS 13+.                                               |

**Conclusion** : aucune version de Bun n'est à la fois exécutable sur 10.15 ET assez récente pour faire tourner le code moderne de claude-mem.

### 4.2 Diagnostic Node

- Node 18.20.8 tourne (installé via nvm).
- Node 22.x — binaires officiels macOS requièrent macOS 11+.
- Compilation Node 22 from source sur Catalina : faisable en théorie mais dépend de Xcode CLT ≥ 14 (non disponible sur Catalina, bloqué à Xcode 12).

### 4.3 Diagnostic Clang / C++

- Clang disponible sur Catalina : version 12.x (Xcode 12).
- Supporte jusqu'à C++17.
- Flag `-std=c++20` rejeté.
- better-sqlite3 récent exige C++20 explicitement.

### 4.4 Diagnostic binaire `claude` CLI

- Installé via `npm install -g @anthropic-ai/claude-code` puis invoqué par `claude-mem install`.
- Crash immédiat : `dyld: Symbol not found` — binaire compilé pour macOS 13+.
- Workaround appliqué : manipuler directement les fichiers de plugin sans passer par le CLI `claude` (voir §2.3).

### 4.5 Verdict

Débloquer tout l'écosystème nécessite **soit** :

- Upgrade macOS → **11+ au minimum, 13+ recommandé** (Big Sur / Monterey / Ventura / Sonoma / Sequoia).
- **Ou** déport sur une machine Linux distante (voir §5).

---

## 5. Solution recommandée : auto-héberger OmniRoute sur un VPS Linux

### 5.1 Pourquoi un VPS ?

- Permet d'exécuter OmniRoute sur Ubuntu 22.04+ / 24.04+ sans toucher à Catalina.
- OmniRoute devient accessible depuis plusieurs machines (Mac actuel + éventuel futur Mac).
- Centralisation des clés API provider côté serveur (pas de secrets locaux).
- Persistance : logs, historique, cache, quotas conservés 24/7.

Claude-Mem reste installé localement sur le Mac (la capture a besoin d'être côté client Claude Code). Seul OmniRoute passe sur le VPS.

### 5.2 Options d'hébergement

#### Oracle Cloud Free Tier — **recommandé pour commencer**

- **Toujours gratuit** : 4 cœurs ARM Ampere A1 + 24 GB RAM + 200 GB block storage, OU 2 VMs AMD (1 vCPU / 1 GB chacune).
- Disponibilité réelle variable (A1 ARM parfois tendue selon la région).
- Permet de tester OmniRoute à coût zéro.
- Région : Paris / Francfort pour latence depuis la France.
- URL : https://www.oracle.com/cloud/free/

#### OVHcloud VPS

- VPS Starter (1 vCPU, 2 GB RAM, 20 GB SSD) : ~**3-5 €/mois** HT.
- VPS Value (2 vCPU, 4 GB, 80 GB) : ~**6-8 €/mois** HT.
- Datacenter France (Gravelines / Roubaix / Strasbourg), latence minimale.
- Facturation mensuelle, sans engagement long.
- URL : https://www.ovhcloud.com/fr/vps/

#### Hetzner Cloud — meilleur rapport puissance/prix UE

- CX22 (2 vCPU, 4 GB, 40 GB) : ~**4,51 €/mois** TTC.
- CX32 (4 vCPU, 8 GB, 80 GB) : ~**7,05 €/mois** TTC.
- Datacenters Falkenstein / Nuremberg / Helsinki (bonne latence depuis la France).
- URL : https://www.hetzner.com/cloud

#### Scaleway (France)

- Stardust (1 vCPU, 1 GB, 10 GB) : ~**0,0025 €/h** soit ~1,80 €/mois.
- DEV1-S (2 vCPU, 2 GB, 20 GB) : ~**7 €/mois**.
- URL : https://www.scaleway.com/fr/tarifs-cloud-elements/

#### Autres pistes
- DigitalOcean Droplet 1 GB : ~6 $/mois.
- Vultr : ~6 $/mois config équivalente.
- Netcup : VPS 2000 G11 (4 vCPU, 8 GB) à ~5 €/mois (meilleur ratio mais datacenter DE/AT).

### 5.3 Configuration matérielle recommandée pour OmniRoute

Besoins réels à la louche (proxy stateless + SQLite local, pas de LLM hébergé) :

| Usage                            | vCPU | RAM   | Disque  |
|----------------------------------|------|-------|---------|
| Perso solo, usage léger          | 1    | 2 GB  | 20 GB   |
| Perso + petits agents parallèles | 2    | 4 GB  | 40 GB   |
| Équipe / usage intensif          | 4    | 8 GB  | 80 GB   |

Starter conseillé : **2 vCPU / 4 GB** — confort pour le build Next.js embarqué d'OmniRoute et assez de marge pour les caches.

### 5.4 Installation via Docker sur Ubuntu — plan type (à vérifier avant exécution)

**OS cible** : Ubuntu 22.04 LTS ou 24.04 LTS (Node 22 disponible, C++20 OK).

```bash
# 1. Base
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git ufw fail2ban

# 2. Firewall
sudo ufw allow OpenSSH
sudo ufw allow 443/tcp   # si reverse proxy TLS
sudo ufw enable

# 3. Docker Engine (install officiel)
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# (déconnexion/reconnexion pour appliquer le groupe)

# 4. Cloner OmniRoute
git clone https://github.com/cheaper-inference/OmniRoute.git
cd OmniRoute
# Vérifier la présence d'un Dockerfile ou docker-compose.yml → à confirmer

# 5. Variables d'env (fichier .env)
# ANTHROPIC_API_KEY, OPENAI_API_KEY, GEMINI_API_KEY, etc.
# OMNIROUTE_PORT, OMNIROUTE_ADMIN_PASSWORD, etc.

# 6. Lancement
docker compose up -d
# ou docker build + docker run selon ce que fournit le repo
```

**À vérifier avant l'install réelle** :
- Le repo GitHub expose-t-il un `Dockerfile` ou une image officielle (`ghcr.io/cheaper-inference/omniroute` ?) → consulter le README.
- Variables d'env requises (clés provider, port, admin password).
- Port par défaut écouté.
- Mécanisme de persistance (volume Docker pour la DB SQLite).

### 5.5 Accès sécurisé depuis le Mac via tunnel SSH

**Objectif** : ne jamais exposer OmniRoute sur l'Internet public. Il écoute uniquement sur `127.0.0.1` du VPS, et on y accède via un tunnel SSH.

Sur le VPS → configurer OmniRoute pour écouter sur `127.0.0.1:3000` (pas `0.0.0.0`).

Sur le Mac :
```bash
# Tunnel local → VPS
ssh -N -L 3000:127.0.0.1:3000 user@vps.example.com

# Dans un autre terminal, OmniRoute est accessible sur http://localhost:3000
# Pointer Claude Code / Codex vers cette URL :
export ANTHROPIC_BASE_URL=http://localhost:3000/anthropic
export OPENAI_BASE_URL=http://localhost:3000/v1
```

**Durcissement SSH recommandé sur le VPS** :
- Désactiver le login root (`PermitRootLogin no`).
- Désactiver l'auth par mot de passe (`PasswordAuthentication no`), uniquement clé publique.
- `fail2ban` actif.
- Changer le port SSH par défaut (optionnel mais courant).
- Clé Ed25519 côté Mac, pas RSA ancien.

**Alternative** : utiliser **Tailscale** (gratuit jusqu'à 100 devices) pour créer un réseau privé Mac ↔ VPS sans gérer SSH/tunnel manuellement. OmniRoute écoute sur l'IP Tailscale uniquement.

### 5.6 Intégration avec Claude Code et Codex une fois OmniRoute en place

#### Claude Code
À documenter précisément au moment de l'intégration, mais principe :
- Variables d'env `ANTHROPIC_BASE_URL` et `ANTHROPIC_API_KEY` pointant vers OmniRoute (clé API gérée par OmniRoute, pas la clé Anthropic native).
- OmniRoute route les requêtes vers Anthropic direct OU vers un provider équivalent moins cher.

#### Codex CLI
- `OPENAI_BASE_URL=http://localhost:3000/v1`
- `OPENAI_API_KEY=<clé OmniRoute>`

#### Routage automatique
Configuré côté OmniRoute (fichier de config ou UI) :
- Règles par type de requête (petit modèle sur chat court, grand modèle sur refacto, etc.).
- Priorités par coût ou par latence.
- Fallback si quota épuisé ou provider down.
- Suivi des coûts consolidé.

---

## 6. Récapitulatif — testé / qui marche / à vérifier

### Testé et confirmé qui marche

- `claude-mem` CLI global installé via npm → OK sur Node 18 / macOS 10.15.
- Marketplace `thedotmack/claude-mem` cloné + enregistré dans `known_marketplaces.json`.
- Plugin claude-mem activé via `/plugin` dans Claude Code → skills `/claude-mem:*` listés.

### Testé et confirmé qui ne marche pas (sur macOS 10.15.7)

- `claude-mem install` auto → crash du CLI `claude` sous-jacent (dyld).
- `claude-mem start` / worker / viewer `localhost:37777` → nécessite Bun, aucun Bun compatible.
- Bun 0.5.9 à 1.2+ → cf. tableau §4.1, tous KO d'une manière ou d'une autre.
- `npm install -g omniroute` → fail compile sur better-sqlite3 (C++20 vs Clang 12).
- Même avec better-sqlite3 corrigé, OmniRoute requiert Node ≥ 22 → incompatible avec Catalina.

### Pas encore testé (à vérifier avant mise en place)

- Présence d'un `Dockerfile` ou image officielle dans https://github.com/cheaper-inference/OmniRoute.
- Variables d'env exactes attendues par OmniRoute à l'exécution.
- Port par défaut et chemin de l'API Anthropic-compatible.
- Coût réel au mois d'un usage personnel typique (dépend du routage).
- Compatibilité OmniRoute avec Claude Code précisément (le README cite Cursor/Cline/OpenCode/Codex, mais pas toujours Claude Code explicitement — à vérifier).
- Disponibilité réelle d'une VM Oracle Free Tier A1 depuis une région UE au moment de la création du compte.

### Actions faites ensuite nettoyées

- Bun installé puis supprimé (`rm -rf ~/.bun`, lignes retirées de `~/.zshrc`).
- Omniroute installé partiellement puis `npm uninstall -g omniroute` (1.1 GB récupérés).
- Fichiers temporaires `/tmp/bun-*.zip` et extracts supprimés.

### État actuel du poste de dev (2026-11-18)

- CLI `claude-mem` global disponible.
- Plugin `thedotmack/claude-mem` enregistré dans `~/.claude/plugins/marketplaces` et activé.
- Skills `/claude-mem:*` opérationnels (utilisation manuelle, sans worker auto).
- Bun : non installé.
- OmniRoute : non installé.
- CLI `claude` npm : crashe, inutilisable (laissé en place, inoffensif).

---

## 7. Références

- Claude-Mem GitHub : https://github.com/thedotmack/claude-mem
- Claude-Mem README : https://github.com/thedotmack/claude-mem#readme
- OmniRoute GitHub : https://github.com/cheaper-inference/OmniRoute
- OmniRoute site : https://omniroute.online
- Bun releases (pour choisir une version compatible macOS) : https://github.com/oven-sh/bun/releases
- Node.js downloads (contraintes macOS) : https://nodejs.org/en/download
- Oracle Cloud Free Tier : https://www.oracle.com/cloud/free/
- OVHcloud VPS : https://www.ovhcloud.com/fr/vps/
- Hetzner Cloud : https://www.hetzner.com/cloud
- Scaleway : https://www.scaleway.com/fr/tarifs-cloud-elements/
- Tailscale : https://tailscale.com/

---

## 8. Prochain pas conseillé le jour où on reprend

1. Décider : upgrade macOS ou passage VPS (ces deux pistes sont exclusives pour cet usage).
2. Si VPS : créer un compte Oracle Free Tier (coût 0 pour valider le concept) ou Hetzner CX22 (4,51 €/mois).
3. Provisionner Ubuntu 24.04 LTS, suivre le plan §5.4.
4. Vérifier le repo OmniRoute pour la présence d'un `Dockerfile` et des variables d'env requises.
5. Mettre en place le tunnel SSH (ou Tailscale) depuis le Mac.
6. Intégrer d'abord Codex (endpoint OpenAI = chemin le plus balisé), puis Claude Code.
7. Observer les coûts réels pendant 2 semaines avant d'étendre.
