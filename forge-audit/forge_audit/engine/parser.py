"""Tree-sitter AST parser for multi-language deterministic extraction.

Uses Tree-sitter QueryCursor API for proper AST queries.
Extracts functions, classes, imports, calls, exports, and structural metadata.
Falls back to regex when Tree-sitter queries return nothing.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from tree_sitter import Language, Parser, Node, Query, QueryCursor

# ── Language grammar loading ─────────────────────────────────────────────

_GRAMMAR_CACHE: dict[str, Language] = {}

LANG_TO_MODULE: dict[str, tuple[str, str]] = {
    "python": ("tree_sitter_python", "language"),
    "python-stub": ("tree_sitter_python", "language"),
    "typescript": ("tree_sitter_typescript", "language_tsx"),
    "typescript-react": ("tree_sitter_typescript", "language_tsx"),
    "typescript-declaration": ("tree_sitter_typescript", "language_tsx"),
    "javascript": ("tree_sitter_javascript", "language"),
    "javascript-react": ("tree_sitter_javascript", "language"),
    "javascript-esm": ("tree_sitter_javascript", "language"),
    "javascript-cjs": ("tree_sitter_javascript", "language"),
    "go": ("tree_sitter_go", "language"),
    "rust": ("tree_sitter_rust", "language"),
    "c": ("tree_sitter_c", "language"),
    "c-header": ("tree_sitter_c", "language"),
    "bash": ("tree_sitter_bash", "language"),
    "shell": ("tree_sitter_bash", "language"),
    "sql": ("tree_sitter_sql", "language"),
    "html": ("tree_sitter_html", "language"),
    "css": ("tree_sitter_css", "language"),
    "json": ("tree_sitter_json", "language"),
    "yaml": ("tree_sitter_yaml", "language"),
}


def _get_language(lang_id: str) -> Language | None:
    info = LANG_TO_MODULE.get(lang_id)
    if not info:
        return None
    module_name, func_name = info
    if lang_id not in _GRAMMAR_CACHE:
        try:
            mod = __import__(module_name, fromlist=[func_name])
            lang_fn = getattr(mod, func_name)
            _GRAMMAR_CACHE[lang_id] = Language(lang_fn())
        except Exception:
            return None
    return _GRAMMAR_CACHE[lang_id]


# ── AST node types ───────────────────────────────────────────────────────

@dataclass
class FunctionInfo:
    name: str
    start_line: int
    end_line: int
    params: list[str] = field(default_factory=list)
    return_type: Optional[str] = None
    docstring: Optional[str] = None
    is_async: bool = False
    is_exported: bool = False
    decorators: list[str] = field(default_factory=list)
    body_lines: list[str] = field(default_factory=list)
    calls: list[str] = field(default_factory=list)
    complexity: int = 0


@dataclass
class ClassInfo:
    name: str
    start_line: int
    end_line: int
    methods: list[FunctionInfo] = field(default_factory=list)
    base_classes: list[str] = field(default_factory=list)
    decorators: list[str] = field(default_factory=list)
    is_exported: bool = False


@dataclass
class ImportInfo:
    module: str
    names: list[str] = field(default_factory=list)
    is_default: bool = False
    is_dynamic: bool = False
    line: int = 0


@dataclass
class VariableInfo:
    name: str
    line: int
    type_hint: Optional[str] = None
    is_const: bool = False
    is_exported: bool = False


@dataclass
class ParsedFile:
    path: str
    language: str
    lines: list[str]
    functions: list[FunctionInfo]
    classes: list[ClassInfo]
    imports: list[ImportInfo]
    exports: list[str]
    top_level_vars: list[VariableInfo]
    total_lines: int
    comment_lines: int
    blank_lines: int
    parse_errors: list[str]
    tokens: list[str] = field(default_factory=list)
    ast_node_count: int = 0


# ── Tree-sitter queries ──────────────────────────────────────────────────

FUNC_QUERY_TS = """
(function_declaration
    name: (identifier) @func.name
    parameters: (formal_parameters) @func.params
    body: (statement_block) @func.body
) @func.def

(method_definition
    name: (property_identifier) @func.name
    parameters: (formal_parameters) @func.params
    body: (statement_block) @func.body
) @func.def

