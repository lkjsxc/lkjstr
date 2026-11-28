use super::*;
use lkjstr_core::engine::avatars::cache;
use records::Record;
use std::collections::BTreeSet;
pub(super) fn apply(
    tx: &IdbTransaction,
    reads: &Reads,
    key: &str,
    change: &Change,
    observer: Option<&Observer>,
    evicted: &mut Vec<KeyHash>,
) -> Result<Option<Picture>, JsValue> {
    let record_value = reads.entries.result()?;
    let blob_value = reads.blob.result()?;
    let totals = records::totals(reads.meta.result()?);
    let entries = tx.object_store("entries")?;
    let meta = tx.object_store("meta")?;
    match change {
        Change::Lookup => {
            if record_value.is_undefined() && blob_value.is_undefined() {
                return Ok(None);
            }
            let found: Result<_, JsValue> = (|| {
                let record: Record = records::decode(record_value)?;
                if record.entry.key != key {
                    return Err("avatar-cache-key".into());
                }
                let picture = record
                    .picture(blob_value)
                    .ok_or(JsValue::from_str("avatar-cache-blob"))?;
                let (totals, entry) = cache::touch(totals?, &record.entry)
                    .map_err(|_| JsValue::from_str("avatar-cache-accounting"))?;
                Ok((picture, totals, entry, record.public_provenance))
            })();
            match found {
                Ok((picture, totals, entry, public_provenance)) => {
                    records::write(
                        &entries,
                        key,
                        &Record::new(entry, &picture, public_provenance),
                    )?;
                    records::write(&meta, "totals", &totals)?;
                    Ok(Some(picture))
                }
                Err(_) => {
                    records::reset(tx)?;
                    Ok(None)
                }
            }
        }
        Change::Put(candidate, public) => {
            let rows = records::decode::<Vec<Record>>(record_value);
            let prepared: Result<_, JsValue> = (|| {
                let rows = rows?;
                let totals = totals?;
                let prior = rows.iter().find(|record| record.entry.key == key);
                let prior_blob = match prior {
                    Some(record) => Some(
                        record
                            .picture(blob_value)
                            .ok_or(JsValue::from_str("avatar-cache-blob"))?,
                    ),
                    None => None,
                };
                let index: Vec<_> = rows.iter().map(|record| record.entry.clone()).collect();
                let plan = cache::insert(totals, &index, key, candidate.blob.size() as u64)
                    .map_err(|_| JsValue::from_str("avatar-cache-accounting"))?;
                if let Some(observer) = observer {
                    observe_evictions(
                        observer,
                        &rows,
                        &plan,
                        evicted,
                        crate::browser::fetch_observation::clock,
                    );
                }
                // Reusing an existing Blob does not prove how it was first cached.
                let public_provenance = prior.map_or(*public, |row| row.public_provenance);
                let picture = prior_blob.unwrap_or_else(|| candidate.clone());
                Ok((plan, picture, public_provenance))
            })();
            let (plan, picture, public_provenance) = match prepared {
                Ok(value) => value,
                Err(_) => {
                    records::reset(tx)?;
                    (
                        cache::insert(
                            cache::Totals::default(),
                            &[],
                            key,
                            candidate.blob.size() as u64,
                        )
                        .map_err(|_| JsValue::from_str("avatar-cache-accounting"))?,
                        candidate.clone(),
                        *public,
                    )
                }
            };
            let blobs = tx.object_store("blobs")?;
            for key in &plan.remove {
                entries.delete(&key.as_str().into())?;
                blobs.delete(&key.as_str().into())?;
            }
            if !plan.existing {
                blobs.put_with_key(picture.blob.as_ref(), &key.into())?;
            }
            records::write(
                &entries,
                key,
                &Record::new(plan.entry, &picture, public_provenance),
            )?;
            records::write(&meta, "totals", &plan.totals)?;
            Ok(Some(picture))
        }
    }
}

