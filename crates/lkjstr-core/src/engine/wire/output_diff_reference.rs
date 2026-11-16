//! Historical operation ordering retained only as a test oracle.
use serde_json::{Value, json};
pub(super) fn diff(old: &[Value], next: &[Value]) -> Vec<Value> {
    let mut ops = Vec::new();
    let mut order = old.iter().map(|r| r["key"].clone()).collect::<Vec<_>>();
    for row in old {
        if !next.iter().any(|r| r["key"] == row["key"]) {
            ops.push(json!({"op":"remove","key":row["key"]}));
            order.retain(|k| *k != row["key"]);
        }
    }
    for (i, row) in next.iter().enumerate().rev() {
        let key = row["key"].clone();
        let before = next
            .get(i + 1)
            .map(|r| r["key"].clone())
            .unwrap_or(Value::Null);
        let old_at = order.iter().position(|k| *k == key);
        let follows =
            old_at.is_some_and(|at| order.get(at + 1).cloned().unwrap_or(Value::Null) == before);
        if !follows {
            if old_at.is_some() {
                ops.push(json!({"op":"remove","key":key}));
                order.retain(|k| *k != key);
            }
            ops.push(json!({"op":"insert","before":before,"rows":[row]}));
            let at = order
                .iter()
                .position(|k| *k == before)
                .unwrap_or(order.len());
            order.insert(at, key);
        } else if old.iter().find(|r| r["key"] == key) != Some(row) {
            ops.push(json!({"op":"update","row":row}));
        }
    }
    ops
}
