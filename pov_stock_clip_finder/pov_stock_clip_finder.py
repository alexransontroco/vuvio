#!/usr/bin/env python3
"""
POV Stock Clip Finder

Recherche des vidéos sur Pexels et Pixabay via leurs API officielles,
télécharge directement les MP4, sélectionne automatiquement un passage
visuellement intéressant et range les clips par catégorie.

Utilisez les médias conformément aux licences et conditions de chaque plateforme.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import re
import shutil
import subprocess
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote_plus

import cv2
import numpy as np
import requests
from dotenv import load_dotenv


PEXELS_SEARCH_URL = "https://api.pexels.com/videos/search"
PIXABAY_SEARCH_URL = "https://pixabay.com/api/videos/"

DEFAULT_CATEGORIES: dict[str, list[str]] = {
    "cycling": [
        "cycling pov",
        "mountain bike pov",
        "bike ride first person",
    ],
    "driving": [
        "driving pov",
        "car dashboard road",
        "road trip first person",
    ],
    "craft": [
        "woodworking hands",
        "pottery hands",
        "blacksmith work",
    ],
    "food": [
        "cooking hands",
        "baker bread",
        "barista coffee",
    ],
    "water": [
        "surfing pov",
        "diving underwater",
        "kayak pov",
    ],
    "travel": [
        "walking pov",
        "city walking",
        "hiking pov",
    ],
}


@dataclass
class StockVideo:
    source: str
    source_id: str
    title: str
    category: str
    query: str
    creator: str
    source_page: str
    download_url: str
    width: int
    height: int
    duration_seconds: float
    ranking_score: float
    local_source: str = ""
    clip_file: str = ""
    selected_start_seconds: float = 0.0
    selected_end_seconds: float = 0.0
    visual_score: float = 0.0


def log(message: str) -> None:
    print(message, flush=True)


def safe_name(value: str, max_length: int = 90) -> str:
    value = re.sub(r"[^\w\s.-]", "", value, flags=re.UNICODE)
    value = re.sub(r"\s+", "-", value.strip()).strip(".-")
    return (value[:max_length] or "video").lower()


def require_binary(name: str) -> str:
    path = shutil.which(name)
    if not path:
        raise RuntimeError(
            f"Le programme '{name}' est introuvable. "
            "Installez FFmpeg et ajoutez-le au PATH."
        )
    return path


def request_json(
    url: str,
    *,
    params: dict[str, Any] | None = None,
    headers: dict[str, str] | None = None,
    retries: int = 3,
) -> dict[str, Any]:
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            response = requests.get(
                url,
                params=params,
                headers=headers,
                timeout=45,
            )
            response.raise_for_status()
            return response.json()

        except (requests.RequestException, ValueError) as exc:
            last_error = exc
            if attempt < retries - 1:
                time.sleep(2**attempt)

    raise RuntimeError(f"Erreur API : {last_error}")


def download_file(url: str, destination: Path, retries: int = 3) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + ".part")
    last_error: Exception | None = None

    for attempt in range(retries):
        try:
            with requests.get(
                url,
                stream=True,
                timeout=(30, 180),
                headers={"User-Agent": "POV-Stock-Clip-Finder/1.0"},
            ) as response:
                response.raise_for_status()

                with temporary.open("wb") as handle:
                    for chunk in response.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            handle.write(chunk)

            temporary.replace(destination)
            return

        except requests.RequestException as exc:
            last_error = exc
            temporary.unlink(missing_ok=True)

            if attempt < retries - 1:
                time.sleep(2**attempt)

    raise RuntimeError(f"Téléchargement impossible : {last_error}")


def choose_pexels_file(
    video_files: list[dict[str, Any]],
    max_height: int,
) -> dict[str, Any] | None:
    valid = [
        item
        for item in video_files
        if item.get("file_type") == "video/mp4"
        and item.get("link")
        and int(item.get("width") or 0) > 0
        and int(item.get("height") or 0) > 0
    ]

    if not valid:
        return None

    within_limit = [
        item
        for item in valid
        if int(item.get("height") or 0) <= max_height
    ]

    pool = within_limit or valid

    return max(
        pool,
        key=lambda item: (
            int(item.get("width") or 0)
            * int(item.get("height") or 0)
        ),
    )


def search_pexels(
    api_key: str,
    category: str,
    query: str,
    per_page: int,
    max_height: int,
) -> list[StockVideo]:
    payload = request_json(
        PEXELS_SEARCH_URL,
        params={
            "query": query,
            "per_page": min(per_page, 80),
            "orientation": "landscape",
            "size": "medium",
        },
        headers={"Authorization": api_key},
    )

    results: list[StockVideo] = []

    for item in payload.get("videos", []):
        chosen = choose_pexels_file(
            item.get("video_files", []),
            max_height,
        )

        if not chosen:
            continue

        user = item.get("user") or {}
        width = int(chosen.get("width") or item.get("width") or 0)
        height = int(chosen.get("height") or item.get("height") or 0)
        duration = float(item.get("duration") or 0)
        video_id = str(item.get("id") or "")

        ranking = (
            min(width * height / (1920 * 1080), 1.5) * 2
            + min(duration / 30, 2)
        )

        results.append(
            StockVideo(
                source="pexels",
                source_id=video_id,
                title=f"{query} — Pexels {video_id}",
                category=category,
                query=query,
                creator=str(user.get("name") or "Unknown"),
                source_page=str(item.get("url") or ""),
                download_url=str(chosen["link"]),
                width=width,
                height=height,
                duration_seconds=duration,
                ranking_score=round(ranking, 4),
            )
        )

    return results


def choose_pixabay_file(
    videos: dict[str, dict[str, Any]],
    max_height: int,
) -> dict[str, Any] | None:
    valid: list[dict[str, Any]] = []

    for label, item in videos.items():
        if not isinstance(item, dict):
            continue

        url = item.get("url")
        width = int(item.get("width") or 0)
        height = int(item.get("height") or 0)

        if url and width > 0 and height > 0:
            valid.append(
                {
                    "label": label,
                    "url": url,
                    "width": width,
                    "height": height,
                    "size": int(item.get("size") or 0),
                }
            )

    if not valid:
        return None

    within_limit = [
        item
        for item in valid
        if item["height"] <= max_height
    ]

    pool = within_limit or valid

    return max(
        pool,
        key=lambda item: (
            item["width"] * item["height"],
            item["size"],
        ),
    )


def search_pixabay(
    api_key: str,
    category: str,
    query: str,
    per_page: int,
    max_height: int,
) -> list[StockVideo]:
    payload = request_json(
        PIXABAY_SEARCH_URL,
        params={
            "key": api_key,
            "q": query,
            "per_page": min(max(per_page, 3), 200),
            "safesearch": "true",
            "order": "popular",
            "video_type": "all",
        },
    )

    results: list[StockVideo] = []

    for item in payload.get("hits", []):
        chosen = choose_pixabay_file(
            item.get("videos") or {},
            max_height,
        )

        if not chosen:
            continue

        video_id = str(item.get("id") or "")
        duration = float(item.get("duration") or 0)
        views = int(item.get("views") or 0)
        likes = int(item.get("likes") or 0)
        width = int(chosen["width"])
        height = int(chosen["height"])

        ranking = (
            np.log10(max(views, 1)) * 0.7
            + np.log10(max(likes, 1)) * 0.3
            + min(width * height / (1920 * 1080), 1.5)
            + min(duration / 30, 2)
        )

        tags = str(item.get("tags") or query)

        results.append(
            StockVideo(
                source="pixabay",
                source_id=video_id,
                title=f"{tags} — Pixabay {video_id}",
                category=category,
                query=query,
                creator=str(item.get("user") or "Unknown"),
                source_page=str(item.get("pageURL") or ""),
                download_url=str(chosen["url"]),
                width=width,
                height=height,
                duration_seconds=duration,
                ranking_score=round(float(ranking), 4),
            )
        )

    return results


def deduplicate(videos: Iterable[StockVideo]) -> list[StockVideo]:
    unique: dict[tuple[str, str], StockVideo] = {}

    for video in videos:
        key = (video.source, video.source_id)
        existing = unique.get(key)

        if existing is None or video.ranking_score > existing.ranking_score:
            unique[key] = video

    return sorted(
        unique.values(),
        key=lambda video: video.ranking_score,
        reverse=True,
    )


def probe_duration(path: Path) -> float:
    require_binary("ffprobe")

    command = [
        "ffprobe",
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        str(path),
    ]

    result = subprocess.run(
        command,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
            or f"Impossible de lire la durée de {path.name}"
        )

    return float(result.stdout.strip())


def frame_metrics(
    previous_gray: np.ndarray | None,
    frame: np.ndarray,
) -> tuple[float, float, float, np.ndarray]:
    small = cv2.resize(
        frame,
        (320, 180),
        interpolation=cv2.INTER_AREA,
    )

    gray = cv2.cvtColor(
        small,
        cv2.COLOR_BGR2GRAY,
    )

    sharpness_raw = float(
        cv2.Laplacian(
            gray,
            cv2.CV_64F,
        ).var()
    )

    brightness = float(gray.mean())

    exposure_score = max(
        0.0,
        1.0 - abs(brightness - 120.0) / 120.0,
    )

    motion_raw = 0.0

    if previous_gray is not None:
        motion_raw = float(
            cv2.absdiff(
                previous_gray,
                gray,
            ).mean()
        )

    motion_score = min(motion_raw / 22.0, 1.0)
    sharpness_score = min(sharpness_raw / 600.0, 1.0)

    return (
        motion_score,
        sharpness_score,
        exposure_score,
        gray,
    )


def find_best_window(
    video_path: Path,
    requested_duration: float,
    sample_every: float,
) -> tuple[float, float, float]:
    cap = cv2.VideoCapture(str(video_path))

    if not cap.isOpened():
        raise RuntimeError(f"Impossible d'ouvrir {video_path.name}")

    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0
    duration = frame_count / fps if frame_count else probe_duration(video_path)

    actual_clip_duration = min(requested_duration, duration)

    if duration <= requested_duration + 0.25:
        cap.release()
        return 0.0, actual_clip_duration, 0.0

    ignore_start = min(4.0, duration * 0.08)
    ignore_end = min(3.0, duration * 0.05)
    usable_end = max(ignore_start + actual_clip_duration, duration - ignore_end)

    sample_times = np.arange(
        ignore_start,
        usable_end,
        sample_every,
    )

    scores: list[float] = []
    previous_gray: np.ndarray | None = None

    for timestamp in sample_times:
        cap.set(
            cv2.CAP_PROP_POS_MSEC,
            float(timestamp * 1000),
        )

        ok, frame = cap.read()

        if not ok:
            scores.append(0.0)
            previous_gray = None
            continue

        motion, sharpness, exposure, gray = frame_metrics(
            previous_gray,
            frame,
        )

        previous_gray = gray

        balanced_motion = (
            motion
            if motion <= 0.85
            else max(0.0, 1.7 - motion)
        )

        score = (
            balanced_motion * 0.55
            + sharpness * 0.30
            + exposure * 0.15
        )

        scores.append(score)

    cap.release()

    window_samples = max(
        1,
        int(round(actual_clip_duration / sample_every)),
    )

    if len(scores) < window_samples:
        fallback_start = max(
            0.0,
            (duration - actual_clip_duration) / 2,
        )

        return (
            fallback_start,
            actual_clip_duration,
            float(np.mean(scores or [0.0])),
        )

    values = np.asarray(scores, dtype=np.float64)
    kernel = np.ones(window_samples, dtype=np.float64) / window_samples
    rolling_means = np.convolve(values, kernel, mode="valid")

    best_index = 0
    best_score = -1.0

    for index, mean_score in enumerate(rolling_means):
        segment = values[index : index + window_samples]
        instability = min(float(np.std(segment)) * 0.35, 0.25)
        final_score = float(mean_score) - instability

        if final_score > best_score:
            best_score = final_score
            best_index = index

    start = float(sample_times[best_index])
    start = min(
        start,
        max(0.0, duration - actual_clip_duration),
    )

    return (
        start,
        actual_clip_duration,
        round(best_score, 4),
    )


def extract_clip(
    source: Path,
    output: Path,
    start: float,
    duration: float,
    output_height: int,
) -> None:
    require_binary("ffmpeg")
    output.parent.mkdir(parents=True, exist_ok=True)

    scale_filter = (
        f"scale=-2:'min({output_height},ih)'"
    )

    command = [
        "ffmpeg",
        "-y",
        "-ss",
        f"{start:.3f}",
        "-i",
        str(source),
        "-t",
        f"{duration:.3f}",
        "-map",
        "0:v:0",
        "-map",
        "0:a?",
        "-vf",
        scale_filter,
        "-c:v",
        "libx264",
        "-preset",
        "medium",
        "-crf",
        "20",
        "-c:a",
        "aac",
        "-b:a",
        "160k",
        "-movflags",
        "+faststart",
        str(output),
    ]

    result = subprocess.run(
        command,
        text=True,
        capture_output=True,
    )

    if result.returncode != 0:
        raise RuntimeError(
            result.stderr.strip()
            or f"FFmpeg a échoué pour {source.name}"
        )


def load_categories(path: Path | None) -> dict[str, list[str]]:
    if path is None:
        return DEFAULT_CATEGORIES

    payload = json.loads(
        path.read_text(encoding="utf-8")
    )

    if not isinstance(payload, dict):
        raise ValueError(
            "Le fichier de catégories doit être un objet JSON."
        )

    categories: dict[str, list[str]] = {}

    for category, queries in payload.items():
        if not isinstance(category, str) or not isinstance(queries, list):
            continue

        cleaned = [
            str(query).strip()
            for query in queries
            if str(query).strip()
        ]

        if cleaned:
            categories[category] = cleaned

    if not categories:
        raise ValueError("Aucune catégorie valide.")

    return categories


def save_manifest(
    videos: list[StockVideo],
    output_dir: Path,
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    rows = [asdict(video) for video in videos]

    (output_dir / "manifest.json").write_text(
        json.dumps(
            rows,
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    if rows:
        with (output_dir / "manifest.csv").open(
            "w",
            newline="",
            encoding="utf-8-sig",
        ) as handle:
            writer = csv.DictWriter(
                handle,
                fieldnames=list(rows[0].keys()),
            )
            writer.writeheader()
            writer.writerows(rows)


def source_filename(video: StockVideo) -> str:
    digest = hashlib.sha1(
        video.download_url.encode("utf-8")
    ).hexdigest()[:8]

    return (
        f"{video.source}-"
        f"{video.source_id}-"
        f"{digest}.mp4"
    )


def search_all_sources(
    categories: dict[str, list[str]],
    pexels_key: str | None,
    pixabay_key: str | None,
    sources: set[str],
    results_per_query: int,
    max_height: int,
) -> list[StockVideo]:
    found: list[StockVideo] = []

    for category, queries in categories.items():
        for query in queries:
            log(f"Recherche : {category} / {query}")

            if "pexels" in sources and pexels_key:
                try:
                    found.extend(
                        search_pexels(
                            pexels_key,
                            category,
                            query,
                            results_per_query,
                            max_height,
                        )
                    )
                except Exception as exc:
                    log(f"  Pexels ignoré : {exc}")

            if "pixabay" in sources and pixabay_key:
                try:
                    found.extend(
                        search_pixabay(
                            pixabay_key,
                            category,
                            query,
                            results_per_query,
                            max_height,
                        )
                    )
                except Exception as exc:
                    log(f"  Pixabay ignoré : {exc}")

    return deduplicate(found)


def choose_per_category(
    videos: list[StockVideo],
    count: int,
    min_duration: float,
) -> list[StockVideo]:
    selected: list[StockVideo] = []
    category_counts: dict[str, int] = {}

    for video in videos:
        if video.duration_seconds and video.duration_seconds < min_duration:
            continue

        current = category_counts.get(video.category, 0)

        if current >= count:
            continue

        selected.append(video)
        category_counts[video.category] = current + 1

    return selected


def run(args: argparse.Namespace) -> None:
    load_dotenv()

    pexels_key = os.getenv("PEXELS_API_KEY")
    pixabay_key = os.getenv("PIXABAY_API_KEY")
    sources = set(args.sources.split(","))

    invalid_sources = sources - {"pexels", "pixabay"}

    if invalid_sources:
        raise RuntimeError(
            "Sources inconnues : "
            + ", ".join(sorted(invalid_sources))
        )

    if "pexels" in sources and not pexels_key:
        log("Attention : PEXELS_API_KEY absente, Pexels sera ignoré.")
        sources.discard("pexels")

    if "pixabay" in sources and not pixabay_key:
        log("Attention : PIXABAY_API_KEY absente, Pixabay sera ignoré.")
        sources.discard("pixabay")

    if not sources:
        raise RuntimeError(
            "Ajoutez au moins une clé API valide dans le fichier .env."
        )

    categories = load_categories(args.categories)

    candidates = search_all_sources(
        categories,
        pexels_key,
        pixabay_key,
        sources,
        args.results_per_query,
        args.max_source_height,
    )

    selected = choose_per_category(
        candidates,
        args.per_category,
        args.minimum_source_duration,
    )

    if not selected:
        raise RuntimeError(
            "Aucune vidéo suffisamment longue n'a été trouvée."
        )

    if args.dry_run:
        save_manifest(selected, args.output)
        log(
            f"{len(selected)} résultats enregistrés dans "
            f"{args.output / 'manifest.json'}"
        )
        return

    processed: list[StockVideo] = []
    source_dir = args.output / "_sources"

    for index, video in enumerate(selected, start=1):
        log(
            f"[{index}/{len(selected)}] "
            f"{video.source} — {video.title}"
        )

        try:
            local_source = (
                source_dir
                / video.category
                / source_filename(video)
            )

            if not local_source.exists():
                log("  Téléchargement du MP4…")
                download_file(
                    video.download_url,
                    local_source,
                )

            start, duration, visual_score = find_best_window(
                local_source,
                args.clip_duration,
                args.sample_every,
            )

            clip_name = (
                f"{video.source}-"
                f"{video.source_id}-"
                f"{safe_name(video.query)}-clip.mp4"
            )

            clip_path = (
                args.output
                / video.category
                / clip_name
            )

            log(
                f"  Extraction de {duration:.1f} s "
                f"à partir de {start:.1f} s…"
            )

            extract_clip(
                local_source,
                clip_path,
                start,
                duration,
                args.output_height,
            )

            video.local_source = str(local_source)
            video.clip_file = str(clip_path)
            video.selected_start_seconds = round(start, 3)
            video.selected_end_seconds = round(start + duration, 3)
            video.visual_score = visual_score

            processed.append(video)
            save_manifest(processed, args.output)

            if not args.keep_sources:
                local_source.unlink(missing_ok=True)

        except Exception as exc:
            log(f"  Vidéo ignorée : {exc}")

    save_manifest(processed, args.output)

    log(
        f"Terminé : {len(processed)} clips créés dans {args.output}"
    )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description=(
            "Recherche des vidéos Pexels/Pixabay, "
            "télécharge les MP4 et extrait les meilleurs passages."
        )
    )

    parser.add_argument(
        "--categories",
        type=Path,
        help="Fichier JSON définissant les catégories et recherches.",
    )

    parser.add_argument(
        "--output",
        type=Path,
        default=Path("output"),
        help="Dossier de sortie.",
    )

    parser.add_argument(
        "--sources",
        default="pexels,pixabay",
        help="Sources séparées par une virgule : pexels,pixabay",
    )

    parser.add_argument(
        "--results-per-query",
        type=int,
        default=12,
        help="Nombre de résultats demandés par recherche et par source.",
    )

    parser.add_argument(
        "--per-category",
        type=int,
        default=3,
        help="Nombre maximal de clips à créer par catégorie.",
    )

    parser.add_argument(
        "--clip-duration",
        type=float,
        default=20.0,
        help="Durée souhaitée des clips en secondes.",
    )

    parser.add_argument(
        "--minimum-source-duration",
        type=float,
        default=20.0,
        help="Durée minimale d'une vidéo source.",
    )

    parser.add_argument(
        "--sample-every",
        type=float,
        default=0.75,
        help="Intervalle entre les images analysées.",
    )

    parser.add_argument(
        "--max-source-height",
        type=int,
        default=1080,
        help="Hauteur maximale préférée au téléchargement.",
    )

    parser.add_argument(
        "--output-height",
        type=int,
        default=1080,
        help="Hauteur maximale du clip final.",
    )

    parser.add_argument(
        "--keep-sources",
        action="store_true",
        help="Conserve les vidéos sources après création des clips.",
    )

    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Effectue uniquement la recherche et crée le manifeste.",
    )

    return parser


def main() -> int:
    parser = build_parser()
    args = parser.parse_args()

    try:
        run(args)
        return 0

    except KeyboardInterrupt:
        log("\nInterrompu.")
        return 130

    except Exception as exc:
        log(f"Erreur : {exc}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
