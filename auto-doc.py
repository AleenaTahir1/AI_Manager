
#!/usr/bin/env python3
"""
RepoDoc – Generate a structured Markdown snapshot of a code repository.
"""

import argparse
import datetime
import os
import sys
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Set

# ----------------------------------------------------------------------
# Configuration
# ----------------------------------------------------------------------

# Files to ignore in doc
IGNORE_FILES = {
    "package-lock.json", "Cargo.lock",
} 
# Directories to ignore completely
IGNORE_DIRS = {
    "node_modules", "target", "dist", "build", "coverage",
    ".git", ".cache", ".next", ".svelte-kit", "out", "bin", "obj", "vendor",
    ".idea", ".vscode", "__pycache__", ".pytest_cache", "gen", ".cargo"
}

# Extensions that are definitely binary (even if no null bytes)
BINARY_EXTENSIONS = {
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".bmp", ".ico", ".svg",
    ".db", ".sqlite", ".sqlite3",
    ".pdf",
    ".zip", ".rar", ".7z", ".tar", ".gz",
    ".mp4", ".mp3", ".wav",
    ".exe", ".dll", ".so", ".dylib",
    ".woff", ".woff2", ".ttf", ".otf",
}

# Configuration files (root only) – will appear after the tree
CONFIG_FILES = {
    "package.json", "Cargo.toml", "vite.config.js", "tauri.conf.json",
    "tsconfig.json", "README.md", ".gitignore", ".prettierrc", ".eslintrc",
    "docker-compose.yml", "docker-compose.yaml", "Makefile", "CMakeLists.txt",
}

# File size limit (default 512 KB)
DEFAULT_MAX_SIZE_KB = 512


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

def is_binary_file(path: Path) -> bool:
    """Return True if the file is binary (extension or content check)."""
    # Check extension
    if path.suffix.lower() in BINARY_EXTENSIONS:
        return True

    # Check content for null bytes in first 8 KB
    try:
        with open(path, "rb") as f:
            chunk = f.read(8192)
            if b"\x00" in chunk:
                return True
    except OSError:
        # If we can't read, assume binary
        return True
    return False


def get_language_for_extension(ext: str) -> str:
    """Map file extension to a Markdown code block language."""
    mapping = {
        ".py": "python",
        ".js": "javascript",
        ".jsx": "jsx",
        ".ts": "typescript",
        ".tsx": "tsx",
        ".json": "json",
        ".toml": "toml",
        ".yml": "yaml",
        ".yaml": "yaml",
        ".html": "html",
        ".css": "css",
        ".scss": "scss",
        ".md": "markdown",
        ".sh": "bash",
        ".rs": "rust",
        ".go": "go",
        ".java": "java",
        ".c": "c",
        ".cpp": "cpp",
        ".h": "c",
        ".hpp": "cpp",
        ".rb": "ruby",
        ".php": "php",
        ".lua": "lua",
        ".r": "r",
        ".swift": "swift",
        ".kt": "kotlin",
        ".dart": "dart",
        ".xml": "xml",
        ".sql": "sql",
        ".tf": "terraform",
        ".dockerfile": "dockerfile",
        # fallback
    }
    return mapping.get(ext.lower(), "")


def format_size(size_bytes: int) -> str:
    """Convert bytes to human readable string."""
    for unit in ["B", "KB", "MB", "GB"]:
        if size_bytes < 1024.0:
            return f"{size_bytes:.1f} {unit}" if unit != "B" else f"{size_bytes} B"
        size_bytes /= 1024.0
    return f"{size_bytes:.1f} TB"


# ----------------------------------------------------------------------
# File collection
# ----------------------------------------------------------------------

