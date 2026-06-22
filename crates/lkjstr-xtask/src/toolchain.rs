use std::{env, ffi::OsStr, ffi::OsString, path::Path, process::Command};

use crate::tool_path::prefer_rustup_cargo;

const WASM_PACK_VERSION: &str = "0.15.0";

pub(crate) fn wasm_pack_bin() -> OsString {
    env::var_os("LKJSTR_WASM_PACK").unwrap_or_else(|| OsString::from("wasm-pack"))
}

pub(crate) fn preflight_wasm_pack(root: &Path, program: &OsStr) -> Result<(), String> {
    preflight_command(
        root,
        program,
        || missing_wasm_pack(program),
        wasm_pack_install_hint,
    )
}

pub(crate) fn preflight_wasm_browser(root: &Path, step_name: &str) -> Result<(), String> {
    match step_name {
        "wasm-pack chrome" => preflight_any_browser(
            root,
            "Chrome",
            &["google-chrome", "chromium", "chromium-browser"],
        ),
        "wasm-pack firefox" => preflight_any_browser(root, "Firefox", &["firefox", "firefox-esr"]),
        _ => Ok(()),
    }
}

fn preflight_any_browser(root: &Path, label: &str, programs: &[&str]) -> Result<(), String> {
    if programs.iter().any(|program| {
        preflight_command(root, OsStr::new(program), String::new, String::new).is_ok()
    }) {
        return Ok(());
    }
    Err(missing_browser_message(label, programs))
}

fn missing_browser_message(label: &str, programs: &[&str]) -> String {
    format!(
        "Missing required Rust/WASM browser test tool: {label}. Install one of [{}], or run Docker verification with docker compose.",
        programs.join(", ")
    )
}

fn preflight_command<M, H>(root: &Path, program: &OsStr, missing: M, hint: H) -> Result<(), String>
where
    M: FnOnce() -> String,
    H: FnOnce() -> String,
{
    let mut command = Command::new(program);
    command.arg("--version").current_dir(root);
    prefer_rustup_cargo(&mut command);
    let output = command.output().map_err(|_| missing())?;
    if output.status.success() {
        return Ok(());
    }
    Err(format!(
        "Rust/WASM tool preflight failed: {} --version exited {}. {}\n{}",
        program.to_string_lossy(),
        output
            .status
            .code()
            .map_or("unknown".to_owned(), |code| code.to_string()),
        hint(),
        output_tail(&output.stderr, &output.stdout),
    ))
}

fn missing_wasm_pack(program: &OsStr) -> String {
    format!(
        "Missing required Rust/WASM build tool: {}. {}",
        program.to_string_lossy(),
        wasm_pack_install_hint(),
    )
}

fn wasm_pack_install_hint() -> String {
    format!(
        "Install it with cargo install wasm-pack --locked --version {WASM_PACK_VERSION}, or run Docker verification with docker compose."
    )
}

fn output_tail(stderr: &[u8], stdout: &[u8]) -> String {
    let text = if stderr.is_empty() { stdout } else { stderr };
    String::from_utf8_lossy(text)
        .chars()
        .rev()
        .take(1200)
        .collect::<String>()
        .chars()
        .rev()
        .collect()
}

#[cfg(test)]
mod tests {
    use std::{ffi::OsStr, path::Path};

    use super::{missing_browser_message, preflight_wasm_pack};

    #[test]
    fn missing_wasm_pack_has_actionable_diagnostic_without_spawn_text() {
        let message = preflight_wasm_pack(
            Path::new("."),
            OsStr::new("definitely-missing-wasm-pack-for-lkjstr"),
        )
        .err()
        .unwrap_or_default();

        assert!(message.contains("Missing required Rust/WASM build tool"));
        assert!(message.contains("cargo install wasm-pack --locked --version 0.15.0"));
        assert!(message.contains("Docker verification"));
        assert!(!message.contains("spawnSync"));
        assert!(!message.contains("ENOENT"));
    }

    #[test]
    fn missing_browser_tool_names_firefox_and_docker_path() {
        let message = missing_browser_message("Firefox", &["firefox", "firefox-esr"]);

        assert!(message.contains("Missing required Rust/WASM browser test tool: Firefox"));
        assert!(message.contains("firefox, firefox-esr"));
        assert!(message.contains("Docker verification"));
        assert!(!message.contains("geckodriver"));
    }
}
