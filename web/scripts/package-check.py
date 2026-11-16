"""Preflight the exact tar produced by package.ts; never extract archive data."""
from html.parser import HTMLParser
from pathlib import Path, PurePosixPath
import io
import posixpath
import re
import runpy
import sys
import tarfile

SUFFIXES = set("html js wasm css svg png ico jpg jpeg gif webp avif woff woff2 "
               "ttf webmanifest json txt mp3 mp4 ogg webm wav".split())
LIMIT = 128 * 1024 * 1024
CHECK_GRAPH = runpy.run_path(str(Path(__file__).with_name("package-graph.py")))["check_graph"]


def fail(name, reason):
    raise ValueError(f"{name}: {reason}")


def local_name(name, source):
    path = PurePosixPath(name)
    if path.is_absolute() or not path.parts or any(
        re.fullmatch(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*", part) is None
        for part in path.parts
    ):
        fail(source, "unsafe local path")
    return str(path)


def local_url_path(url, source):
    # A network-path reference changes the origin, even without a scheme.
    if url.startswith("//"):
        fail(source, "unsafe local path")
    return url.removeprefix("/")


def create_page_check(name, files):
    page = HTMLParser(convert_charrefs=False)
    references = set()
    graph_references = set()

    def check_tag(tag, attributes):
        attrs = dict(attributes)
        if any(key.startswith("on") for key in attrs):
            fail(name, "inline event attribute")
        if tag == "script" and not attrs.get("src"):
            fail(name, "inline script")
        if tag == "base":
            fail(name, "custom base URL")
        if name == "index.html":
            for key in ("href", "src"):
                if key in attrs:
                    target = local_name(local_url_path(attrs[key] or "", name), name)
                    if target not in files:
                        fail(name, f"missing packaged reference {target}")
                    references.add(target)
                    if tag in ("script", "link"):
                        graph_references.add(target)
        elif tag == "script":
            # Static documents may have absolute canonical/alternate links, but
            # scripts still have to resolve to a file under script-src 'self'.
            src = attrs["src"]
            path = local_url_path(src, name)
            if not src.startswith("/"):
                path = posixpath.join(posixpath.dirname(name), path)
            target = local_name(posixpath.normpath(path), name)
            if target not in files:
                fail(name, f"missing packaged script {target}")

    page.handle_starttag = check_tag
    return page, references, graph_references


def check(raw):
    if len(raw) > LIMIT:
        fail("dist/", "archive exceeds 128 MiB")
    files = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:") as archive:
        for count, entry in enumerate(archive, 1):
            if count > 4096:
                fail(entry.name, "archive exceeds 4096 entries")
            if entry.name in (".", "./") and entry.isdir():
                continue
            name = local_name(entry.name, entry.name)
            if entry.isdir():
                continue
            if not entry.isfile():
                fail(name, "only regular files and directories are allowed")
            if name in files or entry.size == 0:
                fail(name, "duplicate or empty file")
            if PurePosixPath(name).suffix.lower().removeprefix(".") not in SUFFIXES:
                fail(name, "unsupported file suffix")
            files[name] = archive.extractfile(entry).read()
    if "index.html" not in files:
        fail("index.html", "missing archive root page")
    for name, data in files.items():
        if not name.lower().endswith(".html"):
            continue
        try:
            html = data.decode("utf-8")
        except UnicodeDecodeError:
            fail(name, "HTML must be UTF-8")
        page, references, graph_references = create_page_check(name, files)
        page.feed(html)
        page.close()
        if name == "index.html":
            if "<base" in html.lower():
                fail(name, "custom base URL")
            for ref in references:
                if ref.endswith(".wasm") and not files[ref].startswith(b"\0asm\x01\0\0\0"):
                    fail(ref, "invalid WASM module")
            CHECK_GRAPH(files, graph_references, fail, local_name)


if __name__ == "__main__":
    try:
        check(sys.stdin.buffer.read(LIMIT + 1))
    except (ValueError, tarfile.TarError) as error:
        sys.exit(str(error))
