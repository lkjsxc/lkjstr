use std::{
    env,
    ffi::OsString,
    path::{Path, PathBuf},
    process::Command,
};

pub fn quiet(root: &Path, target: &str) -> Result<(), String> {
    match target {
        "verify" => verify(root),
        "ci" => ci(root),
        _ => Err("quiet target must be verify or ci".to_owned()),
    }
}

fn verify(root: &Path) -> Result<(), String> {
    run_xtask_checks(root)?;
    run(root, cargo_bin(), &["fmt", "--check"])?;
    run(
        root,
        cargo_bin(),
        &[
            "clippy",
            "--workspace",
            "--all-targets",
            "--",
            "-D",
            "warnings",
        ],
    )?;
    run(root, cargo_bin(), &["test", "--workspace"])?;
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
    crate::storage_manifest::check(root)
}

fn run<I, S>(root: &Path, program: I, args: &[S]) -> Result<(), String>
where
    I: Into<OsString>,
    S: AsRef<str>,
{
    let program = program.into();
    let status = Command::new(&program)
        .args(args.iter().map(AsRef::as_ref))
        .current_dir(root)
        .status()
        .map_err(|error| format!("failed to run {:?}: {error}", program))?;
    if status.success() {
        Ok(())
    } else {
        Err(format!("{:?} exited with {status}", program))
    }
}

fn cargo_bin() -> OsString {
    match env::var_os("HOME") {
        Some(home) => {
            let candidate = PathBuf::from(home).join(".cargo/bin/cargo");
            if candidate.is_file() {
                candidate.into_os_string()
            } else {
                OsString::from("cargo")
            }
        }
        None => OsString::from("cargo"),
    }
}
