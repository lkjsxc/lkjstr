use leptos::prelude::*;
use lkjstr_storage::{StorageByteInventoryRow, StorageStatsSnapshot};

pub(crate) fn storage_byte_rows(snapshot: Option<StorageStatsSnapshot>) -> impl IntoView {
    match snapshot {
        Some(snapshot) => snapshot
            .byte_rows
            .into_iter()
            .map(byte_row_view)
            .collect_view()
            .into_any(),
        None => view! {
            <tr><td colspan="4">"Loading storage byte summary"</td></tr>
        }
        .into_any(),
    }
}

fn byte_row_view(row: StorageByteInventoryRow) -> impl IntoView {
    let StorageByteInventoryRow {
        label,
        group,
        status,
        bytes,
        problem_reason,
        ..
    } = row;
    let value = bytes.map_or_else(
        || problem_reason.unwrap_or_else(|| status.clone()),
        |bytes| bytes.to_string(),
    );
    view! {
        <tr>
            <td>{label}</td>
            <td>{group}</td>
            <td>{status}</td>
            <td>{value}</td>
        </tr>
    }
}
