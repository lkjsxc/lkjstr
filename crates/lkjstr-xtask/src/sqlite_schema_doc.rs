use std::{collections::BTreeSet, fs, path::Path};

use lkjstr_storage::sqlite_schema_table_names;

pub fn check(root: &Path) -> Result<(), String> {
    let docs = root.join("docs/architecture/data/sqlite-opfs/schema.md");
    let docs_text = fs::read_to_string(&docs).map_err(|error| error.to_string())?;
    let docs_rows = docs_table_names(&docs_text);
    let source_rows = source_table_names();
    let mut problems = Vec::new();

    for name in &source_rows {
        if !docs_rows.contains(name) {
            problems.push(format!("SQLite schema docs missing {name}"));
        }
    }
    for name in &docs_rows {
        if !source_rows.contains(name) {
            problems.push(format!("SQLite schema docs extra {name}"));
        }
    }

    if problems.is_empty() {
        println!("ok check-sqlite-schema-docs");
        Ok(())
    } else {
        Err(problems.join("\n"))
    }
}

fn source_table_names() -> BTreeSet<String> {
    sqlite_schema_table_names()
        .into_iter()
        .map(ToOwned::to_owned)
        .collect()
}

fn docs_table_names(text: &str) -> BTreeSet<String> {
    let mut rows = BTreeSet::new();
    for line in text.lines().map(str::trim) {
        if !line.starts_with("| `") {
            continue;
        }
        if let Some(name) = first_code_cell(line) {
            rows.insert(name);
        }
    }
    rows
}

fn first_code_cell(line: &str) -> Option<String> {
    let start = line.find('`')?;
    let rest = line.get(start + 1..)?;
    let end = rest.find('`')?;
    rest.get(..end).map(ToOwned::to_owned)
}
