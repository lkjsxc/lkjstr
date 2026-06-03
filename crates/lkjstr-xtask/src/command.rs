use std::{
    ffi::OsString,
    path::Path,
    process::{Command, Output},
};

use crate::tool_path::{cargo_bin, prefer_rustup_cargo};

const TAIL_BYTES: usize = 128 * 1024;

pub fn quiet(root: &Path, target: &str) -> Result<(), String> {
    match target {
        "rust-wasm" => rust_wasm(root),
        "verify" => verify(root),
        "ci" => ci(root),
        _ => Err("quiet target must be rust-wasm, verify, or ci".to_owned()),
    }
}

fn verify(root: &Path) -> Result<(), String> {
    run_xtask_checks(root)?;
    rust_wasm(root)?;
    run(root, "pnpm", &["verify:quiet"])?;
    Ok(())
}

fn ci(root: &Path) -> Result<(), String> {
    verify(root)?;
    run(root, "pnpm", &["ci:quiet"])?;
    Ok(())
}

fn run_xtask_checks(root: &Path) -> Result<(), String> {
    crate::doc_check::check(root)?;
    crate::line_check::check(root)?;
    crate::rust_style::check(root)?;
    crate::storage_manifest::check(root)?;
    crate::sqlite_schema_doc::check(root)
}

fn rust_wasm(root: &Path) -> Result<(), String> {
    for step in rust_wasm_steps() {
        run_quiet_step(root, &step)?;
    }
    println!("ok rust-wasm");
    Ok(())
}

struct Step {
    name: &'static str,
    program: OsString,
    args: Vec<&'static str>,
    clear_no_color: bool,
}

fn rust_wasm_steps() -> Vec<Step> {
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
        step("wasm-pack chrome", "wasm-pack", wasm_pack_args("--chrome")),
        step(
            "wasm-pack firefox",
            "wasm-pack",
            wasm_pack_args("--firefox"),
        ),
        Step {
            name: "trunk build",
            program: OsString::from("trunk"),
            args: vec!["build", "--release"],
            clear_no_color: true,
        },
    ]
}

fn wasm_pack_args(browser: &'static str) -> Vec<&'static str> {
    vec!["test", "--headless", browser, "crates/lkjstr-web"]
}

fn step<I>(name: &'static str, program: I, args: Vec<&'static str>) -> Step
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

fn run_quiet_step(root: &Path, step: &Step) -> Result<(), String> {
    let mut command = Command::new(&step.program);
    command.args(&step.args).current_dir(root);
    prefer_rustup_cargo(&mut command);
    if step.clear_no_color {
        command.env_remove("NO_COLOR");
    }
    let output = command
        .output()
        .map_err(|error| format!("failed to run {}: {error}", step.name))?;
    if output.status.success() {
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

fn status_text(output: &Output) -> String {
    output
        .status
        .code()
        .map(|code| format!("exit {code}"))
        .unwrap_or_else(|| "signal".to_owned())
}

fn output_tail(output: &Output) -> String {
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

fn run<I, S>(root: &Path, program: I, args: &[S]) -> Result<(), String>
where
    I: Into<OsString>,
    S: AsRef<str>,
{
    let program = program.into();
    let mut command = Command::new(&program);
    command
        .args(args.iter().map(AsRef::as_ref))
        .current_dir(root);
    prefer_rustup_cargo(&mut command);
    let status = command
        .status()
        .map_err(|error| format!("failed to run {:?}: {error}", program))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{:?} exited with {status}", program))
    }
}
