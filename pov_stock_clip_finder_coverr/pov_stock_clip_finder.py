#!/usr/bin/env python3
from __future__ import annotations
import argparse, csv, json, os, re, shutil, subprocess, sys, time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any
from urllib.parse import quote_plus
import requests
from dotenv import load_dotenv

COVERR_API = "https://api.coverr.co"
DEFAULT_CATEGORIES = {
    "cycling": ["cycling pov", "mountain bike pov", "bike ride first person"],
    "driving": ["driving pov", "car dashboard road", "road trip first person"],
    "walking": ["walking pov", "city walk first person", "hiking pov"],
    "cooking": ["cooking pov", "chef hands cooking", "bakery work"],
    "surfing": ["surfing pov", "wave first person", "ocean action camera"],
}

@dataclass
class VideoResult:
    source: str
    category: str
    query: str
    source_id: str
    title: str
    duration: float
    width: int
    height: int
    page_url: str
    download_url: str
    local_file: str = ""
    clip_file: str = ""
    status: str = "found"

def safe_name(value: str, maximum: int = 70) -> str:
    value = re.sub(r"[^a-z0-9._-]+", "-", value.strip().lower())
    return value.strip("-")[:maximum] or "video"

def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None:
        raise RuntimeError("FFmpeg est introuvable. Installe-le avec : brew install ffmpeg")

class CoverrClient:
    def __init__(self, api_key: str, timeout: int = 30) -> None:
        if not api_key or api_key.startswith("collez_"):
            raise ValueError("Clé Coverr absente. Ajoute COVERR_API_KEY dans .env.")
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "POVStockClipFinder/2.0",
        })

    def search(self, query: str, page_size: int = 12) -> list[dict[str, Any]]:
        response = self.session.get(
            f"{COVERR_API}/videos",
            params={"query": query, "page_size": page_size, "sort": "popular", "urls": "true"},
            timeout=self.timeout,
        )
        if response.status_code == 401:
            raise RuntimeError("Coverr refuse la clé API (401). Vérifie COVERR_API_KEY dans .env.")
        response.raise_for_status()
        return response.json().get("hits", [])

    def register_download(self, video_id: str) -> None:
        try:
            self.session.patch(f"{COVERR_API}/videos/{video_id}/stats/downloads", timeout=self.timeout).raise_for_status()
        except requests.RequestException as exc:
            print(f"  Avertissement : statistique Coverr non enregistrée : {exc}")

def to_result(category: str, query: str, item: dict[str, Any]) -> VideoResult:
    vid = str(item.get("id", ""))
    urls = item.get("urls") or {}
    return VideoResult(
        source="coverr", category=category, query=query, source_id=vid,
        title=item.get("title") or item.get("description") or vid,
        duration=float(item.get("duration") or 0), width=int(item.get("max_width") or 0),
        height=int(item.get("max_height") or 0), page_url=f"https://coverr.co/videos/{vid}",
        download_url=urls.get("mp4_download") or urls.get("mp4") or "",
    )

def download_file(url: str, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temp = destination.with_suffix(destination.suffix + ".part")
    with requests.get(url, stream=True, timeout=90) as response:
        response.raise_for_status()
        with temp.open("wb") as handle:
            for chunk in response.iter_content(1024 * 1024):
                if chunk:
                    handle.write(chunk)
    temp.replace(destination)

def extract_clip(source: Path, destination: Path, duration: float, source_duration: float) -> None:
    require_ffmpeg()
    destination.parent.mkdir(parents=True, exist_ok=True)
    clip_duration = min(duration, source_duration) if source_duration > 0 else duration
    start = max(0.0, (source_duration - clip_duration) / 2) if source_duration > 0 else 0.0
    command = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error", "-ss", f"{start:.3f}",
               "-i", str(source), "-t", f"{clip_duration:.3f}", "-c:v", "libx264",
               "-preset", "veryfast", "-crf", "20", "-c:a", "aac", "-movflags", "+faststart", str(destination)]
    process = subprocess.run(command, capture_output=True, text=True)
    if process.returncode != 0:
        raise RuntimeError(process.stderr.strip() or "Échec de FFmpeg")

def load_categories(path: str | None) -> dict[str, list[str]]:
    if not path:
        return DEFAULT_CATEGORIES
    with open(path, "r", encoding="utf-8") as handle:
        data = json.load(handle)
    return {str(k): [str(q) for q in v] for k, v in data.items()}

