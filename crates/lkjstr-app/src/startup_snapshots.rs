use std::collections::BTreeMap;

use lkjstr_domain::Workspace;
use lkjstr_storage::{TabStateRecord, tab_state_id};

pub fn startup_snapshot_state(
    workspace: &Workspace,
    snapshots: Vec<TabStateRecord>,
    cap: usize,
) -> (BTreeMap<String, TabStateRecord>, Vec<String>) {
    let mut by_id = BTreeMap::new();
    for row in snapshots {
        if accepts_snapshot(workspace, &row) {
            insert_newest(&mut by_id, row);
        }
    }
    let mut rows = by_id.into_values().collect::<Vec<_>>();
    rows.sort_by(|left, right| {
        left.updated_at
            .cmp(&right.updated_at)
            .then_with(|| left.tab_id.cmp(&right.tab_id))
    });
    let start = rows.len().saturating_sub(cap);
    let mut map = BTreeMap::new();
    let mut order = Vec::new();
    for row in rows.into_iter().skip(start) {
        order.push(row.tab_id.clone());
        map.insert(row.id.clone(), row);
    }
    (map, order)
}

fn accepts_snapshot(workspace: &Workspace, row: &TabStateRecord) -> bool {
    row.workspace_id == workspace.id
        && row.id == tab_state_id(&workspace.id, &row.tab_id)
        && workspace.tabs.contains_key(&row.tab_id)
}

fn insert_newest(rows: &mut BTreeMap<String, TabStateRecord>, row: TabStateRecord) {
    match rows.get(&row.id) {
        Some(existing) if existing.updated_at > row.updated_at => {}
        _ => {
            rows.insert(row.id.clone(), row);
        }
    }
}
