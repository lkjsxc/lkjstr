//! Atomic writers union immutable contributors and remove only owner-signed deletions.
use super::delete::apply_deletions;
use super::*;
use std::collections::BTreeSet;

pub(super) fn checkpoint(raw: &str) -> Result<Checkpoint, &'static str> {
    if raw.len() > CONTEXT_BYTES {
        return Err("read context cache exceeds byte budget");
    }
    let data: Checkpoint = serde_json::from_str(raw).map_err(|_| "invalid read context cache")?;
    if data.format != 1
        || data.generation == 0
        || !lkjstr_protocol::is_event_id(&data.epoch)
        || data.contexts.len() > CONTEXT_TARGETS
        || data
            .contexts
            .iter()
            .map(|context| context.rows.len())
            .sum::<usize>()
            > CONTEXT_RECORDS
    {
        return Err("unsupported read context cache");
    }
    let mut ids = BTreeSet::new();
    for context in &data.contexts {
        context.checked()?;
        if context.lineage.is_empty()
            || context.generation > data.generation
            || !ids.insert(&context.target)
        {
            return Err("invalid committed read context");
        }
    }
    Ok(data)
}
pub fn read_contexts(raw: Option<&str>) -> Result<Vec<Context>, &'static str> {
    raw.map_or_else(|| Ok(vec![]), |raw| Ok(checkpoint(raw)?.contexts))
}

pub fn merge_contexts(
    previous: Option<&str>,
    incoming: &[Context],
    deletions: &[Record],
    seed: &str,
    limits: Limits,
) -> Result<String, &'static str> {
    let limits = limits.bounded();
    // A malformed contributor checkpoint must not become new authority for zero.
    let old = match previous {
        Some(raw) => checkpoint(raw)?,
        None if lkjstr_protocol::is_event_id(seed) => Checkpoint {
            format: 1,
            epoch: seed.to_owned(),
            generation: 0,
            contexts: vec![],
        },
        _ => return Err("read context epoch missing"),
    };
    let generation = old
        .generation
        .checked_add(1)
        .ok_or("read context clock exhausted")?;
    let mut contexts: BTreeMap<_, _> = old
        .contexts
        .into_iter()
        .map(|context| (context.target.clone(), context))
        .collect();
    let tokens: BTreeMap<_, _> = contexts
        .iter()
        .map(|(id, c)| (id.clone(), c.token.clone()))
        .collect();
    for context in incoming {
        context.checked()?;
        let next = if let Some(old) = contexts.remove(&context.target) {
            if old.author != context.author {
                return Err("read context owner changed");
            }
            let mut rows: BTreeMap<_, _> = old
                .rows
                .into_iter()
                .map(|row| (row.id.clone(), row))
                .collect();
            for row in &context.rows {
                rows.entry(row.id.clone()).or_insert_with(|| row.clone());
            }
            // Evict a whole context if its union no longer fits. Never label a
            // truncated set complete or retain its old lineage on recreation.
            if rows.len() > CONTEXT_RECORDS {
                continue;
            }
            let mut zaps: BTreeMap<_, _> = old
                .zaps
                .into_iter()
                .map(|zap| (zap.id.clone(), zap))
                .collect();
            for zap in &context.zaps {
                zaps.entry(zap.id.clone())
                    .and_modify(|old| {
                        if old.pending() && !zap.pending() {
                            *old = zap.clone();
                        }
                    })
                    .or_insert_with(|| zap.clone());
            }
            Context::from_rows(
                context.target.clone(),
                context.author.clone(),
                old.seen_at.max(context.seen_at),
                old.lineage,
                old.generation,
                rows.into_values().collect(),
                zaps.into_values().collect(),
            )?
        } else {
            Context::from_rows(
                context.target.clone(),
                context.author.clone(),
                context.seen_at,
                String::new(),
                0,
                context.rows.clone(),
                context.zaps.clone(),
            )?
        };
        contexts.insert(next.target.clone(), next);
    }
    let mut fences = Vec::new();
    for row in deletions {
        let Ok(Restored::Verified(event)) = row.restore() else {
            return Err("unverified read context deletion");
        };
        if event.kind == 5 {
            fences.push((event, row.clone()));
        }
    }
    let mut bounded = Vec::new();
    for context in contexts.into_values() {
        let mut context = apply_deletions(context, &fences)?;
        if context.lineage.is_empty() {
            let raw = serde_json::to_vec(&(&old.epoch, generation, &context.target))
                .map_err(|_| "read context lineage encoding failed")?;
            context.lineage = lkjstr_protocol::bytes_to_hex(&Sha256::digest(raw));
        }
        if tokens.get(&context.target) != Some(&context.token) {
            context.generation = generation;
        }
        context.token = token(
            &context.target,
            &context.author,
            &context.lineage,
            context.generation,
            &context.rows,
            &context.zaps,
        )?;
        bounded.push(context);
    }
    bounded.sort_by(|a, b| {
        b.seen_at
            .cmp(&a.seen_at)
            .then_with(|| a.target.cmp(&b.target))
    });
    let mut data = Checkpoint {
        format: 1,
        epoch: old.epoch,
        generation,
        contexts: vec![],
    };
    let mut identities = BTreeSet::new();
    let mut records = 0_usize;
    let mut bytes = serde_json::to_string(&data)
        .map_err(|_| "read context encoding failed")?
        .len();
    for context in bounded {
        if data.contexts.len() >= limits.targets {
            break;
        }
        let cost = serde_json::to_string(&context)
            .map_err(|_| "read context encoding failed")?
            .len()
            + usize::from(!data.contexts.is_empty());
        let extra: BTreeSet<_> = context
            .zaps
            .iter()
            .filter_map(|zap| match &zap.decision {
                super::super::zaps::Decision::Accepted { value } => Some(value.proof.clone()),
                _ => None,
            })
            .filter(|proof| !identities.contains(proof))
            .collect();
        if identities.len().saturating_add(extra.len())
            > crate::engine::zaps::MAX_HISTORICAL_IDENTITIES
            || records.saturating_add(context.rows.len()) > limits.records
            || bytes.saturating_add(cost) > limits.bytes
        {
            continue;
        }
        identities.extend(extra);
        records += context.rows.len();
        bytes += cost;
        data.contexts.push(context);
    }
    serde_json::to_string(&data).map_err(|_| "read context encoding failed")
}
