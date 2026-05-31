use std::{fs, path::Path};

use crate::{line_check, paths};

pub fn check(root: &Path) -> Result<(), String> {
    let mut problems = Vec::new();
    for file in paths::walk_files(root)? {
        let rel = paths::rel(root, &file);
        if !line_check::is_strict_doc(&rel) {
            continue;
        }
        let text = fs::read_to_string(&file).map_err(|error| format!("{rel}: {error}"))?;
        check_doc_shape(&mut problems, &rel, &text);
    }
    check_docs_topology(root, &mut problems)?;
    if problems.is_empty() {
        println!("ok check-docs");
        Ok(())
    } else {
        Err(problems.join("\n"))
    }
}

fn check_doc_shape(problems: &mut Vec<String>, rel: &str, text: &str) {
    if !text.starts_with("# ") {
        problems.push(format!("{rel}: documentation must start with an H1"));
    }
    if !text.contains("\n## Purpose\n") {
        problems.push(format!("{rel}: documentation must include Purpose"));
    }
    if !text.is_ascii() {
        problems.push(format!("{rel}: documentation must be ASCII-only"));
    }
    if contains_release_shorthand(text) {
        problems.push(format!("{rel}: contains release shorthand"));
    }
    check_prose_width(problems, rel, text);
}

fn check_prose_width(problems: &mut Vec<String>, rel: &str, text: &str) {
    let mut in_code = false;
    for (index, line) in text.lines().enumerate() {
        if line.starts_with("```") {
            in_code = !in_code;
        }
        let table = line.trim().starts_with('|') && line.trim().ends_with('|');
        if !in_code && !table && line.len() > 160 {
            problems.push(format!("{rel}: line {} exceeds 160 prose chars", index + 1));
        }
    }
}

fn contains_release_shorthand(text: &str) -> bool {
    text.split(|character: char| !character.is_ascii_alphanumeric())
        .filter(|token| !token.is_empty())
        .map(str::to_ascii_lowercase)
        .any(|token| {
            token == "legacy"
                || token == "version"
                || token == "versions"
                || token == "versioned"
                || token == "versioning"
                || is_v_number(&token)
        })
}

fn is_v_number(token: &str) -> bool {
    let mut chars = token.chars();
    matches!(chars.next(), Some('v'))
        && chars
            .next()
            .is_some_and(|character| character.is_ascii_digit())
}

fn check_docs_topology(root: &Path, problems: &mut Vec<String>) -> Result<(), String> {
    let docs_root = root.join("docs");
    for dir in paths::walk_dirs(&docs_root)? {
        let rel = paths::rel(root, &dir);
        let readme = dir.join("README.md");
        if !readme.is_file() {
            problems.push(format!("{rel}: missing README.md"));
        }
        let children = fs::read_dir(&dir)
            .map_err(|error| format!("{rel}: {error}"))?
            .filter_map(Result::ok)
            .filter(|entry| counts_as_docs_child(&entry.path()))
            .filter(|entry| entry.file_name() != "README.md")
            .count();
        if children < 2 {
            problems.push(format!("{rel}: needs at least two children"));
        }
    }
    Ok(())
}

fn counts_as_docs_child(path: &Path) -> bool {
    path.is_dir() || path.extension().and_then(|ext| ext.to_str()) == Some("md")
}