def collect_files(
    root: Path,
    max_size_bytes: int,
    exclude_files: Optional[Set[Path]] = None,
) -> Dict:
    """
    Walk the directory tree and classify files.

    Returns a dict with keys:
      - all_files: list of Path objects (relative to root)
      - config_files: dict {relative_path: Path}
      - source_files: dict {relative_path: Path} (text, non-config, not large)
      - binary_files: list of relative paths
      - large_files: list of (relative_path, size)
      - ignored_dirs: set of ignored directory names encountered
      - total_size: sum of sizes of all files (that we can stat)
    """
    if exclude_files is None:
        exclude_files = set()
    # Resolve all exclude files to absolute Path objects
    resolved_excludes = {p.resolve() for p in exclude_files}

    result = {
        "all_files": [],
        "config_files": {},
        "source_files": {},
        "binary_files": [],
        "large_files": [],
        "ignored_dirs": set(),
        "total_size": 0,
    }

    # Use os.walk to get all files, respecting ignore dirs
    for dirpath, dirnames, filenames in os.walk(root, topdown=True):
        # Modify dirnames in-place to skip ignored directories
        skipped = set(dirnames) & IGNORE_DIRS
        dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
        result["ignored_dirs"].update(skipped)

        rel_dir = Path(dirpath).relative_to(root)
        for fname in filenames:
            if fname in IGNORE_FILES:
                continue

            full_path = (Path(dirpath) / fname).resolve()
            if full_path in resolved_excludes:
                continue

            rel_path = full_path.relative_to(root.resolve())
            result["all_files"].append(rel_path)

            # Get size
            try:
                size = full_path.stat().st_size
                result["total_size"] += size
            except OSError:
                size = 0  # cannot stat, treat as 0

            # Check if config file (only root)
            if rel_dir == Path(".") and fname in CONFIG_FILES:
                result["config_files"][rel_path] = full_path
                continue

            # Binary check (skip if binary)
            if is_binary_file(full_path):
                result["binary_files"].append(rel_path)
                continue

            # Large check
            if size > max_size_bytes:
                result["large_files"].append((rel_path, size))
                continue

            # Otherwise it's a source file (text, small enough)
            result["source_files"][rel_path] = full_path

    return result


# ----------------------------------------------------------------------
# Tree generation
# ----------------------------------------------------------------------

def generate_tree(root: Path, all_relative_paths: List[Path]) -> str:
    """
    Build a proper hierarchical text tree representation (nested branch structure).
    """
    if not all_relative_paths:
        return "."

    tree = {}
    for rel_path in all_relative_paths:
        curr = tree
        parts = rel_path.parts
        for i, part in enumerate(parts):
            is_file = (i == len(parts) - 1)
            if part not in curr:
                curr[part] = None if is_file else {}
            curr = curr[part]

    lines = ["."]

    def format_branch(node: Dict, prefix: str = ""):
        # Sort directories first, then files
        entries = sorted(node.keys(), key=lambda k: (node[k] is None, k.lower()))
        count = len(entries)
        for index, key in enumerate(entries):
            is_last = (index == count - 1)
            connector = "└── " if is_last else "├── "
            child = node[key]

            if child is None:  # File
                lines.append(f"{prefix}{connector}{key}")
            else:  # Directory
                lines.append(f"{prefix}{connector}{key}/")
                new_prefix = prefix + ("    " if is_last else "│   ")
                format_branch(child, new_prefix)

    format_branch(tree)
    return "\n".join(lines)


# ----------------------------------------------------------------------
# Markdown generation
# ----------------------------------------------------------------------

