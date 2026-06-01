mod command;
mod doc_check;
mod line_check;
mod paths;
mod rust_style;
mod sqlite_schema_doc;
mod storage_manifest;

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
    let Some(command_name) = args.next() else {
        return Err(usage());
    };

    match command_name.as_str() {
        "check-docs" => doc_check::check(&root),
        "check-lines" => line_check::check(&root),
        "check-rust-style" => rust_style::check(&root),
        "check-storage-manifest-docs" => {
            storage_manifest::check(&root)?;
            sqlite_schema_doc::check(&root)
        }
        "quiet" => {
            let Some(target) = args.next() else {
                return Err("quiet requires rust-wasm, verify, or ci".to_owned());
            };
            command::quiet(&root, &target)
        }
        _ => Err(usage()),
    }
}

fn usage() -> String {
    [
        "usage:",
        "  cargo run -p lkjstr-xtask -- check-docs",
        "  cargo run -p lkjstr-xtask -- check-lines",
        "  cargo run -p lkjstr-xtask -- check-rust-style",
        "  cargo run -p lkjstr-xtask -- check-storage-manifest-docs",
        "  cargo run -p lkjstr-xtask -- quiet rust-wasm",
        "  cargo run -p lkjstr-xtask -- quiet verify",
        "  cargo run -p lkjstr-xtask -- quiet ci",
    ]
    .join("\n")
}
