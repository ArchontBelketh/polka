#!/usr/bin/env python3
"""
X-Ray: статический анализ Python-кода по синтаксическому дереву (ast).
Показывает ФАКТЫ, что делает код: интернет, файлы, команды, секреты, зависимости
и подозрительное. Код НИКОГДА не исполняется. Вывод — JSON в stdout.

Запуск: python3 xray_analyze.py <каталог>
"""
import ast
import io
import json
import os
import re
import sys

MAX_FILES = 500
MAX_FILE_BYTES = 2 * 1024 * 1024  # отдельный .py крупнее — пропускаем из анализа AST

# ── Наборы для распознавания вызовов ─────────────────────────────────────────
INTERNET_ROOTS = {
    "requests", "httpx", "aiohttp", "urllib", "urllib3", "http",
    "socket", "websocket", "websockets", "ftplib", "smtplib",
}
INTERNET_NAMES = {"urlopen", "urlretrieve"}

FILE_ATTRS = {"write_text", "write_bytes", "unlink"}
FILE_DOTTED = {"os.remove", "os.rename", "shutil.rmtree", "shutil.move"}

CMD_ROOTS = {"subprocess"}
CMD_DOTTED = {"os.system", "os.popen", "pty.spawn", "pickle.loads", "marshal.loads"}
CMD_NAMES = {"eval", "exec", "compile"}

DECODE_MARKERS = ("b64decode", "fromhex", "decompress", "a85decode", "b32decode")

SECRET_NAME_RE = re.compile(
    r"(token|secret|password|passwd|pwd|api[_-]?key|apikey|access[_-]?key|private[_-]?key)",
    re.IGNORECASE,
)
TELEGRAM_TOKEN_RE = re.compile(r"\b\d{8,10}:[A-Za-z0-9_-]{35}\b")
AWS_KEY_RE = re.compile(r"\bAKIA[0-9A-Z]{16}\b")

URL_RE = re.compile(r"https?://[^\s'\"<>)]+", re.IGNORECASE)
BARE_IP_RE = re.compile(r"\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b")
B64_LONG_RE = re.compile(r"[A-Za-z0-9+/=]{1000,}")
HEX_LONG_RE = re.compile(r"[0-9a-fA-F]{1000,}")

PASTEBIN_HOSTS = ("pastebin.com", "hastebin.com", "ghostbin", "paste.ee", "dpaste", "rentry.co")
SHORTENER_HOSTS = ("bit.ly", "goo.gl", "tinyurl.com", "t.co", "is.gd", "cutt.ly", "ow.ly", "clck.ru")
TUNNEL_HOSTS = ("ngrok.io", "ngrok-free.app", "localtunnel", "serveo.net", "trycloudflare.com")
DYNDNS_HOSTS = ("no-ip.", "noip.com", "duckdns.org", "dynu.com", "ddns.net", "hopto.org")


def dotted_name(node):
    """Собрать dotted-путь вызова: requests.get, os.system, open, eval."""
    parts = []
    while isinstance(node, ast.Attribute):
        parts.append(node.attr)
        node = node.value
    if isinstance(node, ast.Name):
        parts.append(node.id)
    parts.reverse()
    return ".".join(parts)


def mask_secret(value):
    v = value.strip()
    if len(v) <= 8:
        return v[0] + "***" if v else "***"
    return v[:4] + "…" + v[-4:]


def iter_py_files(root):
    found = []
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            if name.lower().endswith(".py"):
                found.append(os.path.join(dirpath, name))
            if len(found) >= MAX_FILES:
                return found
    return found


