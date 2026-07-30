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

VUVIO_CATEGORIES = [
    "climber", "biker", "paraglider", "pilot", "diver", "kayaker",
    "mountaineer", "skier", "snowboarder", "cyclist", "runner", "hiker",
    "falconer", "cinematographer", "photographer", "rally-driver", "musician",
    "chef", "potter", "jeweler", "luthier", "cabinetmaker", "welder",
    "glassblower", "blacksmith", "carpenter", "gardener", "landscaper",
    "farmer", "beekeeper", "volcanologist", "jockey", "trainer",
    "firefighter", "rescue", "train-driver", "equestrian", "architect",
    "barista", "baker", "mechanic", "tattoo-artist", "hairdresser",
    "makeup-artist", "skateboarder", "windsurfer", "tree-climber",
    "parkour-athlete", "sommelier", "butcher", "archaeologist",
    "window-cleaner", "roofer",
]

CATEGORY_TERMS = {
    "climber": ["rock climber", "climbing", "rock climbing"],
    "biker": ["motorcycle rider", "motorbike", "biker"],
    "paraglider": ["paragliding", "paraglider"],
    "pilot": ["airplane pilot", "cockpit pilot", "flying"],
    "diver": ["scuba diver", "scuba diving", "underwater diving"],
    "kayaker": ["kayak", "kayaking", "whitewater kayak"],
    "mountaineer": ["mountaineering", "alpinist", "alpine climbing"],
    "skier": ["skiing", "skier", "alpine ski"],
    "snowboarder": ["snowboarding", "snowboarder"],
    "cyclist": ["cycling", "cyclist", "road bike"],
    "runner": ["running", "runner", "trail running"],
    "hiker": ["hiking", "hiker", "trekking"],
    "falconer": ["falconer", "falconry", "bird of prey handler"],
    "cinematographer": ["cinematographer", "filmmaker", "camera operator"],
    "photographer": ["photographer", "photography", "photo shoot"],
    "rally-driver": ["rally driver", "rally racing", "rally car"],
    "musician": ["musician", "live musician", "instrument performance"],
    "chef": ["chef", "restaurant kitchen", "cooking"],
    "potter": ["potter", "pottery", "ceramics"],
    "jeweler": ["jeweler", "jewelry making", "goldsmith"],
    "luthier": ["luthier", "guitar making", "violin making"],
    "cabinetmaker": ["cabinetmaker", "cabinet making", "fine woodworking"],
    "welder": ["welder", "welding", "metal fabrication"],
    "glassblower": ["glassblower", "glass blowing", "hot glass"],
    "blacksmith": ["blacksmith", "blacksmithing", "forging metal"],
    "carpenter": ["carpenter", "carpentry", "woodworking"],
    "gardener": ["gardener", "gardening", "garden work"],
    "landscaper": ["landscaper", "landscaping", "landscape work"],
    "farmer": ["farmer", "farming", "farm work"],
    "beekeeper": ["beekeeper", "beekeeping", "apiary"],
    "volcanologist": ["volcanologist", "volcano fieldwork", "volcano expedition"],
    "jockey": ["jockey", "horse racing", "racehorse rider"],
    "trainer": ["animal trainer", "horse trainer", "dog trainer"],
    "firefighter": ["firefighter", "firefighting", "fire rescue"],
    "rescue": ["rescue worker", "search and rescue", "emergency rescue"],
    "train-driver": ["train driver", "locomotive driver", "train cab"],
    "equestrian": ["equestrian", "horse riding", "show jumping"],
    "architect": ["architect", "architecture site visit", "architectural design"],
    "barista": ["barista", "coffee shop", "latte art"],
    "baker": ["baker", "bakery", "bread making"],
    "mechanic": ["mechanic", "auto repair", "car mechanic"],
    "tattoo-artist": ["tattoo artist", "tattooing", "tattoo studio"],
    "hairdresser": ["hairdresser", "hairstylist", "hair salon"],
    "makeup-artist": ["makeup artist", "makeup application", "MUA"],
    "skateboarder": ["skateboarder", "skateboarding", "skate park"],
    "windsurfer": ["windsurfer", "windsurfing"],
    "tree-climber": ["tree climber", "arborist climbing", "tree surgery"],
    "parkour-athlete": ["parkour athlete", "parkour", "freerunning"],
    "sommelier": ["sommelier", "wine tasting", "wine service"],
    "butcher": ["butcher", "butchery", "meat cutting"],
    "archaeologist": ["archaeologist", "archaeology dig", "excavation"],
    "window-cleaner": ["window cleaner", "high rise window cleaning", "glass cleaning"],
    "roofer": ["roofer", "roofing", "roof repair"],
}

DOMAINS = {
    key: [
        f"{term} POV",
        f"{term} first person",
        f"{term} GoPro",
        f"{term} day in the life",
    ]
    for key, terms in CATEGORY_TERMS.items()
    for term in [terms[0]]
}

