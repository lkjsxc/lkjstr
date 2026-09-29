use serde_json::{Value, json};
use sha2::{Digest, Sha256};
use std::{error::Error, fs, path::Path};
use tempfile::TempDir;

pub type Result<T = ()> = std::result::Result<T, Box<dyn Error>>;
pub const WASM: &[u8] = b"\0asm\x01\0\0\0";

// Only deterministic test fixtures; never copied into a production image.
pub fn fixture() -> Result<TempDir> {
    let root = tempfile::tempdir()?;
    write(
        root.path(),
        "index.html",
        b"<!doctype html><title>host fixture</title>",
    )?;
    write(root.path(), "sqlite/sqlite3.wasm", WASM)?;
    write(
        root.path(),
        "lkjstr-web-wasm/bridge.js",
        b"export default async function __wbg_init() {}",
    )?;
    write(root.path(), "lkjstr-web-wasm/bridge.wasm", WASM)?;
    write(
        root.path(),
        "lkjstr-web-wasm/snippets/inline0.js",
        b"export const ready = true;",
    )?;
    write(root.path(), ".private", b"not public")?;
    write(root.path(), "_headers", b"not public")?;
    write(root.path(), "_redirects", b"not public")?;
    let dir = root.path().join("lkjstr-web-wasm");
    let manifest = json!({
        "script": evidence(&dir, "bridge.js")?,
        "wasm": evidence(&dir, "bridge.wasm")?,
        "imports": [evidence(&dir, "snippets/inline0.js")?]
    });
    fs::write(
        dir.join("asset-manifest.json"),
        serde_json::to_vec(&manifest)?,
    )?;
    Ok(root)
}

pub fn write(root: &Path, name: &str, bytes: &[u8]) -> Result {
    let path = root.join(name);
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, bytes)?;
    Ok(())
}

pub fn evidence(dir: &Path, name: &str) -> Result<Value> {
    let bytes = fs::read(dir.join(name))?;
    Ok(
        json!({ "name": name, "bytes": bytes.len(), "sha256": format!("{:x}", Sha256::digest(&bytes)) }),
    )
}
