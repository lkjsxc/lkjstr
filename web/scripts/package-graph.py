"""Bounded generated-asset graph; mirrors xtask dist_refs/dist_graph forms."""
from collections import deque
import posixpath

MAX_ASSETS = 1024
WASM_MAGIC = b"\0asm\x01\0\0\0"
WORDS = {"URL", "url", "Worker", "SharedWorker", "fetch", "init", "importScripts"}


def tokens(text):
    """Yield literal tokens, never dependencies hidden in comments or text."""
    at, regexp = 0, True
    while at < len(text):
        char = text[at]
        if char in " \t\n\r\v\f":
            at += 1
            continue
        if text.startswith("//", at):
            end = text.find("\n", at + 2)
            at = len(text) if end < 0 else end + 1
            continue
        if text.startswith("/*", at):
            end = text.find("*/", at + 2)
            at = len(text) if end < 0 else end + 2
            continue
        token = ("other", "")
        if char in "\"'`":
            start = at = at + 1
            while at < len(text):
                if text[at] == "\\":
                    at = min(at + 2, len(text))
                elif text[at] == char:
                    if char != "`":
                        token = ("string", text[start:at])
                    at += 1
                    break
                else:
                    at += 1
        elif char == "/" and regexp:
            at += 1
            inside_class = False
            while at < len(text):
                char = text[at]
                at += 1
                if char == "\\":
                    at = min(at + 1, len(text))
                elif char == "[":
                    inside_class = True
                elif char == "]":
                    inside_class = False
                elif char == "/" and not inside_class:
                    break
            while at < len(text) and text[at].isascii() and text[at].isalpha():
                at += 1
        elif char.isascii() and (char.isalpha() or char in "_$"):
            start = at
            while at < len(text) and text[at].isascii() and (
                text[at].isalnum() or text[at] in "_$"
            ):
                at += 1
            token = ("word", text[start:at])
        else:
            token = ("punct", char)
            at += 1
        kind, value = token
        if kind == "word":
            regexp = value in ("return", "throw", "case", "yield", "await")
        elif kind == "punct":
            regexp = value not in ")]}"
        else:
            regexp = False
        yield token


def scripts(text):
    before = previous = ("other", "")
    for token in tokens(text):
        if token[0] == "string":
            module = previous in (("word", "from"), ("word", "import")) or (
                before == ("word", "import") and previous == ("punct", "(")
            )
            url = before[0] == "word" and before[1] in WORDS and previous == ("punct", "(")
            if module or url:
                yield token[1], module
        before, previous = previous, token


def resolve(source, target, module, fail, local_name):
    target = target.split("?", 1)[0].split("#", 1)[0]
    if not target.endswith((".js", ".css", ".wasm")) or "://" in target or target.startswith("//"):
        return None
    if any(char in target for char in ("\\", "%", ":", "\0")):
        fail(source, "unsupported asset path")
    if module and not target.startswith(("/", ".")):
        fail(source, "unsupported bare module path")
    parts = [] if target.startswith("/") else posixpath.dirname(source).split("/")
    parts = [part for part in parts if part]
    for part in target.removeprefix("/").split("/"):
        if part in ("", "."):
            continue
        if part == "..":
            if not parts:
                fail(source, "asset path outside archive root")
            parts.pop()
        else:
            parts.append(part)
    return local_name("/".join(parts), source)


def check_graph(files, references, fail, local_name):
    pending, seen = deque(), set()

    def add(source, refs):
        for target, module in refs:
            name = resolve(source, target, module, fail, local_name)
            if name is None or name in seen:
                continue
            seen.add(name)
            if len(seen) > MAX_ASSETS:
                fail("index.html", "reachable asset limit exceeded")
            pending.append(name)

    add("index.html", ((name, False) for name in references))
    js = wasm = False
    while pending:
        name = pending.popleft()
        if name not in files:
            fail(name, "missing packaged reference")
        data = files[name]
        if name.endswith(".js"):
            js = True
            try:
                script = data.decode("utf-8")
            except UnicodeDecodeError:
                fail(name, "JavaScript must be UTF-8")
            add(name, scripts(script))
        elif name.endswith(".wasm"):
            if not data.startswith(WASM_MAGIC):
                fail(name, "invalid WASM module")
            wasm = True
    if not js or not wasm:
        fail("index.html", "no reachable app .js and .wasm graph")