class Analyzer(ast.NodeVisitor):
    def __init__(self, relpath):
        self.rel = relpath
        self.internet = []
        self.files = []
        self.commands = []
        self.secrets = []
        self.suspicious = []
        self.string_consts = []  # (line, value)

    def add(self, bucket, line, kind, detail):
        bucket.append({"file": self.rel, "line": line, "kind": kind, "detail": detail})

    # ── Вызовы ───────────────────────────────────────────────────────────────
    def visit_Call(self, node):
        name = dotted_name(node.func)
        root = name.split(".")[0] if name else ""
        last = name.split(".")[-1] if name else ""
        line = getattr(node, "lineno", 0)

        if root in INTERNET_ROOTS or last in INTERNET_NAMES:
            self.add(self.internet, line, root or last, name + "()")

        if name in FILE_DOTTED or last in FILE_ATTRS:
            self.add(self.files, line, "fs", name + "()")
        if last == "open":
            if self._open_is_write(node):
                self.add(self.files, line, "open_write", "open(..., запись)")

        if root in CMD_ROOTS or name in CMD_DOTTED or last in CMD_NAMES or name.startswith("os.exec"):
            self.add(self.commands, line, root or last, name + "()")
        if last == "__import__" and node.args and not isinstance(node.args[0], ast.Constant):
            self.add(self.commands, line, "dynamic_import", "__import__(вычисляемое имя)")

        # Подозрительное: exec/eval/compile с декодированием внутри аргументов
        if last in CMD_NAMES:
            if self._contains_decode(node):
                self.add(self.suspicious, line, "exec_decoded",
                         last + "() с раскодированием (base64/hex/zlib)")

        self.generic_visit(node)

    def _open_is_write(self, node):
        mode = None
        if len(node.args) >= 2 and isinstance(node.args[1], ast.Constant):
            mode = node.args[1].value
        for kw in node.keywords:
            if kw.arg == "mode" and isinstance(kw.value, ast.Constant):
                mode = kw.value.value
        if isinstance(mode, str):
            return any(c in mode for c in ("w", "a", "x", "+"))
        return False

    def _contains_decode(self, node):
        for sub in ast.walk(node):
            if isinstance(sub, ast.Call):
                nm = dotted_name(sub.func)
                if any(m in nm for m in DECODE_MARKERS):
                    return True
        return False

    # ── Присваивания: секреты по имени переменной ────────────────────────────
    def visit_Assign(self, node):
        if isinstance(node.value, ast.Constant) and isinstance(node.value.value, str):
            val = node.value.value
            if val.strip():
                for tgt in node.targets:
                    for nm in self._target_names(tgt):
                        if SECRET_NAME_RE.search(nm):
                            self.add(self.secrets, getattr(node, "lineno", 0),
                                     "assigned_secret", nm + " = " + mask_secret(val))
                            break
        self.generic_visit(node)

    def _target_names(self, tgt):
        if isinstance(tgt, ast.Name):
            return [tgt.id]
        if isinstance(tgt, ast.Attribute):
            return [tgt.attr]
        if isinstance(tgt, (ast.Tuple, ast.List)):
            out = []
            for el in tgt.elts:
                out += self._target_names(el)
            return out
        return []

    # ── Строковые литералы: токены, адреса, длинные base64/hex ───────────────
    def visit_Constant(self, node):
        if isinstance(node.value, str):
            self.string_consts.append((getattr(node, "lineno", 0), node.value))
        self.generic_visit(node)


def classify_host(host):
    h = host.lower()
    for group, hosts in (
        ("pastebin", PASTEBIN_HOSTS), ("shortener", SHORTENER_HOSTS),
        ("tunnel", TUNNEL_HOSTS), ("dyndns", DYNDNS_HOSTS),
    ):
        if any(x in h for x in hosts):
            return group
    return None


def analyze_file(path, rel, out):
    try:
        with io.open(path, "r", encoding="utf-8") as f:
            src = f.read()
    except (UnicodeDecodeError, OSError):
        out["files_skipped"].append(rel)
        return
    if len(src.encode("utf-8", "ignore")) > MAX_FILE_BYTES:
        out["files_skipped"].append(rel)
        return
    try:
        tree = ast.parse(src, filename=rel)
    except SyntaxError as e:
        out["parse_errors"].append({"file": rel, "line": e.lineno or 0, "detail": str(e.msg)})
        return

    a = Analyzer(rel)
    a.visit(tree)
    out["facts"]["internet"] += a.internet
    out["facts"]["files"] += a.files
    out["facts"]["commands"] += a.commands
    out["facts"]["secrets"] += a.secrets
    out["facts"]["suspicious"] += a.suspicious
    out["files_analyzed"] += 1

    # Строковые литералы → токены, адреса, длинные закодированные строки
    for line, val in a.string_consts:
        for m in TELEGRAM_TOKEN_RE.findall(val):
            out["facts"]["secrets"].append(
                {"file": rel, "line": line, "kind": "telegram_token", "detail": mask_secret(m)})
        for m in AWS_KEY_RE.findall(val):
            out["facts"]["secrets"].append(
                {"file": rel, "line": line, "kind": "aws_key", "detail": mask_secret(m)})
        if len(val) >= 1000 and (B64_LONG_RE.search(val) or HEX_LONG_RE.search(val)):
            out["facts"]["suspicious"].append(
                {"file": rel, "line": line, "kind": "long_encoded",
                 "detail": "строковый литерал " + str(len(val)) + " символов (base64/hex)"})
        for url in URL_RE.findall(val):
            host = re.sub(r"^https?://", "", url).split("/")[0].split(":")[0]
            out["addresses"]["urls"].append(host)
            grp = classify_host(host)
            if grp:
                out["addresses"]["flags"].append({"value": host, "kind": grp, "file": rel, "line": line})
        for ip in BARE_IP_RE.findall(val):
            if ip.startswith(("0.", "127.", "255.")):
                continue
            out["addresses"]["ips"].append(ip)
            out["addresses"]["flags"].append({"value": ip, "kind": "bare_ip", "file": rel, "line": line})


