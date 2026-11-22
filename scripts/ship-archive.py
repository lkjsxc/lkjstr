"""Extract plain package members and inventory every path the smoke can serve."""

import hashlib
import json
from pathlib import Path
import re
import stat
import sys
import tarfile


SAFE_PART = re.compile(r"[A-Za-z0-9_-][A-Za-z0-9_.-]*")


def file_digest(source, target=None):
    digest = hashlib.sha256()
    while data := source.read(128 * 1024):
        digest.update(data)
        if target is not None:
            target.write(data)
    return digest.hexdigest()


def extract(package, root):
    root.mkdir()
    manifest = {}
    with tarfile.open(package, "r:gz") as archive:
        for member in archive:
            name = member.name.removeprefix("./")
            if name == "." and member.isdir() and member.size == 0 and not manifest:
                manifest[name] = None
                continue
            if any(not SAFE_PART.fullmatch(part) for part in name.split("/")):
                raise ValueError(f"unsafe archive member: {member.name!r}")
            if name in manifest or manifest.get(str(Path(name).parent), False) is not None:
                raise ValueError(f"duplicate member or missing parent directory: {name}")
            path = root / name
            if member.isdir() and member.size == 0:
                path.mkdir()
                manifest[name] = None
            elif member.type in (tarfile.REGTYPE, tarfile.AREGTYPE) and member.sparse is None:
                with archive.extractfile(member) as source, path.open("xb") as target:
                    manifest[name] = file_digest(source, target)
                path.chmod(0o444)
            else:
                raise ValueError(f"unsupported archive member type: {name}")
    if not isinstance(manifest.get("index.html"), str):
        raise ValueError("missing regular archive root page")
    return manifest


def inventory(root):
    manifest = {}

    def visit(path):
        name = path.relative_to(root).as_posix()
        info = path.lstat()
        if stat.S_ISDIR(info.st_mode):
            manifest[name] = None
            for child in path.iterdir():
                visit(child)
        elif stat.S_ISREG(info.st_mode) and info.st_nlink == 1:
            with path.open("rb") as source:
                manifest[name] = file_digest(source)
        else:
            raise ValueError(f"unsupported served path type: {name}")

    visit(root)
    return manifest


def main(args):
    if len(args) == 3 and args[0] == "extract":
        manifest = extract(Path(args[1]), Path(args[2]))
    elif len(args) == 2 and args[0] == "inventory":
        manifest = inventory(Path(args[1]))
    else:
        raise ValueError("expected extract ARCHIVE DIR or inventory DIR")
    print(json.dumps(manifest, sort_keys=True, indent=2))


if __name__ == "__main__":
    try:
        main(sys.argv[1:])
    except (OSError, ValueError, EOFError, tarfile.TarError) as error:
        sys.exit(str(error))
