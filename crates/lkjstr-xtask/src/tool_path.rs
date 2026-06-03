use std::{env, ffi::OsString, path::PathBuf, process::Command};

pub(crate) fn prefer_rustup_cargo(command: &mut Command) {
    let Some(home) = env::var_os("HOME") else {
        return;
    };
    let cargo_dir = PathBuf::from(home).join(".cargo/bin");
    if !cargo_dir.is_dir() {
        return;
    }
    let mut paths = vec![cargo_dir];
    if let Some(path) = env::var_os("PATH") {
        paths.extend(env::split_paths(&path));
    }
    if let Ok(path) = env::join_paths(paths) {
        command.env("PATH", path);
    }
}

pub(crate) fn cargo_bin() -> OsString {
    match env::var_os("HOME") {
        Some(home) => cargo_candidate(home).unwrap_or_else(|| OsString::from("cargo")),
        None => OsString::from("cargo"),
    }
}

fn cargo_candidate(home: OsString) -> Option<OsString> {
    let candidate = PathBuf::from(home).join(".cargo/bin/cargo");
    if candidate.is_file() {
        Some(candidate.into_os_string())
    } else {
        None
    }
}
