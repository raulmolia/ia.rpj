#!/usr/bin/env python3
"""Utilidad para iniciar un servidor de ChromaDB con duckdb y SQLite actualizado."""

import os
import sys


def _ensure_sqlite() -> None:
    """Inyecta pysqlite3 como sqlite3 antes de importar ChromaDB."""

    try:
        import pysqlite3 as sqlite3  # pylint: disable=unused-import
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise RuntimeError(
            "Instala pysqlite3-binary para levantar ChromaDB (python3 -m pip install --user pysqlite3-binary)"
        ) from exc

    sys.modules["sqlite3"] = sqlite3


def _bool_env(var_name: str, default: str = "false") -> bool:
    value = os.environ.get(var_name, default)
    return value.lower() in {"1", "true", "yes", "on"}


def main() -> None:
    _ensure_sqlite()

    host = os.environ.get("CHROMA_HOST", "127.0.0.1")
    port = int(os.environ.get("CHROMA_PORT", "8000"))
    persist_directory = os.environ.get(
        "CHROMA_PERSIST_PATH",
        "/var/www/vhosts/ia.rpj.es/httpdocs/database/chroma",
    )

    # Configuración de entorno esperada por el servidor oficial.
    os.environ.setdefault("PERSIST_DIRECTORY", persist_directory)
    os.environ.setdefault("IS_PERSISTENT", "True")
    if "CHROMA_DB_IMPL" in os.environ:
        # Evitar configuraciones legacy que rompen el arranque en versiones modernas.
        os.environ.pop("CHROMA_DB_IMPL")
    os.environ.setdefault("ANONYMIZED_TELEMETRY", "false" if not _bool_env("CHROMA_TELEMETRY") else "true")
    os.environ.setdefault("CHROMA_SERVER_NOFILE", "65535")

    from chromadb import app as chroma_app  # noqa: E402  pylint: disable=wrong-import-position
    import uvicorn  # noqa: E402

    print(
        f"ChromaDB escuchando en http://{host}:{port} (persistencia: {persist_directory})"
    )

    uvicorn.run(chroma_app.app, host=host, port=port, log_level="info")


if __name__ == "__main__":
    main()
