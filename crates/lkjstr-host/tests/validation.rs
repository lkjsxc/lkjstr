mod support;
use serde_json::json;
use std::fs;
use support::{Result, fixture, write};

fn change_manifest(root: &std::path::Path, change: impl FnOnce(&mut serde_json::Value)) -> Result {
    let path = root.join("lkjstr-web-wasm/asset-manifest.json");
    let mut value: serde_json::Value = serde_json::from_slice(&fs::read(&path)?)?;
    change(&mut value);
    fs::write(path, serde_json::to_vec(&value)?)?;
    Ok(())
}

#[test]
fn accepts_valid_immutable_assets() -> Result {
    let root = fixture()?;
    assert_eq!(
        lkjstr_host::validate_root(root.path())?,
        root.path().canonicalize()?
    );
    Ok(())
}

#[test]
fn rejects_missing_required_files() -> Result {
    for name in [
        "index.html",
        "sqlite/sqlite3.wasm",
        "lkjstr-web-wasm/asset-manifest.json",
        "lkjstr-web-wasm/bridge.js",
        "lkjstr-web-wasm/bridge.wasm",
        "lkjstr-web-wasm/snippets/inline0.js",
    ] {
        let root = fixture()?;
        fs::remove_file(root.path().join(name))?;
        assert!(lkjstr_host::validate_root(root.path()).is_err(), "{name}");
    }
    Ok(())
}

#[test]
fn rejects_corrupt_size_or_digest_and_empty_entry() -> Result {
    for bytes in [b"".as_slice(), b"\0asm\x02\0\0\0", b"garbage"] {
        let root = fixture()?;
        write(root.path(), "lkjstr-web-wasm/bridge.wasm", bytes)?;
        assert!(lkjstr_host::validate_root(root.path()).is_err());
    }
    let root = fixture()?;
    write(root.path(), "index.html", b"")?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    Ok(())
}

#[test]
fn rejects_invalid_wasm_even_with_matching_manifest() -> Result {
    let root = fixture()?;
    write(root.path(), "lkjstr-web-wasm/bridge.wasm", b"not wasm")?;
    let evidence = support::evidence(&root.path().join("lkjstr-web-wasm"), "bridge.wasm")?;
    change_manifest(root.path(), |value| value["wasm"] = evidence)?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    Ok(())
}

#[test]
fn rejects_invalid_sqlite_wasm() -> Result {
    let root = fixture()?;
    write(root.path(), "sqlite/sqlite3.wasm", b"not wasm")?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    Ok(())
}

#[test]
fn rejects_unsafe_manifest_paths() -> Result {
    for name in [
        "../index.html",
        "/index.html",
        "./bridge.js",
        "snippets/../bridge.js",
        "snippets//inline0.js",
        "snippets\\inline0.js",
        ".private",
        "",
    ] {
        let root = fixture()?;
        change_manifest(root.path(), |value| value["script"]["name"] = json!(name))?;
        assert!(lkjstr_host::validate_root(root.path()).is_err(), "{name}");
    }
    Ok(())
}

#[test]
fn rejects_invalid_or_oversized_manifests() -> Result {
    let root = fixture()?;
    for bytes in [b"not json".to_vec(), vec![b' '; 1024 * 1024 + 1]] {
        write(root.path(), "lkjstr-web-wasm/asset-manifest.json", &bytes)?;
        assert!(lkjstr_host::validate_root(root.path()).is_err());
    }
    Ok(())
}

#[test]
fn rejects_oversized_or_excessive_manifest_entries() -> Result {
    let root = fixture()?;
    change_manifest(root.path(), |value| {
        value["wasm"]["bytes"] = json!(u64::MAX)
    })?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    let root = fixture()?;
    change_manifest(root.path(), |value| {
        value["imports"] = json!(vec![value["script"].clone(); 1025]);
    })?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    Ok(())
}

#[test]
#[cfg(unix)]
fn rejects_symlinks_including_root_and_nested_directories() -> Result {
    use std::os::unix::fs::symlink;
    let root = fixture()?;
    let elsewhere = tempfile::tempdir()?;
    symlink(root.path(), elsewhere.path().join("root"))?;
    assert!(lkjstr_host::validate_root(&elsewhere.path().join("root")).is_err());
    symlink(elsewhere.path(), root.path().join("escape"))?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    fs::remove_file(root.path().join("escape"))?;
    symlink(
        root.path().join("index.html"),
        root.path().join("linked.html"),
    )?;
    assert!(lkjstr_host::validate_root(root.path()).is_err());
    Ok(())
}
