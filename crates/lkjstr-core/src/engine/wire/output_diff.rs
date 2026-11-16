//! Keyed row changes keep their established operation order without rescanning rows.
use serde_json::{Value, json};
use std::{
    cmp::Ordering,
    collections::{BTreeMap, BTreeSet},
};

#[derive(Clone, Copy)]
struct Key<'a> {
    value: &'a str,
    #[cfg(test)]
    compare: &'a dyn Fn(),
}
impl PartialEq for Key<'_> {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}
impl Eq for Key<'_> {}
impl Ord for Key<'_> {
    fn cmp(&self, other: &Self) -> Ordering {
        #[cfg(test)]
        (self.compare)();
        self.value.cmp(other.value)
    }
}
impl PartialOrd for Key<'_> {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
#[derive(Clone, Copy, Default)]
struct Link {
    previous: Option<usize>,
    next: Option<usize>,
    present: bool,
}

pub(super) fn diff(old: &[Value], next: &[Value]) -> Vec<Value> {
    diff_inner(
        old,
        next,
        #[cfg(test)]
        &|| {},
    )
}

fn diff_inner(old: &[Value], next: &[Value], #[cfg(test)] compare: &dyn Fn()) -> Vec<Value> {
    let key = |value| Key {
        value,
        #[cfg(test)]
        compare,
    };
    let Some(old_keys): Option<Vec<_>> =
        old.iter().map(|row| row["key"].as_str().map(key)).collect()
    else {
        return replace(old, next);
    };
    let Some(next_keys): Option<Vec<_>> = next
        .iter()
        .map(|row| row["key"].as_str().map(key))
        .collect()
    else {
        return replace(old, next);
    };
    let mut indices: BTreeMap<_, _> = old_keys.iter().copied().zip(0..old.len()).collect();
    let wanted: BTreeSet<_> = next_keys.iter().copied().collect();
    if indices.len() != old.len() || wanted.len() != next.len() {
        return replace(old, next);
    }
    let mut links: Vec<_> = (0..old.len())
        .map(|index| Link {
            previous: index.checked_sub(1),
            next: (index + 1 < old.len()).then_some(index + 1),
            present: true,
        })
        .collect();
    for key in &next_keys {
        indices.entry(*key).or_insert_with(|| {
            links.push(Link::default());
            links.len() - 1
        });
    }
    let mut tail = old.len().checked_sub(1);
    let mut ops = Vec::new();
    for (index, key) in old_keys.iter().enumerate() {
        if !wanted.contains(key) {
            ops.push(json!({"op":"remove","key":key.value}));
            unlink(&mut links, &mut tail, index);
        }
    }
    let mut before = None;
    let mut before_key: Option<&str> = None;
    for (row, key) in next.iter().zip(&next_keys).rev() {
        let index = indices[key];
        let follows = links[index].present && links[index].next == before;
        if !follows {
            if links[index].present {
                ops.push(json!({"op":"remove","key":key.value}));
                unlink(&mut links, &mut tail, index);
            }
            ops.push(json!({"op":"insert","before":before_key,"rows":[row]}));
            insert(&mut links, &mut tail, index, before);
        } else if old.get(index) != Some(row) {
            ops.push(json!({"op":"update","row":row}));
        }
        before = Some(index);
        before_key = Some(key.value);
    }
    ops
}

fn unlink(links: &mut [Link], tail: &mut Option<usize>, index: usize) {
    let link = links[index];
    if let Some(previous) = link.previous {
        links[previous].next = link.next;
    }
    if let Some(next) = link.next {
        links[next].previous = link.previous;
    } else {
        *tail = link.previous;
    }
    links[index] = Link::default();
}

fn insert(links: &mut [Link], tail: &mut Option<usize>, index: usize, before: Option<usize>) {
    let previous = before.map_or(*tail, |before| links[before].previous);
    if let Some(previous) = previous {
        links[previous].next = Some(index);
    }
    if let Some(before) = before {
        links[before].previous = Some(index);
    } else {
        *tail = Some(index);
    }
    links[index] = Link {
        previous,
        next: before,
        present: true,
    };
}

fn replace(old: &[Value], next: &[Value]) -> Vec<Value> {
    let mut ops: Vec<_> = old
        .iter()
        .map(|row| json!({"op":"remove","key":row["key"]}))
        .collect();
    if !next.is_empty() {
        ops.push(json!({"op":"insert","before":null,"rows":next}));
    }
    ops
}

#[cfg(test)]
pub(super) fn measured(old: &[Value], next: &[Value]) -> (Vec<Value>, usize) {
    let comparisons = std::cell::Cell::new(0);
    let ops = diff_inner(old, next, &|| comparisons.set(comparisons.get() + 1));
    (ops, comparisons.get())
}

#[cfg(test)]
#[path = "output_diff_test.rs"]
mod tests;
