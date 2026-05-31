"""Call graph, dependency graph, and relationship extraction.

Builds a complete graph model from parsed files: call edges, import edges,
containment edges, and cross-file references. Stored in SQLite with
recursive CTE support for graph traversal queries.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional
import json

from .parser import ParsedFile, FunctionInfo, ClassInfo, ImportInfo
from .scanner import FileInfo


@dataclass
class CallEdge:
    caller_file: str
    caller_func: str
    callee_name: str
    callee_file: Optional[str] = None  # Resolved later
    callee_func: Optional[str] = None
    line: int = 0
    is_resolved: bool = False
    is_external: bool = False


@dataclass
class ImportEdge:
    importer_file: str
    imported_module: str
    imported_names: list[str] = field(default_factory=list)
    resolved_file: Optional[str] = None
    line: int = 0
    is_resolved: bool = False


@dataclass
class ContainmentEdge:
    container_file: str
    container_type: str  # "file", "class"
    container_name: str
    child_type: str  # "function", "class", "variable"
    child_name: str


@dataclass
class CodeGraph:
    """Complete code graph for a project."""
    root: Path
    files: dict[str, ParsedFile]  # path -> ParsedFile
    call_edges: list[CallEdge]
    import_edges: list[ImportEdge]
    containment_edges: list[ContainmentEdge]
    # Indexes for fast lookup
    _func_index: dict[str, list[tuple[str, FunctionInfo]]] = field(default_factory=dict)
    _class_index: dict[str, list[tuple[str, ClassInfo]]] = field(default_factory=dict)
    _file_imports: dict[str, list[str]] = field(default_factory=dict)  # file -> [imported files]


def build_graph(
    root: Path,
    parsed_files: dict[str, ParsedFile],
    file_infos: list[FileInfo],
) -> CodeGraph:
    """Build a complete code graph from parsed files.

    Extracts:
    - Call edges: function A calls function B
    - Import edges: file A imports module/file B
    - Containment edges: file/class contains function/class
    - Cross-file call resolution

    Args:
        root: Project root directory
        parsed_files: Map of relative path -> ParsedFile
        file_infos: List of FileInfo from scanner

    Returns:
        CodeGraph with all edges and indexes
    """
    graph = CodeGraph(
        root=root,
        files=parsed_files,
        call_edges=[],
        import_edges=[],
        containment_edges=[],
    )

    # Build function and class indexes
    for path, pf in parsed_files.items():
        for func in pf.functions:
            key = func.name
            if key not in graph._func_index:
                graph._func_index[key] = []
            graph._func_index[key].append((path, func))

        for cls in pf.classes:
            key = cls.name
            if key not in graph._class_index:
                graph._class_index[key] = []
            graph._class_index[key].append((path, cls))

    # Build file path index for import resolution
    file_path_index: dict[str, str] = {}
    for fi in file_infos:
        name_no_ext = Path(fi.relative_path).stem
        file_path_index[name_no_ext] = fi.relative_path
        file_path_index[fi.relative_path.replace("/", ".").replace("\\", ".")] = fi.relative_path
        # Also index without extension
        parts = fi.relative_path.rsplit(".", 1)
        if len(parts) > 1:
            file_path_index[parts[0]] = fi.relative_path

    # Extract edges from each parsed file
    for path, pf in parsed_files.items():
        # Import edges
        for imp in pf.imports:
            edge = ImportEdge(
                importer_file=path,
                imported_module=imp.module,
                imported_names=imp.names,
                line=imp.line,
            )
            # Try to resolve the import to an actual file
            resolved = _resolve_import(imp.module, file_path_index, root, path)
            if resolved:
                edge.resolved_file = resolved
                edge.is_resolved = True
                if path not in graph._file_imports:
                    graph._file_imports[path] = []
                graph._file_imports[path].append(resolved)

            graph.import_edges.append(edge)

        # Containment edges: file contains functions/classes
        for func in pf.functions:
            graph.containment_edges.append(ContainmentEdge(
                container_file=path,
                container_type="file",
                container_name=Path(path).name,
                child_type="function",
                child_name=func.name,
            ))

        for cls in pf.classes:
            graph.containment_edges.append(ContainmentEdge(
                container_file=path,
                container_type="file",
                container_name=Path(path).name,
                child_type="class",
                child_name=cls.name,
            ))
            # Class contains methods
            for method in cls.methods:
                graph.containment_edges.append(ContainmentEdge(
                    container_file=path,
                    container_type="class",
                    container_name=cls.name,
                    child_type="function",
                    child_name=method.name,
                ))

        # Call edges
        for func in pf.functions:
            for call_name in func.calls:
                edge = CallEdge(
                    caller_file=path,
                    caller_func=func.name,
                    callee_name=call_name,
                    line=func.start_line,
                )

                # Try to resolve the callee
                if call_name in graph._func_index:
                    candidates = graph._func_index[call_name]
                    # Prefer same-file, then same-directory
                    same_file = [c for c in candidates if c[0] == path]
                    if same_file:
                        edge.callee_file = same_file[0][0]
                        edge.callee_func = same_file[0][1].name
                        edge.is_resolved = True
                    elif candidates:
                        edge.callee_file = candidates[0][0]
                        edge.callee_func = candidates[0][1].name
                        edge.is_resolved = True
                else:
                    edge.is_external = True

                graph.call_edges.append(edge)

    return graph


def _resolve_import(
    module: str, file_index: dict[str, str], root: Path, importer_path: str = ""
) -> str | None:
    """Resolve an import module string to an actual file path.

    Handles:
    - Absolute paths (relative to root)
    - Relative paths (./ and ../) resolved against importer directory
    - Bare module names (matched against file stems)
    - Dotted paths (converted to slashes)
    """
    # Direct match
    if module in file_index:
        return file_index[module]

    # Handle relative paths (./ or ../)
    if module.startswith("."):
        importer_dir = str(Path(importer_path).parent) if importer_path else "."
        try:
            resolved_path = _resolve_relative_path(module, importer_dir)
            if resolved_path in file_index:
                return file_index[resolved_path]
            # Try with extensions
            for ext in (".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs"):
                key = resolved_path + ext
                if key in file_index:
                    return file_index[key]
                for idx_ext in ("/index.ts", "/index.tsx", "/index.js", "/__init__.py"):
                    idx_key = resolved_path + idx_ext
                    if idx_key in file_index:
                        return file_index[idx_key]
        except Exception:
            pass
        return None

    # Try with common extensions
    for ext in (".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs"):
        key = module + ext
        if key in file_index:
            return file_index[key]

    # Try as path (replace dots with slashes)
    as_path = module.replace(".", "/")
    if as_path in file_index:
        return file_index[as_path]

    for ext in (".py", ".ts", ".tsx", ".js", ".jsx", ".go", ".rs"):
        key = as_path + ext
        if key in file_index:
            return file_index[key]

    # Try index files
    for ext in ("/index.ts", "/index.tsx", "/index.js", "/__init__.py"):
        key = as_path + ext
        if key in file_index:
            return file_index[key]

    return None


def _resolve_relative_path(module: str, importer_dir: str) -> str:
    """Resolve a relative import like ./foo or ../bar against the importer's directory."""
    # Split module into components
    parts = module.split("/")
    dir_parts = importer_dir.split("/") if importer_dir != "." else []

    for part in parts:
        if part == "..":
            if dir_parts:
                dir_parts.pop()
            else:
                dir_parts = []
        elif part == ".":
            continue
        else:
            dir_parts.append(part)

    return "/".join(dir_parts)


