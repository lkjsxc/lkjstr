use super::{diff, measured};
#[path = "output_diff_reference.rs"]
mod reference;
use serde_json::{Value, json};

fn row(id: usize) -> Value {
    json!({"kind":"note","key":format!("{id:064x}"),"id":format!("{id:064x}"),
        "author":{"pubkey":"a".repeat(64),"npub":"npub".repeat(16),"name":"Fixture","verified":false,"emoji":[]},
        "at":1700100000000u64+id as u64,"segments":[{"k":"text","text":format!("Fixture note {id}")}],
        "media":[],"quotes":[],"counts":{"replies":0,"reposts":0,"reactions":0,"zaps":0,"partial":false},
        "mine":{"reposted":false,"bookmarked":false,"own":false},"reactions":[]})
}

fn apply(mut rows: Vec<Value>, ops: &[Value]) -> Vec<Value> {
    for op in ops {
        let index = rows.iter().position(|row| row["key"] == op["key"]);
        match op["op"].as_str() {
            Some("remove") => {
                if let Some(index) = index {
                    rows.remove(index);
                }
            }
            Some("update") => {
                if let Some(index) = rows.iter().position(|row| row["key"] == op["row"]["key"]) {
                    rows[index] = op["row"].clone();
                }
            }
            Some("insert") => {
                let index = if op["before"].is_null() {
                    rows.len()
                } else {
                    rows.iter()
                        .position(|row| row["key"] == op["before"])
                        .unwrap_or(rows.len())
                };
                let added = op["rows"].as_array().cloned().unwrap_or_default();
                rows.splice(index..index, added);
            }
            _ => {}
        }
    }
    rows
}
fn check(old: &[Value], next: &[Value]) {
    let expected = reference::diff(old, next);
    let actual = diff(old, next);
    assert_eq!(actual, expected, "operation order changed");
    assert_eq!(apply(old.to_vec(), &actual), next);
}
fn permutations(values: &mut [usize], at: usize, visit: &mut impl FnMut(&[usize])) {
    if at == values.len() {
        visit(values);
        return;
    }
    for index in at..values.len() {
        values.swap(at, index);
        permutations(values, at + 1, visit);
        values.swap(at, index);
    }
}
#[test]
fn every_small_reorder_keeps_exact_operations_and_values() {
    let old: Vec<_> = (0..6).map(row).collect();
    permutations(&mut [0, 1, 2, 3, 4, 5], 0, &mut |order| {
        let mut next: Vec<_> = order.iter().map(|id| row(*id)).collect();
        next[2]["segments"] = json!([{"k":"text","text":"Changed"}]);
        check(&old, &next);
        next.retain(|r| r["key"] != row(0)["key"]);
        next.insert(3, row(99));
        check(&old, &next);
    });
    check(&[], &old);
    check(&old, &[]);
    check(&old, &old);
}
#[test]
fn generated_edit_sequences_preserve_insert_remove_move_update() {
    let mut state = 1u64;
    let mut rows: Vec<_> = (0..64).map(row).collect();
    let mut next_id = 64;
    for _ in 0..600 {
        state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
        let mut next = rows.clone();
        let index = (state >> 16) as usize;
        match state % 4 {
            0 if next.len() < 128 => {
                let at = index % (next.len() + 1);
                next.insert(at, row(next_id));
                next_id += 1;
            }
            1 if !next.is_empty() => {
                next.remove(index % next.len());
            }
            2 if next.len() > 1 => {
                let len = next.len();
                next.swap(index % len, (index / 3) % len);
            }
            _ if !next.is_empty() => {
                let at = index % next.len();
                next[at]["segments"] = json!([{"k":"text","text":state.to_string()}]);
            }
            _ => {}
        }
        check(&rows, &next);
        rows = next;
    }
}
#[test]
fn large_retained_diffs_have_bounded_key_comparisons() {
    let old: Vec<_> = (0..5000).map(row).collect();
    let mut next = old.clone();
    next.extend((5000..5032).map(row));
    for next in [next, old.iter().rev().cloned().collect()] {
        let (ops, comparisons) = measured(&old, &next);
        assert!(ops.len() <= old.len() + 2 * next.len());
        let n = old.len() + next.len();
        assert!(
            comparisons <= 16 * n * (n.ilog2() as usize + 1),
            "{comparisons} comparisons for {n} rows"
        );
    }
}

#[test]
fn malformed_keys_use_an_explicit_full_reset() {
    for (old, next) in [
        (
            vec![json!({"key":"same","v":1}), json!({"key":"same","v":2})],
            vec![json!({"key":"same","v":3})],
        ),
        (
            vec![json!({"key":12}), json!({"key":null})],
            vec![json!({"key":false}), json!({"key":12})],
        ),
        (
            vec![row(0)],
            vec![json!({"key":"same","v":1}), json!({"key":"same","v":2})],
        ),
    ] {
        let ops = diff(&old, &next);
        assert_eq!(apply(old.clone(), &ops), next);
        assert_eq!(ops.len(), old.len() + usize::from(!next.is_empty()));
    }
}
