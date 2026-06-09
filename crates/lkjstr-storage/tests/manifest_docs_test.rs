use std::collections::BTreeMap;

use lkjstr_storage::storage_table_specs;

#[derive(Debug, Eq, PartialEq)]
struct DocsRow {
    command_family: String,
    retention_behavior: String,
    stats_projection: String,
}

#[test]
fn manifest_runtime_columns_match_docs() -> Result<(), String> {
    let docs = table_rows(include_str!(
        "../../../docs/architecture/data/storage/data-classes/table-manifest.md"
    ));

    for spec in storage_table_specs() {
        let row = docs
            .get(spec.name)
            .ok_or_else(|| format!("missing docs row for {}", spec.name))?;
        assert_eq!(row.command_family, spec.command_family);
        assert_eq!(row.retention_behavior, spec.retention_behavior);
        assert_eq!(row.stats_projection, spec.stats_projection);
    }
    assert_eq!(docs.len(), storage_table_specs().len());
    Ok(())
}

fn table_rows(text: &str) -> BTreeMap<String, DocsRow> {
    text.lines()
        .filter(|line| line.trim().starts_with("| `"))
        .filter_map(table_row)
        .collect()
}

fn table_row(line: &str) -> Option<(String, DocsRow)> {
    let cells = line.split('|').map(str::trim).collect::<Vec<_>>();
    Some((
        code(cells.get(1)?)?,
        DocsRow {
            command_family: code(cells.get(6)?)?,
            retention_behavior: code(cells.get(7)?)?,
            stats_projection: code(cells.get(8)?)?,
        },
    ))
}

fn code(cell: &str) -> Option<String> {
    let start = cell.find('`')?;
    let rest = cell.get(start + 1..)?;
    let end = rest.find('`')?;
    rest.get(..end).map(ToOwned::to_owned)
}
