"""Language detection, file classification, and inventory scanning.

Deterministically identifies every file in a directory tree, classifies
by language/role, and produces a complete manifest before any parsing begins.
"""

from __future__ import annotations

import fnmatch
import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

# ── Language fingerprinting ──────────────────────────────────────────────

EXTENSION_MAP: dict[str, str] = {
    ".py": "python", ".pyx": "cython", ".pyi": "python-stub",
    ".ts": "typescript", ".tsx": "typescript-react", ".js": "javascript",
    ".jsx": "javascript-react", ".mjs": "javascript-esm", ".cjs": "javascript-cjs",
    ".go": "go", ".rs": "rust", ".c": "c", ".h": "c-header",
    ".cpp": "cpp", ".cc": "cpp", ".cxx": "cpp", ".hpp": "cpp-header",
    ".java": "java", ".kt": "kotlin", ".scala": "scala",
    ".rb": "ruby", ".php": "php", ".swift": "swift",
    ".sh": "shell", ".bash": "shell", ".zsh": "shell",
    ".sql": "sql", ".psql": "sql", ".graphql": "graphql", ".gql": "graphql",
    ".yaml": "yaml", ".yml": "yaml", ".toml": "toml", ".json": "json",
    ".xml": "xml", ".html": "html", ".htm": "html", ".css": "css",
    ".scss": "scss", ".sass": "sass", ".less": "less",
    ".md": "markdown", ".mdx": "markdown-react", ".rst": "restructuredtext",
    ".tex": "latex", ".bib": "bibtex",
    ".dockerfile": "dockerfile", ".dockerignore": "dockerignore",
    ".env": "env", ".gitignore": "gitignore",
    ".cfg": "ini", ".ini": "ini", ".conf": "config",
    ".lock": "lockfile", ".nix": "nix", ".patch": "patch", ".diff": "diff",
    ".ipynb": "jupyter-notebook",
    ".csv": "csv", ".tsv": "tsv",
    ".svg": "svg", ".png": "image", ".jpg": "image", ".jpeg": "image",
    ".gif": "image", ".ico": "image", ".webp": "image",
    ".woff": "font", ".woff2": "font", ".ttf": "font", ".eot": "font",
    ".wasm": "wasm", ".wat": "wat",
    ".proto": "protobuf", ".avsc": "avro",
    ".tf": "terraform", ".hcl": "hcl",
    ".d.ts": "typescript-declaration",
}

SHEBANG_MAP: dict[str, str] = {
    "python": "python", "python3": "python", "python2": "python",
    "node": "javascript", "bash": "shell", "sh": "shell",
    "zsh": "shell", "ruby": "ruby", "perl": "perl",
}

FILENAME_MAP: dict[str, str] = {
    "dockerfile": "dockerfile", "makefile": "makefile",
    "gnumakefile": "makefile", "rakefile": "ruby",
    "cmakelists.txt": "cmake", "meson.build": "meson",
    "package.json": "npm-package", "tsconfig.json": "tsconfig",
    "pyproject.toml": "python-project", "cargo.toml": "rust-project",
    "go.mod": "go-module", "go.sum": "go-checksum",
    "requirements.txt": "pip-requirements",
    "setup.py": "python-setup", "setup.cfg": "python-setup-cfg",
}

# Directories / patterns to always skip
DEFAULT_IGNORE_PATTERNS: list[str] = [
    ".git", ".svn", ".hg", ".bzr",
    "__pycache__", "*.pyc", "*.pyo", "*.pyd",
    "node_modules", "bower_components",
    ".venv", "venv", "virtualenv", ".env",
    ".tox", ".eggs", "*.egg-info", "*.egg",
    "dist", "build", "target", "out", "output",
    ".next", ".nuxt", ".cache", ".parcel-cache",
    ".turbo", ".nx",
    "*.min.js", "*.min.css", "*.bundle.js",
    "*.generated.*", "*-lock.json", "*.lock",
    ".DS_Store", "Thumbs.db",
    "coverage", ".nyc_output", ".coverage",
    "*.log", "*.tmp", "*.temp", "tmp", "temp",
    ".idea", ".vscode", ".vs",
    "*.o", "*.obj", "*.so", "*.dylib", "*.dll", "*.a", "*.lib",
    "*.class", "*.jar", "*.war",
    "*.pdf", "*.zip", "*.tar", "*.gz", "*.bz2", "*.7z", "*.rar",
    "*.exe", "*.bin", "*.dat",
    "*.pb.go", "*.pb.cc", "*_pb2.py", "*_pb2_grpc.py",
    "*.designer.cs", "*.g.cs", "*.g.i.cs",
    "*.snap", "*.snapshot",
    ".audit",  # Don't audit our own output
]


