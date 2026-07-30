# POV Stock Clip Finder

Ce script autonome recherche des vidéos sur **Pexels** et **Pixabay**,
télécharge directement leurs fichiers MP4, détecte le passage visuellement le
plus intéressant, puis crée des extraits classés par catégorie.

Il n'utilise ni YouTube ni `yt-dlp`.

## Fonctionnement

```text
Pexels / Pixabay API
        ↓
résultats vidéo
        ↓
sélection de la meilleure qualité MP4 ≤ 1080p
        ↓
téléchargement direct
        ↓
analyse FFmpeg
        ↓
sélection d'une fenêtre de 20 secondes
        ↓
encodage FFmpeg
        ↓
classement par catégorie
```

Le programme crée aussi :

- `manifest.json`
- `manifest.csv`
- un dossier par catégorie
- éventuellement `_sources/` si vous conservez les originaux

## Prérequis

- Python 3.11 ou plus récent
- FFmpeg et ffprobe
- une clé Pexels, Pixabay, ou les deux

### macOS

```bash
brew install python ffmpeg
```

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install python3 python3-venv ffmpeg
```

## Installation

```bash
cd pov_stock_clip_finder

python3 -m venv .venv
source .venv/bin/activate

pip install -r requirements.txt
```

Sous Windows PowerShell :

```powershell
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

## Clés API

Copiez `.env.example` sous le nom `.env` :

```bash
cp .env.example .env
```

Ajoutez ensuite vos clés :

```env
PEXELS_API_KEY=votre_cle_pexels
PIXABAY_API_KEY=votre_cle_pixabay
```

Une seule des deux clés suffit.

## Premier test sans télécharger

```bash
python pov_stock_clip_finder.py \
  --categories categories.example.json \
  --per-category 2 \
  --dry-run
```

## Création réelle des clips

```bash
python pov_stock_clip_finder.py \
  --categories categories.example.json \
  --per-category 3 \
  --clip-duration 20
```

## Utiliser uniquement Pexels

```bash
python pov_stock_clip_finder.py \
  --sources pexels \
  --per-category 3
```

## Utiliser uniquement Pixabay

```bash
python pov_stock_clip_finder.py \
  --sources pixabay \
  --per-category 3
```

## Conserver les vidéos sources

Par défaut, la longue vidéo téléchargée est supprimée après la création du clip.

```bash
python pov_stock_clip_finder.py \
  --keep-sources
```

## Résultat

```text
output/
├── cycling/
│   ├── pexels-12345-cycling-pov-clip.mp4
│   └── pixabay-98765-bike-ride-clip.mp4
├── craft/
├── food/
├── travel/
├── manifest.json
└── manifest.csv
```

## Modifier les catégories

Éditez `categories.example.json` :

```json
{
  "aviation": [
    "cockpit pov",
    "helicopter flight"
  ],
  "winter": [
    "skiing pov",
    "snowboard pov"
  ]
}
```

Chaque clé devient un dossier de sortie.

## Choix automatique du passage

Le programme prélève régulièrement une image et mesure :

- le mouvement ;
- la netteté ;
- l'exposition ;
- la régularité visuelle de la fenêtre entière.

Il cherche ainsi une séquence dynamique mais pas excessivement secouée.

Les vidéos de stock sont souvent plus courtes que les vidéos YouTube. Lorsqu'une
vidéo dure moins de 20 secondes, elle est ignorée par défaut. Vous pouvez changer
cela avec :

```bash
python pov_stock_clip_finder.py \
  --minimum-source-duration 10 \
  --clip-duration 10
```

## Options principales

```text
--sources pexels,pixabay
--results-per-query 12
--per-category 3
--clip-duration 20
--minimum-source-duration 20
--sample-every 0.75
--max-source-height 1080
--output-height 1080
--keep-sources
--dry-run
```

## Licences

Le script conserve dans les manifestes :

- la plateforme d'origine ;
- la page du média ;
- le nom du créateur ;
- le lien du fichier téléchargé.

Vérifiez les conditions de Pexels et de Pixabay correspondant à votre usage.
Évitez notamment de redistribuer les médias bruts comme une banque concurrente.


## Version macOS Catalina
Cette version ne dépend ni d’OpenCV ni de NumPy. Elle utilise FFmpeg pour détecter les changements de plan.