KEYWORDS = {key: terms for key, terms in CATEGORY_TERMS.items()}


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
    p.add_argument("--domain", default=None, help="Une seule catégorie (compatibilité).")
    p.add_argument("--categories", nargs="+", help="Plusieurs catégories, séparées par des espaces ou des virgules.")
    p.add_argument("--all-vuvio", action="store_true", help="Lance les 54 catégories Vuvio prédéfinies.")
    p.add_argument("--per-category", type=int, default=2, help="Nombre de vidéos par catégorie (défaut : 2).")
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
    p.add_argument(
        "--validate-first",
        type=int,
        default=3,
        help="Demande une validation après chacune des N premières catégories (défaut : 3).",
    )
    p.add_argument(
        "--no-validation",
        action="store_true",
        help="Désactive les pauses de validation et traite tout automatiquement.",
    )
    p.add_argument("--clip-start", type=float, default=10.0, help="Début de l’extrait en secondes (défaut : 10).")
    p.add_argument("--clip-end", type=float, default=30.0, help="Fin de l’extrait en secondes (défaut : 30).")
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


def safe_filename(value: str, limit: int = 120) -> str:
    value = value.strip().replace("/", "-").replace("\\", "-")
    value = "".join(c for c in value if c.isalnum() or c in " ._-()")
    value = "_".join(value.split())
    return (value[:limit].strip("._-") or "video")


def full_metadata(yt_dlp: str, url: str) -> dict:
    command = [yt_dlp, "--dump-single-json", "--skip-download", "--no-playlist", url]
    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        return {}
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return {}


def first_value(data: dict, *keys: str, default: str = "Non renseigné par YouTube") -> str:
    for key in keys:
        value = data.get(key)
        if value not in (None, "", [], {}):
            if isinstance(value, list):
                return ", ".join(map(str, value))
            return str(value)
    return default


def flatten_metadata(value, prefix=""):
    lines = []
    if isinstance(value, dict):
        for key in sorted(value):
            child = f"{prefix}.{key}" if prefix else str(key)
            lines.extend(flatten_metadata(value[key], child))
    elif isinstance(value, list):
        if all(not isinstance(v, (dict, list)) for v in value):
            lines.append(f"{prefix}: {', '.join(map(str, value))}")
        else:
            for index, child_value in enumerate(value):
                lines.extend(flatten_metadata(child_value, f"{prefix}[{index}]"))
    elif value not in (None, ""):
        lines.append(f"{prefix}: {value}")
    return lines


def write_txt(meta: dict, item: dict, txt_path: Path, clip_start: float, clip_end: float) -> None:
    merged = dict(item)
    merged.update({k: v for k, v in meta.items() if v not in (None, "", [], {})})

    location_parts = []
    for key in ("location", "city", "state", "country"):
        value = merged.get(key)
        if value and str(value) not in location_parts:
            location_parts.append(str(value))
    location = ", ".join(location_parts) if location_parts else "Non renseigné par YouTube"

    lines = [
        "INFORMATIONS POUR MOCKUP PROFIL VUVIO",
        "=====================================",
        "",
        f"Nom du streamer / chaîne : {first_value(merged, 'uploader', 'channel', 'creator')}",
        f"Identifiant chaîne : {first_value(merged, 'channel_id', 'uploader_id')}",
        f"URL de la chaîne : {first_value(merged, 'channel_url', 'uploader_url')}",
        f"Nombre d’abonnés : {first_value(merged, 'channel_follower_count')}",
        f"Lieu déclaré : {location}",
        f"Langue : {first_value(merged, 'language')}",
        "",
        f"Titre de la vidéo : {first_value(merged, 'title')}",
        f"URL de la vidéo : {video_url(merged)}",
        f"ID vidéo : {first_value(merged, 'id')}",
        f"Date de publication : {first_value(merged, 'upload_date', 'release_date')}",
        f"Durée source : {first_value(merged, 'duration_string', 'duration')} secondes",
        f"Extrait téléchargé : 00:{int(clip_start):02d} → 00:{int(clip_end):02d}",
        f"Durée de l’extrait : {clip_end - clip_start:.0f} secondes",
        f"Vues : {first_value(merged, 'view_count')}",
        f"Likes : {first_value(merged, 'like_count')}",
        f"Commentaires : {first_value(merged, 'comment_count')}",
        f"Orientation détectée : {'Verticale' if vertical(merged) else 'Horizontale ou inconnue'}",
        f"Résolution : {first_value(merged, 'resolution')}",
        "",
        f"Catégories : {first_value(merged, 'categories')}",
        f"Tags : {first_value(merged, 'tags')}",
        "",
        "DESCRIPTION",
        "-----------",
        first_value(merged, 'description', default="Aucune description disponible."),
        "",
        "TOUTES LES MÉTADONNÉES YOUTUBE",
        "-------------------------------",
        *flatten_metadata(merged),
    ]
    txt_path.write_text("\n".join(lines), encoding="utf-8")


def download(yt_dlp: str, item: dict, folder: Path, clip_start: float, clip_end: float) -> bool:
    command = [
        yt_dlp, "--ignore-errors", "--no-playlist",
        "--restrict-filenames",
        "--write-thumbnail", "--convert-thumbnails", "jpg",
        "--download-sections",
        f"*00:00:{int(clip_start):02d}-00:00:{int(clip_end):02d}",
        "--force-keyframes-at-cuts",
        "-S", "res:1080,ext:mp4:m4a",
        "--merge-output-format", "mp4",
        "-o", str(folder / (item["_base_name"] + ".%(ext)s")),
        video_url(item),
    ]
    result = subprocess.run(command)
    return result.returncode == 0


