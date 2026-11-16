//! Check generated frontend dependencies from HTML through modules, Worker URLs
//! and the WASM loader, retaining the public-page and static-asset checks.
use std::{fs, path::Path};
#[path = "dist_graph.rs"]
mod graph;
#[path = "dist_refs.rs"]
mod refs;
const WASM_MAGIC: &[u8; 8] = b"\0asm\x01\0\0\0";

pub fn check(root: &Path) -> Result<(), String> {
    let dist = fs::canonicalize(root.join("dist"))
        .map_err(|error| format!("dist: {error} (run pnpm build first)"))?;
    let html = graph::text(&dist, Path::new("index.html"))?;
    for lang in ["en", "ja"] {
        for page in [
            "about",
            "features",
            "guide",
            "shortcuts",
            "faq",
            "nips",
            "changelog",
        ] {
            let path = format!("{lang}/{page}.html");
            let body = graph::text(&dist, Path::new(&path))?;
            let canonical = format!("https://lkjstr.lkjsxc.com/{path}");
            if !body.contains(&format!("rel=\"canonical\" href=\"{canonical}\"")) {
                return Err(format!("dist/{path}: missing canonical"));
            }
        }
    }
    for path in ["sitemap.txt", "robots.txt", "site.css", "icon-512.png"] {
        graph::read(&dist, Path::new(path))?;
    }
    graph::check(&dist, &html)
}

#[cfg(test)]
#[path = "dist_check_test.rs"]
mod tests;