/// Observe only rows whose insertion was explicitly public. The LRU plan still
/// includes every row; this projection must never affect the transaction.
fn observe_evictions(
    observer: &Observer,
    rows: &[Record],
    plan: &cache::Plan,
    evicted: &mut Vec<KeyHash>,
    clock: impl FnOnce() -> u64,
) {
    let decisions = observer.decisions_enabled();
    if !decisions && plan.remove.is_empty() {
        return;
    }
    let public: BTreeSet<_> = rows
        .iter()
        .filter(|row| row.public_provenance)
        .map(|row| row.entry.key.as_str())
        .collect();
    let removed = || {
        plan.remove
            .iter()
            .map(String::as_str)
            .filter(|key| public.contains(key))
    };
    if decisions {
        observer.decision(
            lkjstr_core::engine::fetch_records::Action::Keep,
            clock(),
            rows.iter()
                .filter(|row| row.public_provenance && row.entry.key != plan.entry.key)
                .map(|row| (row.entry.key.as_str(), Some(row.entry.used))),
            removed(),
        );
    }
    evicted.extend(removed().filter_map(|key| observer.key(key)));
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_core::engine::avatars::MAX_DERIVED_BYTES;
    use lkjstr_core::engine::fetch_records::Action;

    // Decode the same serde shape as IDB, including the pre-provenance schema.
    fn row(name: &str, bytes: u64, used: u64, public: Option<bool>) -> serde_json::Result<Record> {
        let mut value = serde_json::json!({
            "entry": {"key": format!("https://image.test/{name}"), "bytes": bytes, "used": used},
            "edge": 160, "source_width": 160, "source_height": 160, "mime": "image/webp",
        });
        if let Some(public) = public {
            value["public_provenance"] = public.into();
        }
        serde_json::from_value(value)
    }

    #[test]
    fn fetch_records_avatar_evictions_exclude_unprovenanced_idb_rows()
    -> Result<(), Box<dyn std::error::Error>> {
        let mut rows = vec![
            row("historical", 1, 1, None)?,
            row("public-victim", 1, 2, Some(true))?,
            row("private", 1, 3, Some(false))?,
            row("public-retained", 1, 4, Some(true))?,
        ];
        let mut remaining = cache::MAX_BYTES - 4;
        while remaining > 0 {
            let bytes = remaining.min(MAX_DERIVED_BYTES);
            let used = rows.len() as u64 + 1;
            rows.push(row(&format!("older-schema-{used}"), bytes, used, None)?);
            remaining -= bytes;
        }
        let index: Vec<_> = rows.iter().map(|r| r.entry.clone()).collect();
        let totals = cache::Totals {
            bytes: cache::MAX_BYTES,
            entries: index.len(),
            sequence: index.len() as u64,
        };
        let plan = cache::insert(totals, &index, "https://image.test/new", 3)
            .map_err(|error| format!("LRU plan: {error:?}"))?;
        assert_eq!(
            plan.remove,
            index[..3].iter().map(|r| r.key.clone()).collect::<Vec<_>>()
        );
        assert!(!rows[0].public_provenance);
        assert!(!rows[2].public_provenance);
        for decisions in [false, true] {
            let observer = Observer::default();
            observer.set_decisions(decisions);
            let victim = observer.key(&index[1].key).ok_or("hash")?;
            let retained = observer.key(&index[3].key).ok_or("hash")?;
            let mut evicted = Vec::new();
            observe_evictions(&observer, &rows, &plan, &mut evicted, || 10);
            assert_eq!(evicted, [victim]);
            observer.inspect(|ledger| {
                assert_eq!(ledger.decisions().count(), usize::from(decisions));
                if let Some(decision) = ledger.decisions().next() {
                    assert_eq!(decision.action, Action::Keep);
                    assert_eq!(decision.chosen, [victim]);
                    assert_eq!(decision.omitted, 0);
                    assert_eq!(decision.chosen_omitted, 0);
                    assert_eq!(
                        decision
                            .candidates
                            .iter()
                            .map(|c| c.key)
                            .collect::<Vec<_>>(),
                        [victim, retained]
                    );
                }
            });
            // Only the post-commit receipt goes into ghost history.
            for key in evicted {
                observer.evicted(ResourceClass::Avatars, key);
            }
            for key in [&index[0].key, &index[2].key, &index[3].key] {
                observer.refetched(ResourceClass::Avatars, key);
            }
            assert_eq!(
                observer.inspect(|l| l
                    .totals
                    .get(&ResourceClass::Avatars)
                    .map_or(0, |t| t.ghost_hits)),
                0
            );
            observer.refetched(ResourceClass::Avatars, &index[1].key);
            assert_eq!(
                observer.inspect(|l| l.totals[&ResourceClass::Avatars].ghost_hits),
                1
            );
        }
        Ok(())
    }
}
