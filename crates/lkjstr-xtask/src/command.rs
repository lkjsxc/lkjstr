use std::path::Path;

use crate::quiet_steps::{Step, build_steps, run_quiet_step, rust_steps, test_steps};

/// Quiet gates print one `ok <target>` line on success and a bounded tail on failure.
pub fn quiet(root: &Path, target: &str) -> Result<(), String> {
    match target {
        "repo" => repo_checks(root)?,
        "test" => run_steps(root, test_steps())?,
        "rust-wasm" => {
            run_steps(root, rust_steps())?;
            run_steps(root, build_steps())?;
            crate::dist_check::check(root)?;
        }
        "verify" | "ci" | "docker-verify" => {
            repo_checks(root)?;
            run_steps(root, test_steps())?;
            run_steps(root, build_steps())?;
            crate::dist_check::check(root)?;
        }
        _ => {
            return Err(
                "quiet target must be repo, test, rust-wasm, verify, ci, or docker-verify"
                    .to_owned(),
            );
        }
    }
    println!("ok {target}");
    Ok(())
}

fn repo_checks(root: &Path) -> Result<(), String> {
    crate::doc_check::check(root)?;
    crate::line_check::check(root)?;
    crate::rust_style::check(root)
}

fn run_steps(root: &Path, steps: Vec<Step>) -> Result<(), String> {
    for step in steps {
        run_quiet_step(root, &step)?;
    }
    Ok(())
}
