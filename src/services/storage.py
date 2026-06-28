from __future__ import annotations

import re
from pathlib import Path
from uuid import uuid4

STORAGE_ROOT = Path("storage")
TEMPLATES_DIR = STORAGE_ROOT / "templates"
EXPORTS_DIR = STORAGE_ROOT / "exports"
TEMP_DIR = STORAGE_ROOT / "temp"


def ensure_storage_dirs() -> None:
    for directory in (TEMPLATES_DIR, EXPORTS_DIR, TEMP_DIR):
        directory.mkdir(parents=True, exist_ok=True)


def generate_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex[:12]}"


def safe_filename(filename: str) -> str:
    name = Path(filename).name.strip() or "upload"
    safe = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    return safe.strip("._") or "upload"


def save_binary_file(directory: Path, entity_id: str, filename: str, content: bytes) -> Path:
    ensure_storage_dirs()
    suffix = Path(filename).suffix.lower()
    output_path = directory / f"{entity_id}{suffix}"
    output_path.write_bytes(content)
    return output_path
