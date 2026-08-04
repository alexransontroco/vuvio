# POV Stock Clip Finder — Coverr + Mixkit

Cette version n'utilise plus Pexels ni OpenCV.

- **Coverr** : recherche automatique via l'API officielle, téléchargement et extraction avec FFmpeg.
- **Mixkit** : génération de liens de recherche manuels. Pas de scraping automatisé.

## Installation

```bash
cd ~/vuvio
unzip pov_stock_clip_finder_coverr.zip
cd pov_stock_clip_finder_coverr
python3.11 -m venv .venv
source .venv/bin/activate
python3.11 -m pip install -r requirements.txt
brew install ffmpeg
```

## Clé Coverr

```bash
cp .env.example .env
open -e .env
```

Puis mets :

```env
COVERR_API_KEY=TA_CLE_COVERR
```

## Tester sans télécharger

```bash
python3.11 pov_stock_clip_finder.py --sources coverr --per-category 2 --dry-run
```

## Télécharger et créer des clips de 20 secondes

```bash
python3.11 pov_stock_clip_finder.py --sources coverr --per-category 2 --clip-duration 20
```

## Coverr + recherches Mixkit

```bash
python3.11 pov_stock_clip_finder.py --sources coverr mixkit --per-category 2 --dry-run
open output/mixkit_searches.html
```

## Mixkit uniquement

```bash
python3.11 pov_stock_clip_finder.py --sources mixkit
open output/mixkit_searches.html
```

Les vidéos et manifestes sont créés dans `output/`.