(lexical_declaration
    (variable_declarator
        name: (identifier) @func.name
        value: (arrow_function
            parameters: (formal_parameters) @func.params
            body: [
                (statement_block) @func.body
                (expression) @func.body
            ]
        )
    )
) @func.arrow
"""

FUNC_QUERY_PY = """
(function_definition
    name: (identifier) @func.name
    parameters: (parameters) @func.params
    body: (block) @func.body
) @func.def

(decorated_definition
    (decorator) @func.decorator
    definition: (function_definition
        name: (identifier) @func.name
        parameters: (parameters) @func.params
        body: (block) @func.body
    ) @func.def
)
"""

CLASS_QUERY_TS = """
(class_declaration
    name: (identifier) @class.name
    body: (class_body) @class.body
) @class.def
"""

CLASS_QUERY_PY = """
(class_definition
    name: (identifier) @class.name
    superclasses: (argument_list) @class.bases
    body: (block) @class.body
) @class.def
"""

IMPORT_QUERY_TS = """
(import_statement
    source: (string) @import.source
) @import.stmt
"""

IMPORT_QUERY_PY = """
(import_statement
    name: (dotted_name) @import.module
) @import.stmt

(import_from_statement
    module_name: (dotted_name) @import.module
    name: (dotted_name) @import.name
) @import.from
"""


# ── Main parse function ──────────────────────────────────────────────────

def parse_file(file_path: Path, language: str, source: str) -> ParsedFile:
    """Parse a single source file with Tree-sitter + regex fallback."""
    lines = source.split("\n")
    ts_lang = _get_language(language)

    if ts_lang is None:
        return _regex_parse(str(file_path), language, lines, source)

    parser = Parser(ts_lang)
    tree = parser.parse(source.encode("utf-8"))
    root = tree.root_node

    node_count = _count_nodes(root)
    errors = _collect_errors(root, source) if root.has_error else []

    # Extract using Tree-sitter queries
    functions = _extract_functions_ts(root, ts_lang, source, language)
    classes = _extract_classes_ts(root, ts_lang, source, language)
    imports = _extract_imports_ts(root, ts_lang, source, language)
    exports = _extract_exports(source, language)

    # Fall back to regex if Tree-sitter got nothing
    if not functions:
        functions = _fallback_functions(source, language)
    if not imports:
        imports = _fallback_imports(source, language)
    if not classes:
        classes = _fallback_classes(source, language)

    _assign_calls(functions, source)

    comment_lines = _count_comments(lines, language)
    blank_lines = sum(1 for l in lines if not l.strip())

    return ParsedFile(
        path=str(file_path), language=language, lines=lines,
        functions=functions, classes=classes, imports=imports,
        exports=exports, top_level_vars=[],
        total_lines=len(lines), comment_lines=comment_lines,
        blank_lines=blank_lines, parse_errors=errors,
        ast_node_count=node_count,
    )


# ── Tree-sitter extraction ───────────────────────────────────────────────

def _run_query(root: Node, lang: Language, query_str: str) -> dict[str, list[Node]]:
    try:
        q = Query(lang, query_str)
        cursor = QueryCursor(q)
        return cursor.captures(root)
    except Exception:
        return {}


def _extract_functions_ts(root: Node, lang: Language, source: str, language: str) -> list[FunctionInfo]:
    query_str = FUNC_QUERY_PY if language in ("python", "python-stub") else FUNC_QUERY_TS
    captures = _run_query(root, lang, query_str)
    if not captures:
        return []

    # Group by definition node
    func_defs: dict[int, dict] = {}
    for tag in ("func.def", "func.arrow"):
        for node in captures.get(tag, []):
            func_defs[node.id] = {"node": node, "name": "", "params": "", "body": "", "decorator": ""}

    for tag, nodes in captures.items():
        if tag in ("func.def", "func.arrow"):
            continue
        for node in nodes:
            parent = _find_ancestor(node, {
                "function_definition", "function_declaration",
                "method_definition", "decorated_definition",
                "lexical_declaration", "variable_declarator",
            })
            if parent and parent.id in func_defs:
                key = tag.split(".")[1]
                func_defs[parent.id][key] = source[node.start_byte:node.end_byte]

    functions = []
    for fg in func_defs.values():
        node = fg["node"]
        name = fg.get("name", "")
        if not name:
            continue
        prefix = source[max(0, node.start_byte - 30):node.start_byte]
        functions.append(FunctionInfo(
            name=name,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            params=_parse_params(fg.get("params", ""), language),
            is_async="async" in prefix,
            is_exported="export" in prefix,
            decorators=[fg["decorator"]] if fg.get("decorator") else [],
            complexity=_estimate_complexity(source[node.start_byte:node.end_byte], language),
        ))
    return functions


def _extract_classes_ts(root: Node, lang: Language, source: str, language: str) -> list[ClassInfo]:
    query_str = CLASS_QUERY_PY if language in ("python", "python-stub") else CLASS_QUERY_TS
    captures = _run_query(root, lang, query_str)
    if not captures:
        return []

    classes = []
    for node in captures.get("class.def", []):
        name = ""
        for n in captures.get("class.name", []):
            if n.start_byte >= node.start_byte and n.end_byte <= node.end_byte:
                name = source[n.start_byte:n.end_byte]
                break
        if not name:
            continue

        bases = []
        for base_node in captures.get("class.bases", []):
            if base_node.start_byte >= node.start_byte and base_node.end_byte <= node.end_byte:
                bases_str = source[base_node.start_byte:base_node.end_byte].strip("()")
                bases = [b.strip() for b in bases_str.split(",") if b.strip()]

        prefix = source[max(0, node.start_byte - 20):node.start_byte]
        classes.append(ClassInfo(
            name=name,
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            base_classes=bases,
            is_exported="export" in prefix,
        ))
    return classes


def _extract_imports_ts(root: Node, lang: Language, source: str, language: str) -> list[ImportInfo]:
    query_str = IMPORT_QUERY_PY if language in ("python", "python-stub") else IMPORT_QUERY_TS
    captures = _run_query(root, lang, query_str)
    if not captures:
        return []

    imports = []
    if language in ("python", "python-stub"):
        for node in captures.get("import.stmt", []):
            for mod_node in captures.get("import.module", []):
                if mod_node.start_byte >= node.start_byte and mod_node.end_byte <= node.end_byte:
                    imports.append(ImportInfo(
                        module=source[mod_node.start_byte:mod_node.end_byte],
                        line=node.start_point[0] + 1,
                    ))
        for node in captures.get("import.from", []):
            for mod_node in captures.get("import.module", []):
                if mod_node.start_byte >= node.start_byte and mod_node.end_byte <= node.end_byte:
                    module = source[mod_node.start_byte:mod_node.end_byte]
                    names = []
                    for name_node in captures.get("import.name", []):
                        if name_node.start_byte >= node.start_byte and name_node.end_byte <= node.end_byte:
                            names.append(source[name_node.start_byte:name_node.end_byte])
                    imports.append(ImportInfo(module=module, names=names, line=node.start_point[0] + 1))
    else:
        for node in captures.get("import.stmt", []):
            for src_node in captures.get("import.source", []):
                if src_node.start_byte >= node.start_byte and src_node.end_byte <= node.end_byte:
                    module = source[src_node.start_byte:src_node.end_byte].strip("'\"")
                    names = _extract_ts_import_names(node, source)
                    imports.append(ImportInfo(
                        module=module, names=names,
                        is_default=any(n == "default" for n in names),
                        line=node.start_point[0] + 1,
                    ))
    return imports


def _extract_exports(source: str, language: str) -> list[str]:
    exports: list[str] = []
    if language in ("typescript", "typescript-react", "javascript", "javascript-react"):
        for m in re.finditer(r"export\s+(?:const|let|var|function|class|interface|type|enum)\s+(\w+)", source):
            exports.append(m.group(1))
        for m in re.finditer(r"export\s+\{\s*([^}]+)\s*\}", source):
            for name in m.group(1).split(","):
                name = name.strip().split(" as ")[0].strip()
                if name:
                    exports.append(name)
        for m in re.finditer(r"export\s+default\s+(?:function|class)?\s*(\w+)?", source):
            if m.group(1):
                exports.append(m.group(1))
    elif language in ("python", "python-stub"):
        for m in re.finditer(r"^__all__\s*=\s*\[([^\]]+)\]", source, re.MULTILINE):
            exports.extend(n.strip().strip("'\"") for n in m.group(1).split(","))
    return exports


# ── Regex fallbacks ──────────────────────────────────────────────────────

def _fallback_functions(source: str, language: str) -> list[FunctionInfo]:
    functions: list[FunctionInfo] = []
    if language in ("python", "python-stub"):
        for m in re.finditer(r"^\s*(?:async\s+)?def\s+(\w+)\s*\((.*?)\)", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            functions.append(FunctionInfo(
                name=m.group(1), start_line=line_no, end_line=line_no,
                params=[p.strip() for p in m.group(2).split(",") if p.strip()],
                is_async="async" in m.group(0),
            ))
    elif language in ("typescript", "typescript-react", "javascript", "javascript-react"):
        for m in re.finditer(r"(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\((.*?)\)", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            functions.append(FunctionInfo(
                name=m.group(1), start_line=line_no, end_line=line_no,
                params=[p.strip() for p in m.group(2).split(",") if p.strip()],
                is_async="async" in m.group(0), is_exported="export" in m.group(0),
            ))
        for m in re.finditer(r"(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\((.*?)\)\s*=>", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            functions.append(FunctionInfo(
                name=m.group(1), start_line=line_no, end_line=line_no,
                params=[p.strip() for p in m.group(2).split(",") if p.strip()],
                is_async="async" in m.group(0), is_exported="export" in m.group(0),
            ))
    return functions


def _fallback_classes(source: str, language: str) -> list[ClassInfo]:
    classes: list[ClassInfo] = []
    if language in ("python", "python-stub"):
        for m in re.finditer(r"^\s*class\s+(\w+)\s*(?:\((.*?)\))?\s*:", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            bases = [b.strip() for b in m.group(2).split(",") if b.strip()] if m.group(2) else []
            classes.append(ClassInfo(name=m.group(1), start_line=line_no, end_line=line_no, base_classes=bases))
    elif language in ("typescript", "typescript-react", "javascript", "javascript-react"):
        for m in re.finditer(r"(?:export\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            bases = [m.group(2)] if m.group(2) else []
            classes.append(ClassInfo(
                name=m.group(1), start_line=line_no, end_line=line_no,
                base_classes=bases, is_exported="export" in m.group(0),
            ))
    return classes


def _fallback_imports(source: str, language: str) -> list[ImportInfo]:
    imports: list[ImportInfo] = []
    if language in ("python", "python-stub"):
        for m in re.finditer(r"^(?:from\s+(\S+)\s+)?import\s+(.+?)(?:\s+#.*)?$", source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            module = m.group(1) or m.group(2).split(",")[0].strip().split(".")[0]
            names = [n.strip().split(" as ")[0].strip() for n in m.group(2).split(",")]
            imports.append(ImportInfo(module=module, names=names, line=line_no))
    elif language in ("typescript", "typescript-react", "javascript", "javascript-react"):
        for m in re.finditer(r'''import\s+(?:(?:type\s+)?\{([^}]+)\}|(\w+)(?:\s*,\s*\{([^}]+)\})?)?\s*from\s*['"]([^'"]+)['"]''', source, re.MULTILINE):
            line_no = source[:m.start()].count("\n") + 1
            names = []
            if m.group(1):
                names.extend(n.strip() for n in m.group(1).split(","))
            if m.group(2):
                names.append(m.group(2))
            if m.group(3):
                names.extend(n.strip() for n in m.group(3).split(","))
            imports.append(ImportInfo(module=m.group(4), names=names, is_default=bool(m.group(2)), line=line_no))
        for m in re.finditer(r'''import\s+\*\s+as\s+(\w+)\s+from\s*['"]([^'"]+)['"]''', source, re.MULTILINE):
            imports.append(ImportInfo(module=m.group(2), names=[f"* as {m.group(1)}"], line=source[:m.start()].count("\n") + 1))
        for m in re.finditer(r'''import\s+['"]([^'"]+)['"]''', source, re.MULTILINE):
            imports.append(ImportInfo(module=m.group(1), line=source[:m.start()].count("\n") + 1))
    return imports


# ── Helpers ──────────────────────────────────────────────────────────────

def _count_nodes(node: Node) -> int:
    return 1 + sum(_count_nodes(c) for c in node.children)


def _collect_errors(node: Node, source: str) -> list[str]:
    errors = []
    if node.type == "ERROR":
        errors.append(f"Parse error at line {node.start_point[0] + 1}: {source[node.start_byte:node.end_byte][:100]}")
    for child in node.children:
        errors.extend(_collect_errors(child, source))
    return errors


def _find_ancestor(node: Node, types: set[str]) -> Node | None:
    current = node
    while current:
        if current.type in types:
            return current
        current = current.parent
    return None


def _extract_ts_import_names(node: Node, source: str) -> list[str]:
    text = source[node.start_byte:node.end_byte]
    names = []
    m = re.search(r"import\s+(?:type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]+)\})?", text)
    if m:
        if m.group(1) and m.group(1) not in ("type", "from"):
            names.append(m.group(1))
        if m.group(2):
            names.extend(n.strip().split(" as ")[0].strip() for n in m.group(2).split(","))
    return names


def _assign_calls(functions: list[FunctionInfo], source: str) -> None:
    call_pattern = re.compile(r"\b(\w+)\s*\(")
    keywords = {
        "if", "for", "while", "return", "print", "assert", "raise", "yield",
        "await", "with", "except", "try", "lambda", "def", "class", "import",
        "from", "not", "and", "or", "in", "is", "True", "False", "None",
        "typeof", "instanceof", "new", "delete", "void", "switch", "case",
        "break", "continue", "catch", "finally", "throw", "function", "const",
        "let", "var", "export", "default", "extends", "implements", "super",
        "this", "require", "then", "async", "static", "public", "private",
        "protected", "readonly", "abstract", "implements", "interface", "type",
        "enum", "namespace", "module", "declare", "as", "any", "unknown",
        "never", "object", "boolean", "number", "string", "symbol",
    }
    for func in functions:
        lines = source.split("\n")
        body = "\n".join(lines[func.start_line - 1:func.end_line])
        calls: set[str] = set()
        for m in call_pattern.finditer(body):
            name = m.group(1)
            if name not in keywords and not name[0].isdigit():
                calls.add(name)
        func.calls = sorted(calls)


def _count_comments(lines: list[str], language: str) -> int:
    count = 0
    in_block = False
    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        if language in ("python", "python-stub"):
            if stripped.startswith(("#", '"""', "'''")):
                count += 1
        else:
            if stripped.startswith(("//", "/*")) or stripped == "*":
                count += 1
            if "/*" in stripped:
                in_block = True
            if "*/" in stripped:
                in_block = False
                continue
            if in_block:
                count += 1
    return count