def compute_blast_radius(
    graph: CodeGraph, changed_file: str, max_depth: int = 5
) -> dict[str, list[str]]:
    """Compute which files are potentially affected by a change.

    Uses the dependency graph to find all files that directly or
    indirectly depend on the changed file.

    Args:
        graph: The code graph
        changed_file: Relative path of the changed file
        max_depth: Maximum traversal depth

    Returns:
        Dict mapping depth -> list of affected file paths
    """
    # Build reverse dependency map: file -> [files that import it]
    reverse_deps: dict[str, set[str]] = {}
    for importer, imported_list in graph._file_imports.items():
        for imported in imported_list:
            if imported not in reverse_deps:
                reverse_deps[imported] = set()
            reverse_deps[imported].add(importer)

    affected: dict[str, list[str]] = {}
    visited: set[str] = {changed_file}
    frontier = {changed_file}

    for depth in range(1, max_depth + 1):
        next_frontier: set[str] = set()
        for f in frontier:
            if f in reverse_deps:
                for dep in reverse_deps[f]:
                    if dep not in visited:
                        visited.add(dep)
                        next_frontier.add(dep)

        if not next_frontier:
            break

        affected[str(depth)] = sorted(next_frontier)
        frontier = next_frontier

    return affected


def find_cycles(graph: CodeGraph) -> list[list[str]]:
    """Detect circular dependencies in the import graph.

    Returns:
        List of cycles, each cycle is a list of file paths
    """
    # Build adjacency list
    adj: dict[str, set[str]] = {}
    for importer, imported_list in graph._file_imports.items():
        if importer not in adj:
            adj[importer] = set()
        for imported in imported_list:
            adj[importer].add(imported)

    cycles: list[list[str]] = []
    visited: set[str] = set()
    in_stack: set[str] = set()
    stack: list[str] = []

    def dfs(node: str) -> None:
        visited.add(node)
        in_stack.add(node)
        stack.append(node)

        for neighbor in adj.get(node, set()):
            if neighbor not in visited:
                dfs(neighbor)
            elif neighbor in in_stack:
                # Found a cycle
                cycle_start = stack.index(neighbor)
                cycles.append(stack[cycle_start:] + [neighbor])

        stack.pop()
        in_stack.discard(node)

    for node in adj:
        if node not in visited:
            dfs(node)

    return cycles


def find_dead_code(graph: CodeGraph) -> list[str]:
    """Identify potentially dead code — functions never called.

    Returns:
        List of "file_path:function_name" strings
    """
    called: set[tuple[str, str]] = set()
    for edge in graph.call_edges:
        if edge.is_resolved and edge.callee_file and edge.callee_func:
            called.add((edge.callee_file, edge.callee_func))

    dead: list[str] = []
    for path, pf in graph.files.items():
        for func in pf.functions:
            if func.is_exported:
                continue  # Exported functions may be called externally
            if (path, func.name) not in called:
                # Check if it's an entrypoint
                if func.name in ("main", "init", "run", "start", "handle", "render"):
                    continue
                dead.append(f"{path}:{func.name}")

    return dead


def graph_to_json(graph: CodeGraph) -> dict:
    """Serialize the graph to a JSON-compatible dict."""
    return {
        "root": str(graph.root),
        "file_count": len(graph.files),
        "call_edge_count": len(graph.call_edges),
        "import_edge_count": len(graph.import_edges),
        "containment_edge_count": len(graph.containment_edges),
        "resolved_calls": sum(1 for e in graph.call_edges if e.is_resolved),
        "unresolved_calls": sum(1 for e in graph.call_edges if not e.is_resolved),
        "external_calls": sum(1 for e in graph.call_edges if e.is_external),
        "cycles": find_cycles(graph),
        "dead_code": find_dead_code(graph),
    }
