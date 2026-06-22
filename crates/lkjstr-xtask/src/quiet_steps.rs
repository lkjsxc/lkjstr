use std::{ffi::OsString, path::Path, process::Command, time::Duration};

use crate::{
    browser_driver::chrome_driver_args,
    quiet_process::{QuietOutput, run_with_timeout},
    tool_path::{cargo_bin, prefer_rustup_cargo},
    toolchain::{preflight_wasm_browser, preflight_wasm_pack, wasm_pack_bin},
};

const TAIL_BYTES: usize = 128 * 1024;
const STEP_TIMEOUT: Duration = Duration::from_secs(30 * 60);

pub struct Step {
    pub name: &'static str,
    program: OsString,
    args: Vec<OsString>,
    clear_no_color: bool,
}

pub fn rust_wasm_steps() -> Vec<Step> {
    let cargo = cargo_bin();
    vec![
        step("cargo fmt", cargo.clone(), vec!["fmt", "--check"]),
        step(
            "cargo clippy workspace",
            cargo.clone(),
            vec![
                "clippy",
                "--workspace",
                "--all-targets",
                "--",
                "-D",
                "warnings",
            ],
        ),
        step(
            "cargo clippy wasm",
            cargo.clone(),
            vec![
                "clippy",
                "-p",
                "lkjstr-web",
                "--target",
                "wasm32-unknown-unknown",
                "--all-targets",
                "--",
                "-D",
                "warnings",
            ],
        ),
        step("cargo test", cargo, vec!["test", "--workspace"]),
        step_os(
            "wasm-pack chrome",
            wasm_pack_bin(),
            wasm_pack_args("--chrome"),
        ),
        step_os(
            "wasm-pack firefox",
            wasm_pack_bin(),
            wasm_pack_args("--firefox"),
        ),
        Step {
            name: "trunk build",
            program: OsString::from("trunk"),
            args: os_args(vec!["build", "--release"]),
            clear_no_color: true,
        },
    ]
}

pub fn node_check_steps() -> Vec<Step> {
    vec![
        step("pnpm check:repo", "pnpm", vec!["check:repo"]),
        step("pnpm lint", "pnpm", vec!["lint"]),
        step("pnpm check", "pnpm", vec!["check"]),
        step("pnpm test", "pnpm", vec!["test"]),
    ]
}

pub fn node_verify_steps() -> Vec<Step> {
    let mut steps = node_check_steps();
    steps.push(step("pnpm build", "pnpm", vec!["build"]));
    steps
}

pub fn run_quiet_step(root: &Path, step: &Step) -> Result<(), String> {
    if step.name.starts_with("wasm-pack") {
        preflight_wasm_pack(root, &step.program)?;
        preflight_wasm_browser(root, step.name)?;
    }
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

fn wasm_pack_args(browser: &'static str) -> Vec<OsString> {
    let mut args = os_args(vec!["test", "--headless", browser]);
    if browser == "--chrome" {
        args.extend(chrome_driver_args());
    }
    args.push(OsString::from("crates/lkjstr-web"));
    args
}

fn step<I>(name: &'static str, program: I, args: Vec<&'static str>) -> Step
where
    I: Into<OsString>,
{
    Step {
        name,
        program: program.into(),
        args: os_args(args),
        clear_no_color: false,
    }
}

fn step_os<I>(name: &'static str, program: I, args: Vec<OsString>) -> Step
where
    I: Into<OsString>,
{
    Step {
        name,
        program: program.into(),
        args,
        clear_no_color: false,
    }
}

fn os_args(args: Vec<&'static str>) -> Vec<OsString> {
    args.into_iter().map(OsString::from).collect()
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
