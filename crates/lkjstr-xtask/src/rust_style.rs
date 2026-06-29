use std::{fs, path::Path};

use crate::paths;

pub fn check(root: &Path) -> Result<(), String> {
    let mut problems = Vec::new();
    for file in paths::walk_files(root)? {
        let rel = paths::rel(root, &file);
        if !rel.starts_with("crates/") || !rel.ends_with(".rs") {
            continue;
        }
        let text = fs::read_to_string(&file).map_err(|error| format!("{rel}: {error}"))?;
        check_file(&mut problems, &rel, &text);
    }
    if problems.is_empty() {
        println!("ok check-rust-style");
        Ok(())
    } else {
        Err(problems.join("\n"))
    }
}

fn check_file(problems: &mut Vec<String>, rel: &str, text: &str) {
    let production = !is_test_path(rel);
    for (index, line) in text.lines().enumerate() {
        let scrubbed = scrub_line(line);
        for (pattern, label) in forbidden_patterns() {
            if scrubbed.contains(&pattern) {
                problems.push(format!("{rel}: line {} forbids {label}", index + 1));
            }
        }
        if production {
            check_production_line(problems, rel, index + 1, &scrubbed);
        }
    }
}

fn forbidden_patterns() -> Vec<(String, String)> {
    [
        ("dbg!", "dbg macro"),
        ("todo!", "todo macro"),
        ("unimplemented!", "unimplemented macro"),
        (".unwrap(", "unwrap call"),
        (".expect(", "expect call"),
        ("panic!", "panic macro"),
    ]
    .into_iter()
    .map(|(pattern, label)| (pattern.to_owned(), label.to_owned()))
    .collect()
}

fn check_production_line(problems: &mut Vec<String>, rel: &str, line_number: usize, line: &str) {
    let trimmed = line.trim_start();
    if !allows_global_mutable_state(rel) {
        if trimmed.starts_with("static mut ") || line.contains("thread_local!") {
            problems.push(format!(
                "{rel}: line {line_number} forbids global mutable state"
            ));
        }
        if trimmed.starts_with("static ")
            && ["Mutex<", "RwLock<", "OnceLock<", "LazyLock<"]
                .iter()
                .any(|pattern| line.contains(pattern))
        {
            problems.push(format!(
                "{rel}: line {line_number} forbids global mutable state"
            ));
        }
    }
    if ["fn placeholder", "fn stub", "fn mock"]
        .iter()
        .any(|pattern| line.contains(pattern))
    {
        problems.push(format!(
            "{rel}: line {line_number} forbids placeholder functions"
        ));
    }
}

fn allows_global_mutable_state(rel: &str) -> bool {
    matches!(
        rel,
        "crates/lkjstr-web/src/sqlite_host_store/registry.rs"
            | "crates/lkjstr-web/src/sqlite_host_store/cooldown.rs"
    )
}

fn is_test_path(rel: &str) -> bool {
    rel.contains("/tests/") || rel.ends_with("_test.rs")
}

fn scrub_line(line: &str) -> String {
    let mut out = String::with_capacity(line.len());
    let mut chars = line.chars().peekable();
    let mut in_string = false;
    let mut in_char = false;
    let mut escaped = false;
    while let Some(character) = chars.next() {
        if !in_string && !in_char && character == '/' && chars.peek() == Some(&'/') {
            break;
        }
        if in_string || in_char {
            if escaped {
                escaped = false;
            } else if character == '\\' {
                escaped = true;
            } else if in_string && character == '"' {
                in_string = false;
            } else if in_char && character == '\'' {
                in_char = false;
            }
            out.push(' ');
            continue;
        }
        if character == '"' {
            in_string = true;
            out.push(' ');
        } else if character == '\'' {
            in_char = true;
            out.push(' ');
        } else {
            out.push(character);
        }
    }
    out
}
