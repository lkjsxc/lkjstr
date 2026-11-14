use std::{ffi::OsString, path::Path, process::Command, time::Duration};

use crate::{
    quiet_process::{QuietOutput, run_with_timeout},
    tool_path::{cargo_bin, prefer_rustup_cargo},
};

const TAIL_BYTES: usize = 128 * 1024;
const STEP_TIMEOUT: Duration = Duration::from_secs(30 * 60);

pub struct Step {
    pub name: &'static str,
    program: OsString,
    args: Vec<OsString>,
    clear_no_color: bool,
}

/// Rust gates: format, lint (native and wasm), tests. Jobs are capped by the
/// caller's `CARGO_BUILD_JOBS` on shared hosts.
pub fn rust_steps() -> Vec<Step> {
    let cargo = cargo_bin();
    let clippy = [
        "clippy",
        "--workspace",
        "--all-targets",
        "--",
        "-D",
        "warnings",
    ];
    let wasm = [
        "clippy",
        "-p",
        "lkjstr-web",
        "--target",
        "wasm32-unknown-unknown",
        "--",
        "-D",
        "warnings",
    ];
    vec![
        step("cargo fmt", cargo.clone(), &["fmt", "--all", "--check"]),
        step("cargo clippy", cargo.clone(), &clippy),
        step("cargo clippy wasm", cargo.clone(), &wasm),
        step("cargo test", cargo, &["test", "--workspace"]),
    ]
}

/// The browser artifact: Trunk builds `dist/` from `index.html`.
pub fn build_steps() -> Vec<Step> {
    vec![Step {
        name: "trunk build",
        program: OsString::from("trunk"),
        args: ["build", "--release"].iter().map(OsString::from).collect(),
        clear_no_color: true,
    }]
}

fn step(name: &'static str, program: OsString, args: &[&str]) -> Step {
    Step {
        name,
        program,
        args: args.iter().map(OsString::from).collect(),
        clear_no_color: false,
    }
}

pub fn run_quiet_step(root: &Path, step: &Step) -> Result<(), String> {
    let mut command = Command::new(&step.program);
    command.args(&step.args).current_dir(root);
    prefer_rustup_cargo(&mut command);
    if step.clear_no_color {
        command.env_remove("NO_COLOR");
    }
    let output = run_with_timeout(&mut command, STEP_TIMEOUT)
        .map_err(|error| format!("failed to run {}: {error}", step.name))?;
    if !output.timed_out && output.status.is_some_and(|status| status.success()) {
        Ok(())
    } else {
        Err(format!(
            "{} failed with {}\n{}",
            step.name,
            status_text(&output),
            output_tail(&output)
        ))
    }
}

fn status_text(output: &QuietOutput) -> String {
    if output.timed_out {
        return format!("timeout after {}s", STEP_TIMEOUT.as_secs());
    }
    output.status.map_or_else(
        || "unknown status".to_owned(),
        |status| {
            status
                .code()
                .map(|code| format!("exit {code}"))
                .unwrap_or_else(|| "signal".to_owned())
        },
    )
}

fn output_tail(output: &QuietOutput) -> String {
    let mut bytes = Vec::new();
    append_stream(&mut bytes, "stdout", &output.stdout);
    append_stream(&mut bytes, "stderr", &output.stderr);
    if bytes.is_empty() {
        return "(no output)".to_owned();
    }
    let start = bytes.len().saturating_sub(TAIL_BYTES);
    String::from_utf8_lossy(&bytes[start..]).into_owned()
}

fn append_stream(out: &mut Vec<u8>, label: &str, bytes: &[u8]) {
    if bytes.is_empty() {
        return;
    }
    out.extend_from_slice(label.as_bytes());
    out.extend_from_slice(b":\n");
    out.extend_from_slice(bytes);
    if !bytes.ends_with(b"\n") {
        out.push(b'\n');
    }
}