def parse_categories(args) -> list[str]:
    if args.all_vuvio:
        return list(VUVIO_CATEGORIES)

    raw: list[str] = []
    if args.categories:
        raw.extend(args.categories)
    elif args.domain:
        raw.append(args.domain)
    else:
        raw.append("restaurant")

    categories: list[str] = []
    for value in raw:
        for part in value.split(","):
            cleaned = part.strip()
            if cleaned and cleaned not in categories:
                categories.append(cleaned)
    return categories


def process_category(yt_dlp: str, args, category: str, root_folder: Path) -> tuple[int, int]:
    # Réutilise la logique existante pour une catégorie à la fois.
    args.domain = category
    args.number = args.per_category

    folder = root_folder / norm(category)
    folder.mkdir(parents=True, exist_ok=True)

    queries = queries_for(args)
    print(
        f"\n=== {category.upper()} ===\n"
        f"Mode : {args.mode} | Extrait : {args.clip_start}s → {args.clip_end}s | "
        f"Objectif : {args.per_category} vidéo(s)"
    )

    candidates = search(yt_dlp, queries, args.search_size)
    print(f"{len(candidates)} vidéos uniques examinées.")

    selected, mode = select(candidates, args)
    if not selected:
        print(f"Aucun résultat pour {category}.")
        return 0, args.per_category

    selected = selected[:args.per_category]
    print(f"Mode retenu : {mode}")

    for i, item in enumerate(selected, 1):
        views = f"{integer(item.get('view_count')):,}".replace(",", " ")
        duration = round(float(item.get("duration") or 0), 1)
        print(f"{i:02d}. {views} vues | source {duration}s | {item.get('title', 'Sans titre')}")

    if args.dry_run:
        print("Mode test : aucun téléchargement.")
        return len(selected), args.per_category

    successes = 0
    for i, item in enumerate(selected, 1):
        print(f"Téléchargement {i}/{len(selected)} : {item.get('title')}")
        meta = full_metadata(yt_dlp, video_url(item))
        uploader = first_value(meta or item, "uploader", "channel", default="creator")
        title = first_value(meta or item, "title", default="video")
        video_id = first_value(meta or item, "id", default=str(i))
        base_name = safe_filename(f"{uploader}__{title}__{video_id}")
        item["_base_name"] = base_name

        txt_path = folder / f"{base_name}.txt"
        write_txt(meta, item, txt_path, args.clip_start, args.clip_end)
        ok = download(yt_dlp, item, folder, args.clip_start, args.clip_end)

        # Le JSON reste seulement en mémoire ; aucun .json final n'est conservé.
        for json_path in folder.glob("*.json"):
            json_path.unlink(missing_ok=True)

        successes += bool(ok)
        if not ok and txt_path.exists():
            txt_path.unlink()

    return successes, args.per_category


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
    if args.search_size < 1 or args.per_category < 1:
        print("--search-size et --per-category doivent être supérieurs à zéro.", file=sys.stderr)
        return 2

    categories = parse_categories(args)
    root_folder = Path(args.output or "pov_downloads").expanduser().resolve()
    root_folder.mkdir(parents=True, exist_ok=True)

    print("Catégories : " + ", ".join(categories))
    print(f"Vidéos par catégorie : {args.per_category}")
    print(f"Extrait téléchargé : 00:10 → 00:30 ({args.clip_end - args.clip_start:.0f}s)")
    print(f"Dossier principal : {root_folder}")

    total_successes = 0
    total_requested = 0
    validation_limit = 0 if args.no_validation else max(args.validate_first, 0)

    for index, category in enumerate(categories, start=1):
        successes, requested = process_category(yt_dlp, args, category, root_folder)
        total_successes += successes
        total_requested += requested

        if index <= validation_limit and index < len(categories) and not args.dry_run:
            print(
                f"\nValidation {index}/{validation_limit} : vérifie le dossier "
                f"{root_folder / norm(category)}"
            )
            while True:
                answer = input(
                    "Continuer avec la catégorie suivante ? "
                    "[Entrée/oui = continuer, non = arrêter] : "
                ).strip().lower()

                if answer in ("", "o", "oui", "y", "yes"):
                    if index == validation_limit:
                        print(
                            "Les premières catégories sont validées. "
                            "Toutes les suivantes seront traitées automatiquement."
                        )
                    break

                if answer in ("n", "non", "no", "stop", "q", "quit"):
                    print(
                        f"\nArrêt demandé après {category}. "
                        f"Résultat actuel : {total_successes}/{total_requested} vidéo(s)."
                    )
                    print(f"Dossier : {root_folder}")
                    return 0

                print("Réponse non reconnue. Appuie sur Entrée pour continuer ou écris non.")

    print(f"\nTerminé : {total_successes}/{total_requested} vidéo(s) obtenue(s).")
    print(f"Dossier : {root_folder}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
