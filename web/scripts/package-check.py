"""Preflight the exact tar produced by package.ts; never extract archive data."""
from html.parser import HTMLParser
from pathlib import PurePosixPath
import io
import posixpath
import re
import sys
import tarfile

SUFFIXES = set("html js wasm css svg png ico jpg jpeg gif webp avif woff woff2 "
               "ttf webmanifest json txt mp3 mp4 ogg webm wav".split())
LIMIT = 128 * 1024 * 1024


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


def create_page_check(name, files):
    page = HTMLParser(convert_charrefs=False)
    references = set()

    def check_tag(tag, attributes):
        attrs = dict(attributes)
        if any(key.startswith("on") for key in attrs):
            fail(name, "inline event attribute")
        if tag == "script" and not attrs.get("src"):
            fail(name, "inline script")
        if name == "index.html":
            if tag == "base":
                fail(name, "custom base URL")
            for key in ("href", "src"):
                if key in attrs:
                    target = local_name((attrs[key] or "").lstrip("/"), name)
                    if target not in files:
                        fail(name, f"missing packaged reference {target}")
                    references.add(target)
        elif tag == "script":
            # Static documents may have absolute canonical/alternate links, but
            # scripts still have to resolve to a file under script-src 'self'.
            src = attrs["src"]
            path = src.lstrip("/") if src.startswith("/") else posixpath.join(
                posixpath.dirname(name), src)
            target = local_name(posixpath.normpath(path), name)
            if target not in files:
                fail(name, f"missing packaged script {target}")

    page.handle_starttag = check_tag
    return page, references


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
        page, references = create_page_check(name, files)
        page.feed(html)
        page.close()
        if name == "index.html":
            if "<base" in html.lower():
                fail(name, "custom base URL")
            for suffix in (".js", ".wasm"):
                if not any(ref.endswith(suffix) for ref in references):
                    fail(name, f"missing {suffix} reference")
            for ref in references:
                if ref.endswith(".wasm") and not files[ref].startswith(b"\0asm\x01\0\0\0"):
                    fail(ref, "invalid WASM module")


if __name__ == "__main__":
    try:
        check(sys.stdin.buffer.read(LIMIT + 1))
    except (ValueError, tarfile.TarError) as error:
        sys.exit(str(error))