@dataclass
class FileInfo:
    """Complete information about a single file in the scanned tree."""
    path: Path
    relative_path: str
    language: str
    category: str  # source, config, doc, test, data, build, unknown
    extension: str
    size_bytes: int
    lines: int = 0
    is_binary: bool = False
    is_test: bool = False
    is_entrypoint: bool = False
    framework_hints: list[str] = field(default_factory=list)
    shebang: Optional[str] = None
    encoding: str = "utf-8"

    @property
    def is_source(self) -> bool:
        return self.category == "source"

    @property
    def is_config(self) -> bool:
        return self.category == "config"


@dataclass
class ScanResult:
    """Complete inventory of a scanned directory."""
    root: Path
    total_files: int
    total_lines: int
    total_size_bytes: int
    files: list[FileInfo]
    language_counts: dict[str, int]
    category_counts: dict[str, int]
    directory_tree: dict[str, list[str]]  # dir -> [filenames]
    entrypoints: list[FileInfo]
    largest_files: list[FileInfo]  # top 20 by lines
    scan_duration_ms: float


def detect_language(path: Path, content_hint: Optional[str] = None) -> tuple[str, str]:
    """Return (language, category) for a file.

    Uses extension, filename, and optional shebang/content sniffing.
    """
    name_lower = path.name.lower()
    suffix = path.suffix.lower()

    # Check exact filename matches first
    if name_lower in FILENAME_MAP:
        lang = FILENAME_MAP[name_lower]
        cat = _classify_category(lang, path)
        return lang, cat

    # Double extension (e.g. .d.ts)
    if name_lower.endswith(".d.ts"):
        return "typescript-declaration", "source"

    # Extension-based
    if suffix in EXTENSION_MAP:
        lang = EXTENSION_MAP[suffix]
        cat = _classify_category(lang, path)
        return lang, cat

    # No extension — try shebang from content hint
    if content_hint:
        shebang_match = re.match(r"^#!\s*(?:/usr/bin/env\s+)?(\S+)", content_hint)
        if shebang_match:
            binary = Path(shebang_match.group(1)).name
            if binary in SHEBANG_MAP:
                lang = SHEBANG_MAP[binary]
                return lang, "source"

    # Fallback
    if suffix:
        return "unknown", "unknown"
    return "text", "unknown"


def _classify_category(language: str, path: Path) -> str:
    """Classify a file into a high-level category."""
    name_lower = path.name.lower()
    parent = path.parent.name.lower() if path.parent != path else ""

    # Tests
    test_indicators = ["test", "spec", "__test__", "__tests__"]
    if any(t in name_lower for t in test_indicators) or any(
        t in parent for t in test_indicators
    ):
        return "test"

    # Config
    config_langs = {
        "yaml", "toml", "json", "ini", "config", "env", "gitignore",
        "dockerignore", "dockerfile", "nginx-config", "hcl", "terraform",
        "npm-package", "tsconfig", "python-project", "rust-project",
        "go-module", "go-checksum", "pip-requirements", "python-setup",
        "python-setup-cfg", "cmake", "meson", "lockfile",
    }
    if language in config_langs:
        return "config"

    # Documentation
    doc_langs = {"markdown", "markdown-react", "restructuredtext", "latex", "bibtex"}
    if language in doc_langs:
        return "doc"

    # Data
    data_langs = {"csv", "tsv", "json", "xml", "svg"}
    if language in data_langs and language != "json":
        return "data"

    # Build artifacts
    build_names = {"makefile", "gnumakefile", "rakefile"}
    if name_lower in build_names:
        return "build"

    # Source code
    source_langs = {
        "python", "python-stub", "cython",
        "typescript", "typescript-react", "typescript-declaration",
        "javascript", "javascript-react", "javascript-esm", "javascript-cjs",
        "go", "rust", "c", "c-header", "cpp", "cpp-header",
        "java", "kotlin", "scala", "ruby", "php", "swift",
        "shell", "sql", "graphql", "css", "scss", "sass", "less",
        "html", "protobuf", "avro", "jupyter-notebook",
    }
    if language in source_langs:
        return "source"

    return "unknown"


