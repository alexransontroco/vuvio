# Vuvio relay — déploiement Hetzner Cloud

Ce document décrit le déploiement du relais WebRTC → RTMPS sur Hetzner Cloud.
L'ancien service Cloud Run (`rtmps-relay`) reste en place comme rollback jusqu'à validation E2E.

## Pré-requis (actions utilisateur)

1. **Compte Hetzner Cloud** : https://console.hetzner.com
2. **Projet** créé dans la console (ex. `vuvio-prod`).
3. **API token** `Read & Write` du projet — à coller dans `HETZNER_TOKEN` quand demandé.
4. **Clé SSH publique** ajoutée au projet (Settings → Security → SSH Keys) — pour fallback administratif.
5. **Sous-domaine DNS** `relay.vuvio.app` configuré (A record vers l'IP du VM — l'IP sera fournie après `hcloud server create`).
6. **IP de l'admin** (pour restreindre SSH) — actuellement laissé ouvert dans cloud-init ; durcir via firewall Hetzner post-déploiement.

## Modèle de VM retenu

| Item | Valeur |
|---|---|
| Plan | **CX33** (4 vCPU Intel shared / 8 GB RAM / 80 GB SSD) |
| Datacenter | `fsn1` (Falkenstein, DE) |
| Image | `ubuntu-24.04` |
| IPv4 | Primary IPv4 (+ €0,50 HT/mo) |
| Firewall | Hetzner Cloud Firewall (voir plus bas) |
| Coût HT/mo | **€8,99** (€10,70 TTC @ TVA DE 19%) |

Capacité visée : **1–3 lives simultanés** avec marge CPU >60 %.
Session cap via `RTMPS_RELAY_MAX_SESSIONS=3` (refuse `HTTP 429` au-delà).

## Règles firewall Hetzner

```
Inbound:
  TCP 22   from <admin IP>/32   (SSH)
  TCP 80   from 0.0.0.0/0, ::/0 (HTTP, Caddy ACME HTTP-01)
  TCP 443  from 0.0.0.0/0, ::/0 (HTTPS API + ACME)
  UDP 10000-65535 from 0.0.0.0/0, ::/0 (WebRTC media)
Outbound:
  all
```

## Variables d'environnement serveur

Fichier `/opt/vuvio-relay/.env` (créé à la main après provisioning) :

```
RELAY_DOMAIN=relay.vuvio.app
RTMPS_RELAY_AUTH_TOKEN=<openssl rand -hex 32>
RTMPS_RELAY_MAX_SESSIONS=3
RTMPS_RELAY_DIAGNOSTICS=0
```

Garder `RTMPS_RELAY_AUTH_TOKEN` synchronisé avec Firebase Functions (`functions/.env`).

## Étapes de déploiement

### 1. Création de la VM via Hetzner Cloud API

```bash
export HETZNER_TOKEN=<token>
curl -X POST https://api.hetzner.cloud/v1/servers \
  -H "Authorization: Bearer $HETZNER_TOKEN" \
  -H "Content-Type: application/json" \
  -d @- <<'JSON'
{
  "name": "vuvio-relay",
  "server_type": "cx33",
  "location": "fsn1",
  "image": "ubuntu-24.04",
  "ssh_keys": ["<nom de la clé SSH dans le projet>"],
  "firewalls": [{"firewall": <firewall-id>}],
  "user_data": "<contenu cloud-init.yaml>"
}
JSON
```

### 2. DNS

Ajouter un A record `relay.vuvio.app` → IP publique de la VM.
Attendre propagation (~1 min).

### 3. Upload du code + config

```bash
scp -r relay/ vuvio@<ip>:/opt/vuvio-relay/
ssh vuvio@<ip>
cd /opt/vuvio-relay
cp .env.placeholder .env
openssl rand -hex 32  # copier dans RTMPS_RELAY_AUTH_TOKEN
vim .env              # remplir RELAY_DOMAIN + token
sudo cp systemd/vuvio-relay.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vuvio-relay
sudo systemctl status vuvio-relay
curl -i https://relay.vuvio.app/healthz
```

### 4. Mise à jour Firebase Functions

Dans `functions/.env` :

```
# Ancienne valeur (rollback) : RTMPS_RELAY_URL=https://rtmps-relay-221631631138.europe-west1.run.app
RTMPS_RELAY_URL=https://relay.vuvio.app
RTMPS_RELAY_AUTH_TOKEN=<même token que sur la VM>
```

Redeploy :

```bash
cd functions
npm run deploy -- --only functions:createLiveInput
```

### 5. Validation E2E

Lancer un live sur https://vuvio.app/watch depuis un tel :

- [ ] Test A — Vuvio seul : viewers voient le stream (HLS + P2P OK)
- [ ] Test B — Vuvio + YouTube : YouTube Studio reçoit vidéo + audio
- [ ] Test C — Vuvio + Instagram : IG Live affiché depuis un autre compte
- [ ] Test D — Vuvio + YT + IG simultanés
- [ ] Test E — Résilience : couper manuellement un output → Vuvio reste live
- [ ] Test F — Fin de live : `curl https://relay.vuvio.app/healthz` → `sessions: 0`

Côté relais, les logs doivent montrer pour chaque session :

```
POST 200 /sessions
iceServers count=N hasTurn=true
offer codecs — VP8=true
ontrack kind=video
ontrack kind=audio
ICE state=checking → connected
local candidate type=host protocol=udp   ← IP publique Hetzner directement
3s check: frameCount=>0
starting ffmpeg — session=... res=854x480
video timing: written=N elapsed=Ns target=Ns
```

### 6. Rollback

Si problème :

```
# Dans functions/.env, remettre l'ancienne URL + retirer le token
RTMPS_RELAY_URL=https://rtmps-relay-221631631138.europe-west1.run.app
# RTMPS_RELAY_AUTH_TOKEN=  (laisser vide — le relais Cloud Run n'a pas de token)
```

Redeploy functions. Cloud Run reste fonctionnel pour P2P/WHIP (pas pour multistream, mais ça ne régresse pas l'état actuel).

## Monitoring minimal

- `curl https://relay.vuvio.app/healthz` → JSON avec `sessions`, `rssMb`, `uptimeSeconds`
- `ssh vuvio@<ip> 'docker compose -f /opt/vuvio-relay/docker-compose.yml logs --tail=100 relay'`
- Hetzner console : graph CPU / trafic / RAM par VM
- Alerte simple à ajouter plus tard : UptimeRobot ping sur `/healthz` toutes les 5 min
