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
        check_task_doc_shape(&mut problems, &rel, &text);
    }
    check_docs_topology(root, &mut problems)?;
    check_readme_descendants(root, &mut problems)?;
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
    check_table_shape(problems, rel, text);
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

const TABLE_COLUMN_LIMIT: usize = 6;

fn check_table_shape(problems: &mut Vec<String>, rel: &str, text: &str) {
    if allows_wide_tables(rel, text) {
        return;
    }
    let mut in_code = false;
    for (index, line) in text.lines().enumerate() {
        if line.starts_with("```") {
            in_code = !in_code;
        }
        if in_code {
            continue;
        }
        let columns = table_columns(line);
        if columns > TABLE_COLUMN_LIMIT {
            problems.push(format!(
                "{rel}: line {} has {columns} table columns over {TABLE_COLUMN_LIMIT}",
                index + 1
            ));
        }
    }
}

fn table_columns(line: &str) -> usize {
    let trimmed = line.trim();
    if !(trimmed.starts_with('|') && trimmed.ends_with('|')) {
        return 0;
    }
    trimmed.matches('|').count().saturating_sub(1)
}

fn allows_wide_tables(rel: &str, text: &str) -> bool {
    rel.ends_with("-ledger.md")
        || rel.ends_with("table-manifest.md")
        || text.lines().any(|line| line == "## Matrix")
}

const REQUIRED_TASK_HEADINGS: &[&str] = &[
    "Purpose",
    "Status",
    "Current Evidence",
    "Next Edit",
    "Files To Read",
    "Files To Touch",
    "Focused Gate",
    "Acceptance",
    "Must Not",
];

fn check_task_doc_shape(problems: &mut Vec<String>, rel: &str, text: &str) {
    if !rel.starts_with("docs/execution/tasks/") || rel == "docs/execution/tasks/README.md" {
        return;
    }
    for heading in REQUIRED_TASK_HEADINGS {
        let marker = format!("## {heading}");
        if !text.lines().any(|line| line == marker.as_str()) {
            problems.push(format!("{rel}: task doc missing {heading}"));
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

fn check_readme_descendants(root: &Path, problems: &mut Vec<String>) -> Result<(), String> {
    let docs_root = root.join("docs");
    let files = paths::walk_files(&docs_root)?;
    for dir in paths::walk_dirs(&docs_root)? {
        let readme = dir.join("README.md");
        if !readme.is_file() {
            continue;
        }
        let rel = paths::rel(root, &readme);
        let text = fs::read_to_string(&readme).map_err(|error| format!("{rel}: {error}"))?;
        for file in files
            .iter()
            .filter(|file| is_descendant_doc(&dir, &readme, file))
        {
            let target = paths::rel(&dir, file);
            if !toc_mentions(&text, &target) {
                problems.push(format!("{rel}: TOC missing {target}"));
            }
        }
    }
    Ok(())
}

fn is_descendant_doc(dir: &Path, readme: &Path, file: &Path) -> bool {
    file.starts_with(dir)
        && file != readme
        && file.extension().and_then(|ext| ext.to_str()) == Some("md")
}

fn toc_mentions(text: &str, target: &str) -> bool {
    text.contains(&format!("]({target})")) || text.contains(&format!("`{target}`"))
}

fn counts_as_docs_child(path: &Path) -> bool {
    path.is_dir() || path.extension().and_then(|ext| ext.to_str()) == Some("md")
}