def should_ignore(path: Path, root: Path, extra_ignore: list[str] | None = None) -> bool:
    """Check if a path should be excluded from scanning."""
    patterns = list(DEFAULT_IGNORE_PATTERNS)
    if extra_ignore:
        patterns.extend(extra_ignore)

    rel = str(path.relative_to(root)) if path.is_relative_to(root) else path.name
    name = path.name

    for pattern in patterns:
        if fnmatch.fnmatch(name, pattern):
            return True
        if fnmatch.fnmatch(rel, pattern):
            return True
        # Also match against full path components
        for part in path.parts:
            if fnmatch.fnmatch(part, pattern):
                return True

    return False


def scan_directory(
    root: Path,
    extra_ignore: list[str] | None = None,
    max_file_size_mb: float = 50.0,
) -> ScanResult:
    """Perform a complete census of a directory tree.

    Walks every file, classifies by language/category, counts lines,
    and builds a directory tree manifest.

    Args:
        root: Absolute path to scan
        extra_ignore: Additional glob patterns to exclude
        max_file_size_mb: Skip files larger than this (binary detection fallback)

    Returns:
        ScanResult with complete inventory
    """
    import time
    start = time.monotonic()

    root = root.resolve()
    files: list[FileInfo] = []
    dir_tree: dict[str, list[str]] = {}
    language_counts: dict[str, int] = {}
    category_counts: dict[str, int] = {}
    total_lines = 0
    total_size = 0

    max_bytes = int(max_file_size_mb * 1024 * 1024)

    for dirpath, dirnames, filenames in os.walk(root):
        # Filter directories in-place
        dirnames[:] = [
            d for d in dirnames
            if not should_ignore(Path(dirpath) / d, root, extra_ignore)
        ]

        rel_dir = str(Path(dirpath).relative_to(root)) if dirpath != str(root) else "."
        dir_tree[rel_dir] = []

        for fname in sorted(filenames):
            fpath = Path(dirpath) / fname
            if should_ignore(fpath, root, extra_ignore):
                continue

            try:
                stat = fpath.stat()
                size = stat.st_size
            except OSError:
                continue

            if size > max_bytes:
                continue

            total_size += size
            dir_tree[rel_dir].append(fname)

            # Read first line for shebang/content detection
            content_hint = None
            is_binary = False
            line_count = 0

            try:
                with open(fpath, "r", encoding="utf-8", errors="replace") as fh:
                    content_hint = fh.readline(512)
                    if "\x00" in content_hint:
                        is_binary = True
                    else:
                        # Count lines (fast, streaming)
                        line_count = 1  # we already read line 1
                        for _ in fh:
                            line_count += 1
            except (OSError, UnicodeDecodeError):
                is_binary = True

            if is_binary:
                lang, cat = "binary", "data"
            else:
                lang, cat = detect_language(fpath, content_hint)

            total_lines += line_count

            # Test detection
            is_test = cat == "test" or "test" in fname.lower() or "spec" in fname.lower()

            # Entrypoint detection
            is_entrypoint = _is_entrypoint(fpath, lang)

            # Framework hints
            framework_hints = _detect_frameworks(fpath, lang, content_hint or "")

            fi = FileInfo(
                path=fpath,
                relative_path=str(fpath.relative_to(root)),
                language=lang,
                category=cat,
                extension=fpath.suffix.lower(),
                size_bytes=size,
                lines=line_count,
                is_binary=is_binary,
                is_test=is_test,
                is_entrypoint=is_entrypoint,
                framework_hints=framework_hints,
                shebang=_extract_shebang(content_hint) if content_hint else None,
            )

            files.append(fi)
            language_counts[lang] = language_counts.get(lang, 0) + 1
            category_counts[cat] = category_counts.get(cat, 0) + 1

    # Sort: source files first, then by lines descending
    files.sort(key=lambda f: (f.category != "source", -f.lines))

    entrypoints = [f for f in files if f.is_entrypoint]
    largest = sorted(files, key=lambda f: -f.lines)[:20]

    elapsed = (time.monotonic() - start) * 1000

    return ScanResult(
        root=root,
        total_files=len(files),
        total_lines=total_lines,
        total_size_bytes=total_size,
        files=files,
        language_counts=dict(sorted(language_counts.items(), key=lambda x: -x[1])),
        category_counts=category_counts,
        directory_tree=dir_tree,
        entrypoints=entrypoints,
        largest_files=largest,
        scan_duration_ms=elapsed,
    )


