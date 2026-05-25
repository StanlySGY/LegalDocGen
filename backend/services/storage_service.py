import os
from pathlib import Path

from backend.config import settings


class LocalStorage:
    def __init__(self, root: Path):
        self.root = root

    def save(self, key: str, content: bytes) -> str:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return str(path)

    def delete(self, path: str):
        Path(path).unlink(missing_ok=True)

    def health(self) -> dict:
        return {
            "mode": settings.STORAGE_BACKEND,
            "upload_dir": str(self.root),
            "exists": self.root.exists(),
            "writable": self.root.exists() and self.root.is_dir() and os.access(self.root, os.W_OK),
        }


def get_storage() -> LocalStorage:
    return LocalStorage(settings.UPLOAD_DIR)
