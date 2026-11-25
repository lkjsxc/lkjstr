//! One signed witness per possible deletion target, rather than every kind 5.
use super::Entry;
use lkjstr_nips::address::Coordinate;
use lkjstr_protocol::{compare_events_desc, is_event_id};
use std::collections::{BTreeMap, BTreeSet, HashMap};

type Target = (String, String, String);

pub(super) fn select(
    known: &HashMap<String, String>,
    fences: &HashMap<String, Entry>,
) -> BTreeSet<String> {
    // Unknown targets can have durable bodies outside this checkpoint. Only an
    // available verified body can disprove the signed deletion's authority.
    let mut witnesses: BTreeMap<Target, &Entry> = BTreeMap::new();
    for entry in fences.values() {
        for tag in &entry.event.tags {
            let [kind, target, ..] = tag.as_slice() else {
                continue;
            };
            let target = match kind.as_str() {
                "e" if is_event_id(target)
                    && known
                        .get(target)
                        .is_none_or(|author| author == &entry.event.pubkey) =>
                {
                    target.clone()
                }
                "a" => {
                    let Ok(address) = Coordinate::parse(target) else {
                        continue;
                    };
                    if address.pubkey != entry.event.pubkey {
                        continue;
                    }
                    address.to_string()
                }
                _ => continue,
            };
            let key = (kind.clone(), target, entry.event.pubkey.clone());
            let witness = witnesses.entry(key).or_insert(entry);
            if compare_events_desc(&entry.event, &witness.event).is_lt() {
                *witness = entry;
            }
        }
    }
    // Distinct possible targets can still exceed the hard checkpoint budget.
    // The caller aborts that optional cache transaction rather than lose evidence.
    witnesses
        .into_values()
        .map(|entry| entry.event.id.clone())
        .collect()
}