def generate_markdown(
    root: Path,
    max_size_bytes: int,
    data: Dict,
    project_name: str = None,
) -> str:
    """Produce the full Markdown document."""

    if project_name is None:
        project_name = root.name

    now = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    # Compute token estimate (approx 4 chars per token for included source)
    included_files = list(data["config_files"].values()) + list(data["source_files"].values())
    total_chars = 0
    for fpath in included_files:
        try:
            with open(fpath, "r", encoding="utf-8", errors="replace") as f:
                total_chars += len(f.read())
        except Exception:
            pass  # ignore read errors

    approx_tokens = total_chars // 4
    approx_chars = total_chars

    # Count files
    num_config = len(data["config_files"])
    num_source = len(data["source_files"])
    num_binary = len(data["binary_files"])
    num_large = len(data["large_files"])
    num_ignored_dirs = len(data["ignored_dirs"])
    total_files = len(data["all_files"])
    total_size = data["total_size"]

    # Build markdown
    md = []

    # Header
    md.append("# Repository Context Bundle\n")
    md.append("```text")
    md.append(f"Generated: {now}")
    md.append(f"Project: {project_name}")
    md.append(f"Files Included: {num_config + num_source}")
    md.append(f"Approx Tokens: {approx_tokens:,}")
    md.append(f"Approx Characters: {approx_chars:,}")
    md.append("```\n")

    # 1. Project Tree
    md.append("# 1. Project Tree\n")
    md.append("```text")
    tree = generate_tree(root, data["all_files"])
    md.append(tree)
    md.append("```\n")

    # 2. Configuration Files
    md.append("# 2. Important Configuration Files\n")
    if data["config_files"]:
        # Sort by name
        for rel_path, full_path in sorted(data["config_files"].items(), key=lambda x: str(x[0])):
            md.append(f"## {rel_path}\n")
            lang = get_language_for_extension(rel_path.suffix) or ""
            md.append(f"```{lang}")
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    md.append(f.read().rstrip())
            except Exception as e:
                md.append(f"[Error reading file: {e}]")
            md.append("```\n")
    else:
        md.append("No configuration files found.\n")

    # 3. Source Code
    md.append("# 3. Source Code\n")
    if data["source_files"]:
        # Sort by depth, then directory, then filename
        def sort_key(item):
            rel_path, _ = item
            parts = rel_path.parts
            depth = len(parts)
            parent = str(rel_path.parent)
            name = rel_path.name.lower()
            return (depth, parent, name)

        for rel_path, full_path in sorted(data["source_files"].items(), key=sort_key):
            md.append(f"## {rel_path}\n")
            lang = get_language_for_extension(rel_path.suffix) or ""
            md.append(f"```{lang}")
            try:
                with open(full_path, "r", encoding="utf-8", errors="replace") as f:
                    md.append(f.read().rstrip())
            except Exception as e:
                md.append(f"[Error reading file: {e}]")
            md.append("```\n")
    else:
        md.append("No source files found.\n")

    # 4. Binary Files
    md.append("# 4. Binary Files\n")
    if data["binary_files"]:
        for rel_path in sorted(data["binary_files"], key=str):
            md.append(f"- {rel_path}")
        md.append("")
    else:
        md.append("No binary files found.\n")

    # 5. Skipped Large Files
    md.append("# 5. Skipped Large Files\n")
    if data["large_files"]:
        for rel_path, size in sorted(data["large_files"], key=lambda x: str(x[0])):
            md.append(f"- {rel_path}  ({format_size(size)})")
        md.append("")
    else:
        md.append("No large files skipped.\n")

    # 6. Statistics
    md.append("# 6. Statistics\n")
    md.append(f"- Files scanned : {total_files}")
    md.append(f"- Included      : {num_config + num_source}")
    md.append(f"- Skipped       : {num_binary + num_large}")
    md.append(f"- Binary        : {num_binary}")
    md.append(f"- Large         : {num_large}")
    md.append(f"- Ignored dirs  : {num_ignored_dirs}")
    md.append(f"- Total size    : {format_size(total_size)}")
    md.append(f"- Markdown size : {approx_chars:,} characters")
    md.append(f"- Estimated tokens: {approx_tokens:,}")

    return "\n".join(md)


# ----------------------------------------------------------------------
# Main
# ----------------------------------------------------------------------

