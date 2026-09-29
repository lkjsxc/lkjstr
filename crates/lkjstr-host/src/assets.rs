use serde::Deserialize;
use sha2::{Digest, Sha256};
use std::{
    fs,
    io::{self, Read},
    path::{Component, Path, PathBuf},
};

const ASSETS: &str = "lkjstr-web-wasm";
const MAX_ASSET: u64 = 64 * 1024 * 1024;

#[derive(Deserialize)]
struct Asset {
    name: String,
    bytes: u64,
    sha256: String,
}

#[derive(Deserialize)]
struct Manifest {
    script: Asset,
    wasm: Asset,
    imports: Vec<Asset>,
}

fn invalid(message: &str) -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, message)
}

/// Validate a deployment-only tree that must remain immutable while serving.
pub fn validate_root(root: &Path) -> io::Result<PathBuf> {
    if !fs::symlink_metadata(root)?.is_dir() {
        return Err(invalid("asset root must be a real directory"));
    }
    let root = root.canonicalize()?;
    validate_tree(&root)?;
    for name in ["index.html", "sqlite/sqlite3.wasm"] {
        let meta = fs::metadata(root.join(name))?;
        if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_ASSET {
            return Err(invalid("required entry or SQLite asset is invalid"));
        }
    }
    let dir = root.join(ASSETS);
    let manifest_file = fs::File::open(dir.join("asset-manifest.json"))?;
    if manifest_file.metadata()?.len() > 1024 * 1024 {
        return Err(invalid("WASM manifest exceeds 1 MiB"));
    }
    let manifest: Manifest =
        serde_json::from_reader(manifest_file).map_err(|_| invalid("invalid WASM manifest"))?;
    if manifest.imports.len() > 1024 {
        return Err(invalid("too many WASM bridge imports"));
    }
    for asset in [&manifest.script, &manifest.wasm]
        .into_iter()
        .chain(&manifest.imports)
    {
        validate_asset(&dir, asset)?;
    }
    validate_wasm(&dir.join(&manifest.wasm.name))?;
    validate_wasm(&root.join("sqlite/sqlite3.wasm"))?;
    Ok(root)
}

fn validate_tree(root: &Path) -> io::Result<()> {
    let mut pending = vec![(root.to_path_buf(), 0)];
    let mut entries = 0;
    while let Some((directory, depth)) = pending.pop() {
        if depth > 32 {
            return Err(invalid("asset tree is too deep"));
        }
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            entries += 1;
            if entries > 100_000 {
                return Err(invalid("asset tree has too many entries"));
            }
            let kind = entry.file_type()?;
            if kind.is_dir() {
                pending.push((entry.path(), depth + 1));
            } else if !kind.is_file() {
                return Err(invalid("asset tree contains a symlink or special file"));
            }
        }
    }
    Ok(())
}

fn validate_asset(dir: &Path, asset: &Asset) -> io::Result<()> {
    let path = Path::new(&asset.name);
    if asset.name.is_empty()
        || asset.name.contains('\\')
        || asset
            .name
            .split('/')
            .any(|part| part.is_empty() || part.starts_with('.'))
        || path
            .components()
            .any(|part| !matches!(part, Component::Normal(_)))
    {
        return Err(invalid("WASM manifest has an unsafe asset name"));
    }
    let mut file = fs::File::open(dir.join(path))?;
    if asset.bytes == 0 || asset.bytes > MAX_ASSET || file.metadata()?.len() != asset.bytes {
        return Err(invalid("WASM asset size does not match manifest"));
    }
    let mut digest = Sha256::new();
    let mut buffer = [0_u8; 65536];
    loop {
        let count = file.read(&mut buffer)?;
        if count == 0 {
            break;
        }
        digest.update(&buffer[..count]);
    }
    if format!("{:x}", digest.finalize()) != asset.sha256 {
        return Err(invalid("WASM asset digest does not match manifest"));
    }
    Ok(())
}

fn validate_wasm(path: &Path) -> io::Result<()> {
    let mut magic = [0_u8; 8];
    fs::File::open(path)?.read_exact(&mut magic)?;
    if magic != *b"\0asm\x01\0\0\0" {
        return Err(invalid("invalid WASM header"));
    }
    Ok(())
}
