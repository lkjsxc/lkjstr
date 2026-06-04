use std::{
    fs,
    path::{Path, PathBuf},
};

const SKIP_DIRS: &[&str] = &[
    ".git",
    ".omx",
    ".pnpm-store",
    ".svelte-kit",
    ".wrangler",
    "build",
    "coverage",
    "data",
    "node_modules",
    "target",
    "tmp",
];

pub fn walk_files(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    walk(root, root, &mut files)?;
    files.sort();
    Ok(files)
}

pub fn walk_dirs(root: &Path) -> Result<Vec<PathBuf>, String> {
    let mut dirs = Vec::new();
    walk_dir_list(root, root, &mut dirs)?;
    dirs.sort();
    Ok(dirs)
}

pub fn rel(root: &Path, path: &Path) -> String {
    path.strip_prefix(root)
        .map(path_to_slash)
        .unwrap_or_else(|_| path_to_slash(path))
}

pub fn is_skipped(path: &Path) -> bool {
    path.components()
        .filter_map(|component| component.as_os_str().to_str())
        .any(|part| SKIP_DIRS.contains(&part))
}

fn walk(root: &Path, dir: &Path, files: &mut Vec<PathBuf>) -> Result<(), String> {
    for entry in read_dir(dir)? {
        let path = entry.map_err(|error| error.to_string())?.path();
        let rel_path = path.strip_prefix(root).map_err(|error| error.to_string())?;
        if path.is_dir() {
            if !is_skipped(rel_path) {
                walk(root, &path, files)?;
            }
        } else if path.is_file() {
            files.push(path);
        }
    }
    Ok(())
}

fn walk_dir_list(root: &Path, dir: &Path, dirs: &mut Vec<PathBuf>) -> Result<(), String> {
    dirs.push(dir.to_path_buf());
    for entry in read_dir(dir)? {
        let path = entry.map_err(|error| error.to_string())?.path();
        let rel_path = path.strip_prefix(root).map_err(|error| error.to_string())?;
        if path.is_dir() && !is_skipped(rel_path) {
            walk_dir_list(root, &path, dirs)?;
        }
    }
    Ok(())
}

fn read_dir(dir: &Path) -> Result<fs::ReadDir, String> {
    fs::read_dir(dir).map_err(|error| format!("{}: {error}", path_to_slash(dir)))
}

fn path_to_slash(path: &Path) -> String {
    path.to_string_lossy().replace('\\', "/")
}