def select_target_directory(root: Path) -> Path:
    """Prompt user to choose directory scope interactively if stdin is interactive."""
    subdirs = [d.name for d in root.iterdir() if d.is_dir() and d.name not in IGNORE_DIRS]
    
    print("\nSelect target directory scope:")
    print("  1. All files (entire project root)")
    
    presets = []
    option_num = 2
    if "src" in subdirs:
        presets.append(("src", "src"))
        print(f"  {option_num}. src")
        option_num += 1
    if "src-tauri" in subdirs:
        presets.append(("src-tauri", "src-tauri"))
        print(f"  {option_num}. src-tauri")
        option_num += 1
        
    other_subdirs = [d for d in sorted(subdirs) if d not in ("src", "src-tauri")]
    for sd in other_subdirs:
        presets.append((sd, sd))
        print(f"  {option_num}. {sd}")
        option_num += 1

    print(f"  {option_num}. Custom path")
    
    try:
        choice = input(f"\nEnter choice (1-{option_num}) [default: 1]: ").strip()
    except (EOFError, KeyboardInterrupt):
        print("\nUsing default: 1")
        return root

    if not choice or choice == "1":
        return root
        
    try:
        idx = int(choice)
        if 2 <= idx < option_num:
            selected_name = presets[idx - 2][1]
            return root / selected_name
        elif idx == option_num:
            custom = input("Enter relative or absolute path: ").strip()
            custom_path = Path(custom)
            if not custom_path.is_absolute():
                custom_path = root / custom_path
            return custom_path
    except ValueError:
        pass
        
    print("Invalid selection. Defaulting to entire repository.")
    return root


def parse_args():
    parser = argparse.ArgumentParser(
        description="Generate a Markdown repository snapshot."
    )
    parser.add_argument(
        "--dir", "-d",
        default=".",
        help="Root directory of the repository (default: current directory)"
    )
    parser.add_argument(
        "--output", "-o",
        default="repo_doc.md",
        help="Output Markdown file (default: repo_doc.md)"
    )
    parser.add_argument(
        "--max-size", "-m",
        type=int,
        default=DEFAULT_MAX_SIZE_KB,
        help=f"Maximum file size in KB to include content (default: {DEFAULT_MAX_SIZE_KB})"
    )
    parser.add_argument(
        "--project-name", "-n",
        default=None,
        help="Project name to display (default: directory name)"
    )
    parser.add_argument(
        "--interactive", "-i",
        action="store_true",
        help="Prompt for directory selection menu (e.g. 1: all, 2: src, 3: src-tauri)"
    )
    return parser.parse_args()


def main():
    args = parse_args()
    root = Path(args.dir).resolve()
    if not root.is_dir():
        print(f"Error: {root} is not a directory", file=sys.stderr)
        sys.exit(1)

    if args.interactive or (sys.stdin.isatty() and not any(arg in sys.argv for arg in ["--dir", "-d"])):
        root = select_target_directory(root)
        if not root.is_dir():
            print(f"Error: Selected target path {root} is not a directory", file=sys.stderr)
            sys.exit(1)

    max_size_bytes = args.max_size * 1024
    output_path = Path(args.output).resolve()
    script_path = Path(__file__).resolve()

    exclude_files = {script_path, output_path}

    print(f"Scanning {root} ...", file=sys.stderr)
    data = collect_files(root, max_size_bytes, exclude_files=exclude_files)
    print(f"Found {len(data['all_files'])} files, {len(data['source_files'])} source, "
          f"{len(data['config_files'])} config, {len(data['binary_files'])} binary, "
          f"{len(data['large_files'])} large.", file=sys.stderr)

    markdown = generate_markdown(
        root=root,
        max_size_bytes=max_size_bytes,
        data=data,
        project_name=args.project_name,
    )

    output_path = Path(args.output)
    output_path.write_text(markdown, encoding="utf-8")
    print(f"Document written to {output_path}", file=sys.stderr)


if __name__ == "__main__":
    main()