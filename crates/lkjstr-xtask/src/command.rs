use std::path::Path;

use crate::quiet_steps::{
    Step, node_check_steps, node_verify_steps, run_quiet_step, rust_wasm_steps,
};

pub fn quiet(root: &Path, target: &str) -> Result<(), String> {
    match target {
        "rust-wasm" => rust_wasm(root),
        "verify" => verify(root),
        "ci" => ci(root),
        "docker-verify" => docker_verify(root),
        _ => Err("quiet target must be rust-wasm, verify, ci, or docker-verify".to_owned()),
    }
}

fn verify(root: &Path) -> Result<(), String> {
    verify_plan(root)?;
    println!("ok verify");
    Ok(())
}

fn ci(root: &Path) -> Result<(), String> {
    verify_plan(root)?;
    println!("ok ci");
    Ok(())
}

fn verify_plan(root: &Path) -> Result<(), String> {
    run_xtask_checks(root)?;
    run_steps(root, rust_wasm_steps())?;
    run_steps(root, node_verify_steps())
}

fn docker_verify(root: &Path) -> Result<(), String> {
    run_xtask_checks(root)?;
    run_steps(root, rust_wasm_steps())?;
    run_steps(root, node_check_steps())?;
    println!("ok verify");
    Ok(())
}

fn rust_wasm(root: &Path) -> Result<(), String> {
    run_steps(root, rust_wasm_steps())?;
    println!("ok rust-wasm");
    Ok(())
}

fn run_xtask_checks(root: &Path) -> Result<(), String> {
    crate::doc_check::check(root)?;
    crate::line_check::check(root)?;
    crate::rust_style::check(root)?;
    crate::storage_manifest::check(root)?;
    crate::sqlite_schema_doc::check(root)
}

fn run_steps(root: &Path, steps: Vec<Step>) -> Result<(), String> {
    for step in steps {
        run_quiet_step(root, &step)?;
    }
    Ok(())
}
