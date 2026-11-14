mod command;
mod dist_check;
mod doc_check;
mod line_check;
mod paths;
mod quiet_process;
mod quiet_steps;
mod rust_style;
mod tool_path;

use std::{env, process};

fn main() {
    if let Err(error) = run() {
        eprintln!("{error}");
        process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let root = env::current_dir().map_err(|error| error.to_string())?;
    let mut args = env::args().skip(1);
    match args.next().as_deref() {
        Some("check-dist") => {
            dist_check::check(&root)?;
            println!("ok check-dist");
            Ok(())
        }
        Some("check-docs") => {
            doc_check::check(&root)?;
            println!("ok check-docs");
            Ok(())
        }
        Some("check-lines") => {
            line_check::check(&root)?;
            println!("ok check-lines");
            Ok(())
        }
        Some("check-rust-style") => {
            rust_style::check(&root)?;
            println!("ok check-rust-style");
            Ok(())
        }
        Some("quiet") => {
            let target = args.next().ok_or_else(usage)?;
            command::quiet(&root, &target)
        }
        _ => Err(usage()),
    }
}

fn usage() -> String {
    [
        "usage:",
        "  cargo run -p lkjstr-xtask -- check-dist",
        "  cargo run -p lkjstr-xtask -- check-docs",
        "  cargo run -p lkjstr-xtask -- check-lines",
        "  cargo run -p lkjstr-xtask -- check-rust-style",
        "  cargo run -p lkjstr-xtask -- quiet repo|test|rust-wasm|verify|ci|docker-verify",
    ]
    .join("\n")
}
