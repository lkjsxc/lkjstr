//! `check-dist`: the Trunk output is complete and loadable without a browser:
//! every script, stylesheet and WASM module that `index.html` names exists,
//! and the WASM modules carry the WebAssembly header.

use std::{fs, path::Path};

const WASM_MAGIC: &[u8; 8] = b"\0asm\x01\0\0\0";

fn referenced(html: &str) -> Vec<String> {
    let mut out = Vec::new();
    for attr in ["href=\"", "src=\"", "from '", "init('"] {
        for part in html.split(attr).skip(1) {
            let end = part.find(['"', '\'']).unwrap_or(part.len());
            let target = part[..end].trim_start_matches('/').to_owned();
            let local = !target.contains("://") && !target.is_empty();
            let asset = [".js", ".wasm", ".css"]
                .iter()
                .any(|ext| target.ends_with(ext));
            if local && asset && !out.contains(&target) {
                out.push(target);
            }
        }
    }
    out
}

pub fn check(root: &Path) -> Result<(), String> {
    let dist = root.join("dist");
    let html = fs::read_to_string(dist.join("index.html"))
        .map_err(|error| format!("dist/index.html: {error} (run trunk build first)"))?;
    let assets = referenced(&html);
    if !assets.iter().any(|a| a.ends_with(".wasm")) || !assets.iter().any(|a| a.ends_with(".js")) {
        return Err("dist/index.html does not reference the app's .js and .wasm".to_owned());
    }
    for asset in &assets {
        let bytes = fs::read(dist.join(asset)).map_err(|error| format!("dist/{asset}: {error}"))?;
        if asset.ends_with(".wasm") && !bytes.starts_with(WASM_MAGIC) {
            return Err(format!("dist/{asset}: not a WebAssembly module"));
        }
        if bytes.is_empty() {
            return Err(format!("dist/{asset}: empty"));
        }
    }
    println!("ok check-dist");
    Ok(())
}
