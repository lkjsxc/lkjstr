use super::*;
use lkjstr_core::engine::avatars::cache;
use records::Record;
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
                Ok((picture, totals, entry))
            })();
            match found {
                Ok((picture, totals, entry)) => {
                    records::write(&entries, key, &Record::new(entry, &picture))?;
                    records::write(&meta, "totals", &totals)?;
                    Ok(Some(picture))
                }
                Err(_) => {
                    records::reset(tx)?;
                    Ok(None)
                }
            }
        }
        Change::Put(candidate) => {
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
                    if observer.decisions_enabled() {
                        observer.decision(
                            lkjstr_core::engine::fetch_records::Action::Keep,
                            crate::browser::fetch_observation::clock(),
                            index
                                .iter()
                                .filter(|row| row.key != key)
                                .map(|row| (row.key.as_str(), Some(row.used))),
                            plan.remove.iter().map(String::as_str),
                        );
                    }
                    evicted.extend(plan.remove.iter().filter_map(|key| observer.key(key)));
                }
                let picture = prior_blob.unwrap_or_else(|| candidate.clone());
                Ok((plan, picture))
            })();
            let (plan, picture) = match prepared {
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
            records::write(&entries, key, &Record::new(plan.entry, &picture))?;
            records::write(&meta, "totals", &plan.totals)?;
            Ok(Some(picture))
        }
    }
}