def _parse_params(params_str: str, language: str) -> list[str]:
    if not params_str:
        return []
    params_str = params_str.strip("()")
    if not params_str:
        return []
    param_names = []
    depth = 0
    current = ""
    for char in params_str:
        if char in "([{<":
            depth += 1
        elif char in ")]}>":
            depth -= 1
        elif char == "," and depth == 0:
            param_names.append(current.strip().split(":")[0].strip().split("=")[0].strip())
            current = ""
            continue
        current += char
    if current.strip():
        param_names.append(current.strip().split(":")[0].strip().split("=")[0].strip())
    return [p for p in param_names if p]


def _estimate_complexity(body: str, language: str) -> int:
    complexity = 1
    for pattern in [
        r"\bif\b", r"\belif\b", r"\belse\b", r"\bfor\b", r"\bwhile\b",
        r"\band\b", r"\bor\b", r"\bexcept\b", r"\bfinally\b",
        r"\bcase\b", r"\bcatch\b", r"\?\s*[^:]+:", r"&&", r"\|\|",
    ]:
        complexity += len(re.findall(pattern, body))
    return complexity


def _regex_parse(path: str, language: str, lines: list[str], source: str) -> ParsedFile:
    functions = _fallback_functions(source, language)
    classes = _fallback_classes(source, language)
    imports = _fallback_imports(source, language)
    _assign_calls(functions, source)
    return ParsedFile(
        path=path, language=language, lines=lines,
        functions=functions, classes=classes, imports=imports,
        exports=[], top_level_vars=[],
        total_lines=len(lines),
        comment_lines=_count_comments(lines, language),
        blank_lines=sum(1 for l in lines if not l.strip()),
        parse_errors=[f"No Tree-sitter grammar for {language}"],
    )
