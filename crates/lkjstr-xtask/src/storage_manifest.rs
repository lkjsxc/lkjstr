use std::{collections::BTreeMap, fs, path::Path};

#[derive(Debug, Eq, PartialEq)]
struct Row {
    data_class: String,
    group: String,
}

pub fn check(root: &Path) -> Result<(), String> {
    let source = root.join("src/lib/storage/schema/table-manifest.ts");
    let docs = root.join("docs/architecture/data/storage/data-classes/table-manifest.md");
    let source_text = fs::read_to_string(&source).map_err(|error| error.to_string())?;
    let docs_text = fs::read_to_string(&docs).map_err(|error| error.to_string())?;
    let source_rows = source_rows(&source_text);
    let docs_rows = docs_rows(&docs_text);
    let mut problems = Vec::new();
    for (name, source_row) in &source_rows {
        match docs_rows.get(name) {
            Some(docs_row) if docs_row == source_row => {}
            Some(docs_row) => problems.push(format!(
                "docs table {name} has {}/{} but source has {}/{}",
                docs_row.data_class, docs_row.group, source_row.data_class, source_row.group
            )),
            None => problems.push(format!("docs table missing {name}")),
        }
    }
    for name in docs_rows.keys() {
        if !source_rows.contains_key(name) {
            problems.push(format!("docs table extra {name}"));
        }
    }
    if problems.is_empty() {
        println!("ok check-storage-manifest-docs");
        Ok(())
    } else {
        Err(problems.join("\n"))
    }
}

fn source_rows(text: &str) -> BTreeMap<String, Row> {
    let mut rows = BTreeMap::new();
    let mut kind: Option<&str> = None;
    let mut args: Vec<String> = Vec::new();
    for line in text.lines().map(str::trim) {
        if line.starts_with("table(") {
            kind = Some("table");
            args.clear();
        } else if line.starts_with("ledgerTable(") {
            kind = Some("ledger");
            args.clear();
        }
        if kind.is_some() {
            args.extend(quoted_values(line));
            if line.ends_with("),") {
                if kind.take().is_some() {
                    insert_source_row(&mut rows, &args);
                }
                args.clear();
            }
        }
    }
    rows
}

fn insert_source_row(rows: &mut BTreeMap<String, Row>, args: &[String]) {
    let Some(name) = args.first() else {
        return;
    };
    let class_index = 1;
    let group_index = 2;
    if let (Some(data_class), Some(group)) = (args.get(class_index), args.get(group_index)) {
        rows.insert(
            name.clone(),
            Row {
                data_class: data_class.clone(),
                group: group.clone(),
            },
        );
    }
}

fn docs_rows(text: &str) -> BTreeMap<String, Row> {
    let mut rows = BTreeMap::new();
    for line in text.lines().map(str::trim) {
        if !line.starts_with("| `") {
            continue;
        }
        let cells: Vec<&str> = line.split('|').map(str::trim).collect();
        if let (Some(name), Some(data_class), Some(group)) = (
            cells.get(1).and_then(|cell| code(cell)),
            cells.get(2).and_then(|cell| code(cell)),
            cells.get(3).and_then(|cell| code(cell)),
        ) {
            rows.insert(name, Row { data_class, group });
        }
    }
    rows
}

fn quoted_values(line: &str) -> Vec<String> {
    let mut values = Vec::new();
    let mut rest = line;
    while let Some(start) = rest.find('\'') {
        let Some(after_start) = rest.get(start + 1..) else {
            break;
        };
        let Some(end) = after_start.find('\'') else {
            break;
        };
        if let Some(value) = after_start.get(..end) {
            values.push(value.to_owned());
        }
        rest = match after_start.get(end + 1..) {
            Some(next) => next,
            None => break,
        };
    }
    values
}

fn code(cell: &str) -> Option<String> {
    let start = cell.find('`')?;
    let rest = cell.get(start + 1..)?;
    let end = rest.find('`')?;
    rest.get(..end).map(ToOwned::to_owned)
}
