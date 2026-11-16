use super::{WASM_MAGIC, check};
use std::{
    error::Error,
    fs,
    path::{Path, PathBuf},
    sync::atomic::{AtomicUsize, Ordering},
};
type Result<T = ()> = std::result::Result<T, Box<dyn Error>>;
static NEXT: AtomicUsize = AtomicUsize::new(0);

struct Fixture(PathBuf);
impl Fixture {
    fn new() -> Result<Self> {
        let parent = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../tmp/dist-check-tests");
        fs::create_dir_all(&parent)?;
        let root = parent.join(format!(
            "{}-{}",
            std::process::id(),
            NEXT.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir(&root)?;
        let f = Self(root);
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
                f.put(
                    &path,
                    format!("<link rel=\"canonical\" href=\"https://lkjstr.lkjsxc.com/{path}\">"),
                )?;
            }
        }
        for path in ["sitemap.txt", "robots.txt", "site.css", "icon-512.png"] {
            f.put(path, "asset")?;
        }
        f.put("index.html", "<link rel=\"stylesheet\" href=\"/site.css\"><script type=\"module\" src=\"/assets/app.js\"></script>")?;
        f.put("assets/app.js", "import('./adapter.js');")?;
        f.put("assets/adapter.js", "const url = name => new URL(name, import.meta.url); new SharedWorker(url('./shared.js')); new Worker(url('./worker.js'));")?;
        f.put(
            "assets/shared.js",
            "import init from './loader.js'; await init();",
        )?;
        f.put(
            "assets/worker.js",
            "import init from './loader.js'; await init();",
        )?;
        f.put(
            "assets/loader.js",
            "export default () => new URL('../engine.wasm', import.meta.url);",
        )?;
        f.put("engine.wasm", WASM_MAGIC)?;
        Ok(f)
    }
    fn put(&self, name: &str, bytes: impl AsRef<[u8]>) -> Result {
        let path = self.0.join("dist").join(name);
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(path, bytes)?;
        Ok(())
    }
    fn fails(&self, reason: &str) {
        let result = check(&self.0);
        assert!(
            matches!(result, Err(ref error) if error.contains(reason)),
            "{result:?}"
        );
    }
}
impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn follows_relative_app_worker_loader_graph() -> Result {
    let f = Fixture::new()?;
    assert_eq!(check(&f.0), Ok(()));
    Ok(())
}
#[test]
fn follows_root_relative_modules_and_wasm() -> Result {
    let f = Fixture::new()?;
    f.put("assets/app.js", "import('/assets/adapter.js');")?;
    f.put(
        "assets/loader.js",
        "export default () => new URL('/engine.wasm', import.meta.url);",
    )?;
    assert_eq!(check(&f.0), Ok(()));
    Ok(())
}
#[test]
fn ignores_orphan_files_comments_strings_and_regexes() -> Result {
    let f = Fixture::new()?;
    f.put(
        "assets/app.js",
        r#"const text = "import('/engine.wasm')";
        /* new URL('/engine.wasm', import.meta.url) */
        // import '/assets/loader.js';
        const pattern = /import('engine.wasm')/;"#,
    )?;
    f.fails("reachable");
    Ok(())
}
#[test]
fn checks_missing_transitive_worker_even_with_direct_wasm() -> Result {
    let f = Fixture::new()?;
    f.put(
        "index.html",
        "<link rel=\"preload\" href=\"/engine.wasm\"><script src=\"/assets/app.js\"></script>",
    )?;
    fs::remove_file(f.0.join("dist/assets/worker.js"))?;
    f.fails("assets/worker.js");
    Ok(())
}
#[test]
fn checks_missing_loader_and_wasm() -> Result {
    let f = Fixture::new()?;
    fs::remove_file(f.0.join("dist/assets/loader.js"))?;
    f.fails("assets/loader.js");
    f.put(
        "assets/loader.js",
        "new URL('/missing.wasm', import.meta.url);",
    )?;
    f.fails("missing.wasm");
    Ok(())
}
#[test]
fn rejects_corrupt_and_empty_reachable_assets() -> Result {
    let f = Fixture::new()?;
    f.put("engine.wasm", "not wasm")?;
    f.fails("WebAssembly");
    f.put("engine.wasm", WASM_MAGIC)?;
    f.put("assets/loader.js", "")?;
    f.fails("empty");
    Ok(())
}
#[test]
fn refuses_parent_and_encoded_path_escapes() -> Result {
    let f = Fixture::new()?;
    fs::write(f.0.join("outside.wasm"), WASM_MAGIC)?;
    for target in [
        "../../outside.wasm",
        "/../outside.wasm",
        "/%2e%2e/outside.wasm",
    ] {
        f.put(
            "assets/loader.js",
            format!("new URL('{target}', import.meta.url);"),
        )?;
        f.fails("path");
    }
    Ok(())
}
#[cfg(unix)]
#[test]
fn refuses_symlinks_outside_dist() -> Result {
    let f = Fixture::new()?;
    fs::write(f.0.join("outside.wasm"), WASM_MAGIC)?;
    fs::remove_file(f.0.join("dist/engine.wasm"))?;
    std::os::unix::fs::symlink(f.0.join("outside.wasm"), f.0.join("dist/engine.wasm"))?;
    f.fails("outside dist");
    Ok(())
}
#[test]
fn preserves_public_page_and_static_asset_checks() -> Result {
    let f = Fixture::new()?;
    f.put("ja/about.html", "missing canonical")?;
    f.fails("missing canonical");
    f.put(
        "ja/about.html",
        "<link rel=\"canonical\" href=\"https://lkjstr.lkjsxc.com/ja/about.html\">",
    )?;
    f.put("robots.txt", "")?;
    f.fails("robots.txt");
    Ok(())
}
#[test]
fn resolves_cycles_once_and_checks_all_edges() -> Result {
    let f = Fixture::new()?;
    f.put(
        "assets/worker.js",
        "import './adapter.js'; import init from './loader.js';",
    )?;
    assert_eq!(check(&f.0), Ok(()));
    f.put(
        "assets/worker.js",
        "import './adapter.js'; import '/missing.js';",
    )?;
    f.fails("missing.js");
    Ok(())
}

#[test]
fn checks_dependencies_after_numeric_division() -> Result {
    for number in ["1000", "1000.", "1.5", "1e+3", ".5", "0x400", "1_000", "1n"] {
        let f = Fixture::new()?;
        f.put(
            "assets/app.js",
            format!("new URL('/engine.wasm',import.meta.url); const rate={number}/performance.now(); import './missing.js';"),
        )?;
        f.fails("missing.js");
        f.put("assets/missing.js", "export {};")?;
        assert_eq!(check(&f.0), Ok(()));
    }
    Ok(())
}