def _is_entrypoint(path: Path, language: str) -> bool:
    """Heuristic entrypoint detection."""
    name = path.name.lower()
    entrypoint_names = {
        "main.py", "app.py", "server.py", "index.py", "run.py", "manage.py",
        "main.ts", "main.tsx", "index.ts", "index.tsx", "app.ts", "app.tsx",
        "server.ts", "server.js", "index.js", "app.js",
        "main.go", "main.rs", "main.c", "main.cpp",
        "application.java", "main.java",
    }
    if name in entrypoint_names:
        return True
    # Check for common entrypoint patterns
    if language == "shell" and name.endswith((".sh", ".bash")):
        return True
    return False


def _detect_frameworks(path: Path, language: str, content: str) -> list[str]:
    """Detect framework usage from imports and config patterns."""
    hints: list[str] = []
    content_lower = content.lower()

    if language in ("typescript", "typescript-react", "javascript", "javascript-react"):
        if "react" in content_lower:
            hints.append("react")
        if "next" in content_lower or "nextjs" in content_lower:
            hints.append("nextjs")
        if "vue" in content_lower:
            hints.append("vue")
        if "angular" in content_lower or "@angular" in content:
            hints.append("angular")
        if "express" in content_lower:
            hints.append("express")
        if "fastify" in content_lower:
            hints.append("fastify")
        if "prisma" in content_lower:
            hints.append("prisma")
        if "tailwind" in content_lower:
            hints.append("tailwind")
        if "playwright" in content_lower:
            hints.append("playwright")
        if "vitest" in content_lower:
            hints.append("vitest")
        if "jest" in content_lower:
            hints.append("jest")

    elif language == "python":
        if "fastapi" in content_lower:
            hints.append("fastapi")
        if "flask" in content_lower:
            hints.append("flask")
        if "django" in content_lower:
            hints.append("django")
        if "sqlalchemy" in content_lower:
            hints.append("sqlalchemy")
        if "pydantic" in content_lower:
            hints.append("pydantic")
        if "pytest" in content_lower:
            hints.append("pytest")
        if "celery" in content_lower:
            hints.append("celery")
        if "click" in content_lower or "typer" in content_lower:
            hints.append("cli-framework")
        if "catboost" in content_lower:
            hints.append("catboost")
        if "xgboost" in content_lower:
            hints.append("xgboost")
        if "lightgbm" in content_lower:
            hints.append("lightgbm")

    elif language == "go":
        if "gin" in content_lower:
            hints.append("gin")
        if "echo" in content_lower:
            hints.append("echo")
        if "fiber" in content_lower:
            hints.append("fiber")

    elif language == "rust":
        if "actix" in content_lower:
            hints.append("actix")
        if "axum" in content_lower:
            hints.append("axum")
        if "tokio" in content_lower:
            hints.append("tokio")

    return hints


def _extract_shebang(first_line: str | None) -> str | None:
    """Extract shebang from first line of file."""
    if first_line and first_line.startswith("#!"):
        return first_line.strip()
    return None