# ── Зависимости ──────────────────────────────────────────────────────────────
def parse_requirements(text):
    pkgs = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or line.startswith("-"):
            continue
        line = line.split("#")[0].strip()
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(==|>=|<=|~=|!=|<|>)?\s*([A-Za-z0-9_.\-*]+)?", line)
        if m and m.group(1):
            pkgs.append({"name": m.group(1).lower(), "version": m.group(3) if m.group(2) == "==" else None})
    return pkgs


def parse_pyproject(text):
    pkgs = []
    try:
        import tomllib
        data = tomllib.loads(text)
    except Exception:
        return pkgs
    for dep in (data.get("project", {}) or {}).get("dependencies", []) or []:
        m = re.match(r"^([A-Za-z0-9_.\-]+)\s*(==)?\s*([A-Za-z0-9_.\-]+)?", dep)
        if m and m.group(1):
            pkgs.append({"name": m.group(1).lower(), "version": m.group(3) if m.group(2) else None})
    poetry = (((data.get("tool", {}) or {}).get("poetry", {}) or {}).get("dependencies", {}) or {})
    for name, spec in poetry.items():
        if name.lower() == "python":
            continue
        ver = None
        if isinstance(spec, str):
            ver = spec.lstrip("^~=").strip() or None
        pkgs.append({"name": name.lower(), "version": ver})
    return pkgs


def parse_pipfile_lock(text):
    pkgs = []
    try:
        data = json.loads(text)
    except Exception:
        return pkgs
    for section in ("default", "develop"):
        for name, info in (data.get(section, {}) or {}).items():
            ver = None
            if isinstance(info, dict) and isinstance(info.get("version"), str):
                ver = info["version"].lstrip("=").strip() or None
            pkgs.append({"name": name.lower(), "version": ver})
    return pkgs


def collect_dependencies(root, out):
    seen = {}
    for dirpath, _dirs, files in os.walk(root):
        for name in files:
            low = name.lower()
            full = os.path.join(dirpath, name)
            try:
                text = io.open(full, "r", encoding="utf-8").read()
            except (OSError, UnicodeDecodeError):
                continue
            found = []
            if low == "requirements.txt":
                found = parse_requirements(text)
            elif low == "pyproject.toml":
                found = parse_pyproject(text)
            elif low == "pipfile.lock":
                found = parse_pipfile_lock(text)
            for p in found:
                if p["name"] and p["name"] not in seen:
                    seen[p["name"]] = p
    out["dependencies"]["packages"] = list(seen.values())


def main():
    root = sys.argv[1] if len(sys.argv) > 1 else "."
    out = {
        "language": "python",
        "files_analyzed": 0,
        "files_skipped": [],
        "parse_errors": [],
        "facts": {"internet": [], "files": [], "commands": [], "secrets": [], "suspicious": []},
        "addresses": {"urls": [], "ips": [], "flags": []},
        "dependencies": {"ecosystem": "PyPI", "packages": []},
    }

    py_files = iter_py_files(root)
    for path in py_files:
        rel = os.path.relpath(path, root).replace(os.sep, "/")
        analyze_file(path, rel, out)

    collect_dependencies(root, out)

    # Дедуп адресов
    out["addresses"]["urls"] = sorted(set(out["addresses"]["urls"]))
    out["addresses"]["ips"] = sorted(set(out["addresses"]["ips"]))

    json.dump(out, sys.stdout, ensure_ascii=False)


if __name__ == "__main__":
    main()
