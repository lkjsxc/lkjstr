use super::{WASM_MAGIC, refs};
use std::{
    collections::{BTreeSet, VecDeque},
    fs,
    path::{Component, Path, PathBuf},
};

// Finite generated graphs; cycles and aliases cannot make this gate run forever.
const MAX_ASSETS: usize = 1024;

pub(super) fn read(dist: &Path, asset: &Path) -> Result<Vec<u8>, String> {
    let file = fs::canonicalize(dist.join(asset))
        .map_err(|error| format!("dist/{}: {error}", asset.display()))?;
    if !file.starts_with(dist) {
        return Err(format!("dist/{}: path outside dist", asset.display()));
    }
    let bytes = fs::read(file).map_err(|error| format!("dist/{}: {error}", asset.display()))?;
    if bytes.is_empty() {
        return Err(format!("dist/{}: empty", asset.display()));
    }
    Ok(bytes)
}
pub(super) fn text(dist: &Path, asset: &Path) -> Result<String, String> {
    String::from_utf8(read(dist, asset)?)
        .map_err(|error| format!("dist/{}: {error}", asset.display()))
}
fn resolve(from: &Path, reference: refs::Reference<'_>) -> Result<Option<PathBuf>, String> {
    let target = reference
        .target
        .split(['?', '#'])
        .next()
        .unwrap_or_default();
    if ![".js", ".css", ".wasm"]
        .iter()
        .any(|ext| target.ends_with(ext))
        || target.contains("://")
        || target.starts_with("//")
    {
        return Ok(None);
    }
    if target.contains(['\\', '%', ':', '\0']) {
        return Err(format!(
            "dist/{}: unsupported asset path {target}",
            from.display()
        ));
    }
    if reference.module && !target.starts_with(['/', '.']) {
        return Err(format!(
            "dist/{}: unsupported bare module path {target}",
            from.display()
        ));
    }
    let (mut asset, relative) = if let Some(rooted) = target.strip_prefix('/') {
        (PathBuf::new(), rooted)
    } else {
        (from.parent().unwrap_or(Path::new("")).to_path_buf(), target)
    };
    for part in Path::new(relative).components() {
        match part {
            Component::Normal(name) => asset.push(name),
            Component::CurDir => {}
            Component::ParentDir if asset.pop() => {}
            _ => {
                return Err(format!(
                    "dist/{}: asset path outside dist: {target}",
                    from.display()
                ));
            }
        }
    }
    Ok(Some(asset))
}
pub(super) fn check(dist: &Path, html: &str) -> Result<(), String> {
    let mut pending = VecDeque::new();
    let mut seen = BTreeSet::new();
    let mut add =
        |from: &Path, references: Vec<refs::Reference<'_>>, pending: &mut VecDeque<PathBuf>| {
            for reference in references {
                if let Some(path) = resolve(from, reference)?
                    && seen.insert(path.clone())
                {
                    if seen.len() > MAX_ASSETS {
                        return Err("dist: reachable asset limit exceeded".to_owned());
                    }
                    pending.push_back(path);
                }
            }
            Ok::<(), String>(())
        };
    add(Path::new("index.html"), refs::html(html), &mut pending)?;
    let (mut js, mut wasm) = (false, false);
    while let Some(asset) = pending.pop_front() {
        let bytes = read(dist, &asset)?;
        match asset.extension().and_then(|ext| ext.to_str()) {
            Some("js") => {
                js = true;
                let script = std::str::from_utf8(&bytes)
                    .map_err(|error| format!("dist/{}: {error}", asset.display()))?;
                add(&asset, refs::scripts(script), &mut pending)?;
            }
            Some("wasm") => {
                if !bytes.starts_with(WASM_MAGIC) {
                    return Err(format!(
                        "dist/{}: not a WebAssembly module",
                        asset.display()
                    ));
                }
                wasm = true;
            }
            _ => {}
        }
    }
    if !js || !wasm {
        return Err("dist/index.html has no reachable app .js and .wasm graph".to_owned());
    }
    Ok(())
}