def write_manifests(results: list[VideoResult], output: Path) -> None:
    output.mkdir(parents=True, exist_ok=True)
    (output / "manifest.json").write_text(json.dumps([asdict(r) for r in results], indent=2, ensure_ascii=False), encoding="utf-8")
    fields = list(VideoResult.__dataclass_fields__.keys())
    with (output / "manifest.csv").open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields); writer.writeheader(); writer.writerows(asdict(r) for r in results)

def generate_mixkit_links(categories: dict[str, list[str]], output: Path) -> None:
    sections = []
    for category, queries in categories.items():
        links = "".join(f'<li><a href="https://mixkit.co/free-stock-video/?q={quote_plus(q)}" target="_blank">{q}</a></li>' for q in queries)
        sections.append(f"<section><h2>{category}</h2><ul>{links}</ul></section>")
    html = f'''<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Recherches Mixkit POV</title><style>body{{font-family:-apple-system,BlinkMacSystemFont,sans-serif;max-width:900px;margin:40px auto;padding:0 20px;background:#10131a;color:#eef2ff}}section{{background:#181d27;border:1px solid #2a3242;border-radius:16px;padding:18px;margin:16px 0}}a{{color:#87b7ff}}.note{{color:#b7c0d4;line-height:1.5}}</style></head><body><h1>Recherches Mixkit — vidéos POV</h1><p class="note">Mixkit ne fournit pas d’API publique officielle documentée. Cette page ouvre les recherches manuellement, sans scraping automatisé.</p>{''.join(sections)}</body></html>'''
    output.mkdir(parents=True, exist_ok=True)
    (output / "mixkit_searches.html").write_text(html, encoding="utf-8")
    print(f"Liens Mixkit générés : {output / 'mixkit_searches.html'}")

def main() -> int:
    parser = argparse.ArgumentParser(description="Trouve des vidéos POV avec Coverr et prépare des recherches Mixkit.")
    parser.add_argument("--sources", nargs="+", choices=["coverr", "mixkit"], default=["coverr"])
    parser.add_argument("--per-category", type=int, default=2)
    parser.add_argument("--search-size", type=int, default=12)
    parser.add_argument("--clip-duration", type=float, default=20)
    parser.add_argument("--categories")
    parser.add_argument("--output", default="output")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    load_dotenv(); categories = load_categories(args.categories); output = Path(args.output)
    if "mixkit" in args.sources:
        generate_mixkit_links(categories, output)
    if "coverr" not in args.sources:
        return 0
    try:
        client = CoverrClient(os.getenv("COVERR_API_KEY", "").strip())
    except ValueError as exc:
        print(f"Erreur : {exc}", file=sys.stderr); return 2
    results, seen = [], set()
    try:
        for category, queries in categories.items():
            selected = 0
            for query in queries:
                if selected >= args.per_category: break
                print(f"Recherche : {category} / {query}")
                try:
                    hits = client.search(query, args.search_size)
                except (requests.RequestException, RuntimeError) as exc:
                    print(f"  Coverr ignoré : {exc}"); continue
                for item in hits:
                    if selected >= args.per_category: break
                    result = to_result(category, query, item)
                    if not result.source_id or result.source_id in seen or not result.download_url: continue
                    if result.height and result.width and result.height > result.width: continue
                    seen.add(result.source_id); selected += 1; results.append(result)
                    print(f"  Trouvé : {result.title} ({result.duration:.1f}s)")
                    if args.dry_run:
                        result.status = "dry-run"; continue
                    filename = f"{safe_name(category)}_{selected}_{safe_name(result.title)}.mp4"
                    original, clip = output / "originals" / filename, output / "clips" / filename
                    try:
                        print("  Téléchargement…"); download_file(result.download_url, original); client.register_download(result.source_id)
                        result.local_file = str(original)
                        print("  Extraction du clip…"); extract_clip(original, clip, args.clip_duration, result.duration)
                        result.clip_file = str(clip); result.status = "downloaded"
                    except Exception as exc:
                        result.status = f"error: {exc}"; print(f"  Échec : {exc}")
                    time.sleep(0.2)
            if selected == 0: print(f"  Aucun résultat retenu pour {category}")
    except KeyboardInterrupt:
        print("\nInterrompu.")
    write_manifests(results, output)
    print(f"\nTerminé : {len(results)} résultat(s). Manifestes dans {output}/")
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
