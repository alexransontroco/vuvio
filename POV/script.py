#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

DOMAINS = {
    "restaurant": [
        "restaurant POV", "restaurant worker POV",
        "chef kitchen POV", "waiter POV",
        "cooking POV", "street food POV",
    ],
    "kayak": [
        "kayak POV", "kayaking POV",
        "whitewater kayak POV", "river kayak GoPro",
        "sea kayaking POV",
    ],
    "surf": [
        "surf POV", "surfing GoPro",
        "barrel surfing POV",
    ],
    "cycling": [
        "cycling POV", "road bike POV",
        "urban cycling GoPro",
    ],
    "mountain-bike": [
        "mountain bike POV", "MTB downhill POV",
        "MTB GoPro",
    ],
    "fishing": [
        "fishing POV", "angler POV",
        "fly fishing POV",
    ],
    "barista": [
        "barista POV", "coffee shop POV",
        "latte art POV",
    ],
    "bakery": [
        "bakery POV", "baker POV",
        "bread making POV",
    ],
}

KEYWORDS = {
    "restaurant": ["restaurant", "kitchen", "chef", "cooking", "waiter", "food"],
    "kayak": ["kayak", "kayaking", "whitewater", "river", "paddle", "rapids"],
    "surf": ["surf", "surfing", "wave", "barrel"],
    "cycling": ["cycling", "bike", "bicycle", "cyclist"],
    "mountain-bike": ["mountain bike", "mtb", "downhill", "trail"],
    "fishing": ["fishing", "angler", "fish"],
    "barista": ["barista", "coffee", "latte", "espresso"],
    "bakery": ["bakery", "baker", "bread", "pastry"],
}

POV_WORDS = ["pov", "first person", "first-person", "gopro", "bodycam", "helmet cam"]


@dataclass(frozen=True)
class Profile:
    max_duration: int
    min_views: int
    min_likes: int
    min_comments: int
    require_pov: bool


PROFILES = {
    "strict": Profile(20, 500_000, 1_000, 20, True),
    "popular": Profile(30, 100_000, 250, 5, False),
    "relaxed": Profile(45, 10_000, 0, 0, False),
    "discovery": Profile(60, 0, 0, 0, False),
}


def args_parser():
    p = argparse.ArgumentParser(
        description="Recherche des vidéos POV populaires et élargit les filtres si nécessaire."
    )
    p.add_argument("--domain", default="restaurant")
    p.add_argument("--mode", choices=["auto", *PROFILES], default="auto")
    p.add_argument("-n", "--number", type=int, default=10)
    p.add_argument("-o", "--output")
    p.add_argument("--search-size", type=int, default=60)
    p.add_argument("--min-results", type=int, default=5)
    p.add_argument("--max-duration", type=int)
    p.add_argument("--min-views", type=int)
    p.add_argument("--min-likes", type=int)
    p.add_argument("--min-comments", type=int)
    p.add_argument("--require-pov", action="store_true")
    p.add_argument("--vertical-only", action="store_true")
    p.add_argument("--query", action="append")
    p.add_argument("--dry-run", action="store_true")
    p.add_argument("--save-report", action="store_true")
    p.add_argument("--clip-start", type=float, default=2.0, help="Début de l’extrait en secondes (défaut : 2).")
    p.add_argument("--clip-end", type=float, default=21.0, help="Fin de l’extrait en secondes (défaut : 21).")
    return p.parse_args()


def norm(value: str) -> str:
    return value.strip().lower().replace("_", "-").replace(" ", "-")


def integer(value) -> int:
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def text(item: dict) -> str:
    return " ".join(map(str, [
        item.get("title", ""), item.get("description", ""),
        item.get("tags", ""), item.get("categories", ""),
    ])).lower()


def vertical(item: dict) -> bool:
    width, height = integer(item.get("width")), integer(item.get("height"))
    return bool(width and height and height > width)


def has_pov(item: dict) -> bool:
    blob = text(item)
    return any(word in blob for word in POV_WORDS)


def domain_keywords(domain: str) -> list[str]:
    return KEYWORDS.get(norm(domain), [domain.lower().strip()])


def domain_matches(item: dict, words: list[str]) -> int:
    blob = text(item)
    return sum(word in blob for word in words)


def profile_with_overrides(profile: Profile, args) -> Profile:
    return Profile(
        args.max_duration if args.max_duration is not None else profile.max_duration,
        args.min_views if args.min_views is not None else profile.min_views,
        args.min_likes if args.min_likes is not None else profile.min_likes,
        args.min_comments if args.min_comments is not None else profile.min_comments,
        profile.require_pov,
    )


def accepted(item: dict, profile: Profile, args, words: list[str]) -> bool:
    duration = float(item.get("duration") or 0)
    if duration < args.clip_end:
        return False
    if integer(item.get("view_count")) < profile.min_views:
        return False
    if integer(item.get("like_count")) < profile.min_likes:
        return False
    if integer(item.get("comment_count")) < profile.min_comments:
        return False
    if (profile.require_pov or args.require_pov) and not has_pov(item):
        return False
    if args.vertical_only and not vertical(item):
        return False
    return domain_matches(item, words) > 0


def score(item: dict, words: list[str]) -> float:
    views = integer(item.get("view_count"))
    likes = integer(item.get("like_count"))
    comments = integer(item.get("comment_count"))
    duration = float(item.get("duration") or 0)

    result = (
        math.log10(views + 1) * 22
        + math.log10(likes + 1) * 8
        + math.log10(comments + 1) * 5
        + min(domain_matches(item, words), 3) * 15
    )
    if has_pov(item):
        result += 28
    if vertical(item):
        result += 18
    if duration <= 20:
        result += 15
    elif duration <= 30:
        result += 8
    return round(result, 2)


