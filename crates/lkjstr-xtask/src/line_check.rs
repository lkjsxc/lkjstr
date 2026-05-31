use std::{fs, path::Path};

use crate::paths;

const SOURCE_EXTS: &[&str] = &["css", "html", "js", "rs", "svelte", "ts"];

pub fn check(root: &Path) -> Result<(), String> {
    let mut problems = Vec::new();
    for file in paths::walk_files(root)? {
        let rel = paths::rel(root, &file);
        let strict_doc = is_strict_doc(&rel);
        let source = is_source(&rel);
        if !strict_doc && !source {
            continue;
        }
        let text = fs::read_to_string(&file).map_err(|error| format!("{rel}: {error}"))?;
        if strict_doc {
            check_limit(&mut problems, &rel, &text, 300, "docs");
        }
        if source {
            check_limit(&mut problems, &rel, &text, 200, "source");
        }
    }
    finish(problems)
}

pub fn is_strict_doc(rel: &str) -> bool {
    rel == "README.md" || rel == "AGENTS.md" || (rel.starts_with("docs/") && rel.ends_with(".md"))
}

fn is_source(rel: &str) -> bool {
    let in_source_root = ["src/", "scripts/", "tests/", "crates/", "tools/"]
        .iter()
        .any(|prefix| rel.starts_with(prefix));
    in_source_root && SOURCE_EXTS.iter().any(|ext| rel.ends_with(ext))
}

fn check_limit(problems: &mut Vec<String>, rel: &str, text: &str, limit: usize, label: &str) {
    let lines = text.lines().count();
    if lines > limit {
        problems.push(format!(
            "{rel}: {label} file has {lines} lines over {limit}"
        ));
    }
}

fn finish(problems: Vec<String>) -> Result<(), String> {
    if problems.is_empty() {
        println!("ok check-lines");
        Ok(())
    } else {
        Err(problems.join("\n"))
    }
}
