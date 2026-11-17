//! Owner-signed fences survive contributor removal and future stale writers.
use super::*;
use std::collections::BTreeSet;
pub(super) fn apply_deletions(
    context: Context,
    incoming: &[(NostrEvent, Record)],
) -> Result<Context, &'static str> {
    let events = context.checked()?;
    let mut rows: BTreeMap<_, _> = context
        .rows
        .into_iter()
        .map(|row| (row.id.clone(), row))
        .collect();
    for (event, row) in incoming {
        if lkjstr_protocol::tags::tag_values(event, "e")
            .iter()
            .any(|id| {
                events
                    .get(id)
                    .is_some_and(|known| known.pubkey == event.pubkey)
                    || (id == &context.target && event.pubkey == context.author)
            })
        {
            rows.insert(row.id.clone(), row.clone());
        }
    }
    let mut deleted = BTreeSet::new();
    for row in rows.values() {
        if let Ok(Restored::Verified(event)) = row.restore()
            && event.kind == 5
        {
            deleted.extend(
                lkjstr_protocol::tags::tag_values(&event, "e")
                    .into_iter()
                    .map(|id| (id, event.pubkey.clone())),
            );
        }
    }
    rows.retain(|id, row| match row.restore() {
        Ok(Restored::Verified(event)) => {
            event.kind == 5 || !deleted.contains(&(id.clone(), event.pubkey))
        }
        _ => false,
    });
    let zaps = context
        .zaps
        .into_iter()
        .filter(|zap| rows.contains_key(&zap.id))
        .collect();
    Context::from_rows(
        context.target,
        context.author,
        context.seen_at,
        context.lineage,
        context.generation,
        rows.into_values().collect(),
        zaps,
    )
}