def queries_for(args) -> list[str]:
    if args.query:
        return args.query
    key = norm(args.domain)
    if key in DOMAINS:
        return DOMAINS[key]
    d = args.domain.strip()
    return [
        f"{d} POV shorts", f"{d} first person shorts",
        f"{d} GoPro shorts", f"{d} behind the scenes shorts",
    ]


def search(yt_dlp: str, queries: list[str], size: int) -> dict[str, dict]:
    found = {}
    for index, query in enumerate(queries, 1):
        print(f"[{index}/{len(queries)}] {query}")
        command = [
            yt_dlp, "--dump-json", "--skip-download",
            "--ignore-errors", "--no-playlist",
            f"ytsearch{size}:{query}",
        ]
        result = subprocess.run(command, capture_output=True, text=True)
        for line in result.stdout.splitlines():
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue
            if item.get("id"):
                found[str(item["id"])] = item
    return found


def select(candidates: dict[str, dict], args):
    words = domain_keywords(args.domain)
    order = ["strict", "popular", "relaxed", "discovery"] if args.mode == "auto" else [args.mode]
    best, best_mode = [], order[-1]

    for mode in order:
        profile = profile_with_overrides(PROFILES[mode], args)
        items = [dict(item) for item in candidates.values() if accepted(item, profile, args, words)]
        for item in items:
            item["_score"] = score(item, words)
            item["_mode"] = mode
        items.sort(key=lambda x: (x["_score"], integer(x.get("view_count"))), reverse=True)
        print(f"Mode {mode}: {len(items)} résultat(s)")

        if len(items) > len(best):
            best, best_mode = items, mode
        if args.mode != "auto" or len(items) >= max(args.number, args.min_results):
            return items, mode

    return best, best_mode


def video_url(item: dict) -> str:
    return item.get("webpage_url") or f"https://www.youtube.com/watch?v={item['id']}"


def download(yt_dlp: str, item: dict, folder: Path, archive: Path, clip_start: float, clip_end: float) -> bool:
    command = [
        yt_dlp, "--ignore-errors", "--no-playlist",
        "--download-archive", str(archive),
        "--restrict-filenames", "--write-info-json",
        "--write-thumbnail", "--convert-thumbnails", "jpg",
        "--download-sections", f"*{clip_start:.3f}-{clip_end:.3f}",
        "--force-keyframes-at-cuts",
        "-S", "res:1080,ext:mp4:m4a",
        "--merge-output-format", "mp4",
        "-o", str(folder / "%(uploader)s__%(title).80s__%(id)s__clip.%(ext)s"),
        video_url(item),
    ]
    return subprocess.run(command).returncode == 0


def main() -> int:
    args = args_parser()
    yt_dlp = shutil.which("yt-dlp")
    if not yt_dlp:
        print("Installe yt-dlp : python3.11 -m pip install -U yt-dlp", file=sys.stderr)
        return 1

    if args.clip_start < 0 or args.clip_end <= args.clip_start:
        print("--clip-end doit être supérieur à --clip-start.", file=sys.stderr)
        return 2
    if not args.dry_run and not shutil.which("ffmpeg"):
        print("FFmpeg est requis. Sur Mac : brew install ffmpeg", file=sys.stderr)
        return 1

    if args.number < 1 or args.search_size < 1:
        print("--number et --search-size doivent être supérieurs à zéro.", file=sys.stderr)
        return 2

    folder = Path(args.output or f"pov_{norm(args.domain)}").expanduser().resolve()
    folder.mkdir(parents=True, exist_ok=True)

    queries = queries_for(args)
    print(f"Domaine: {args.domain} | Mode: {args.mode} | Extrait: {args.clip_start}s → {args.clip_end}s | Dossier: {folder}\n")
    candidates = search(yt_dlp, queries, args.search_size)
    print(f"\n{len(candidates)} vidéos uniques examinées.")

    selected, mode = select(candidates, args)
    if not selected:
        print("\nAucun résultat. Essaie --mode discovery ou augmente --search-size.")
        return 0

    selected = selected[:args.number]
    print(f"\nMode retenu: {mode}\n")

    report_videos = []
    for i, item in enumerate(selected, 1):
        views = f"{integer(item.get('view_count')):,}".replace(",", " ")
        likes = f"{integer(item.get('like_count')):,}".replace(",", " ")
        duration = round(float(item.get("duration") or 0), 1)
        orientation = "verticale" if vertical(item) else "horizontale/inconnue"
        print(f"{i:02d}. score {item['_score']} | {views} vues | {likes} likes | {duration}s")
        print(f"    {orientation} | {item.get('title', 'Sans titre')}")
        print(f"    {video_url(item)}")
        report_videos.append({
            "title": item.get("title"), "url": video_url(item),
            "views": integer(item.get("view_count")),
            "likes": integer(item.get("like_count")),
            "comments": integer(item.get("comment_count")),
            "duration": item.get("duration"),
            "vertical": vertical(item), "score": item["_score"],
        })

    if args.save_report:
        report = {
            "domain": args.domain, "requested_mode": args.mode,
            "used_mode": mode, "videos": report_videos,
        }
        report_path = folder / "selection_report.json"
        report_path.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
        print(f"\nRapport: {report_path}")

    if args.dry_run:
        print("\nMode test: aucun téléchargement.")
        return 0

    archive = folder / "downloaded.txt"
    successes = 0
    for i, item in enumerate(selected, 1):
        print(f"\nTéléchargement {i}/{len(selected)}: {item.get('title')}")
        successes += download(yt_dlp, item, folder, archive, args.clip_start, args.clip_end)

    print(f"\nTerminé: {successes}/{len(selected)} vidéos téléchargées dans {folder}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
