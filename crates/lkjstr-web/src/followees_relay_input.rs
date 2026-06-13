use std::collections::BTreeSet;

use lkjstr_protocol::{KIND_FOLLOW_LIST, NostrEvent, NostrFilter};

#[derive(Clone)]
pub(crate) struct FolloweesRelayReadInput {
    pub(crate) owner: String,
    pub(crate) target_pubkey: String,
    pub(crate) relays: Vec<String>,
}

pub(crate) struct FolloweesRelayInputSeed<'a> {
    pub(crate) owner: &'a str,
    pub(crate) target_pubkey: &'a str,
    pub(crate) selected_relays: &'a [String],
}

pub(crate) fn followees_relay_input(
    seed: FolloweesRelayInputSeed<'_>,
) -> Option<FolloweesRelayReadInput> {
    let relays = unique_sorted(seed.selected_relays.iter().cloned());
    if relays.is_empty() {
        return None;
    }
    Some(FolloweesRelayReadInput {
        owner: seed.owner.to_owned(),
        target_pubkey: seed.target_pubkey.to_owned(),
        relays,
    })
}

pub(crate) fn followees_relay_filters(
    input: &FolloweesRelayReadInput,
    relay: &str,
) -> Vec<NostrFilter> {
    if !input.relays.iter().any(|item| item == relay) {
        return Vec::new();
    }
    vec![NostrFilter {
        authors: Some(vec![input.target_pubkey.clone()]),
        kinds: Some(vec![KIND_FOLLOW_LIST]),
        limit: Some(1),
        ..NostrFilter::default()
    }]
}

pub(crate) fn followees_event_matches_read(
    input: &FolloweesRelayReadInput,
    event: &NostrEvent,
) -> bool {
    event.pubkey == input.target_pubkey && event.kind == KIND_FOLLOW_LIST
}

fn unique_sorted(values: impl Iterator<Item = String>) -> Vec<String> {
    values.collect::<BTreeSet<_>>().into_iter().collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    use lkjstr_protocol::KIND_TEXT_NOTE;

    #[test]
    fn selected_relays_create_follow_list_filter() -> Result<(), &'static str> {
        let input = followees_relay_input(FolloweesRelayInputSeed {
            owner: "followees-tab",
            target_pubkey: &pubkey("a"),
            selected_relays: &[
                "wss://b.example".to_owned(),
                "wss://a.example".to_owned(),
                "wss://b.example".to_owned(),
            ],
        })
        .ok_or("missing relay input")?;
        let filters = followees_relay_filters(&input, "wss://a.example");

        assert_eq!(input.relays, vec!["wss://a.example", "wss://b.example"]);
        assert_eq!(
            filters.first().and_then(|filter| filter.kinds.clone()),
            Some(vec![KIND_FOLLOW_LIST])
        );
        assert_eq!(
            filters.first().and_then(|filter| filter.authors.clone()),
            Some(vec![pubkey("a")])
        );
        assert_eq!(filters.first().and_then(|filter| filter.limit), Some(1));
        Ok(())
    }

    #[test]
    fn match_requires_target_follow_list() -> Result<(), &'static str> {
        let input = followees_relay_input(FolloweesRelayInputSeed {
            owner: "followees-tab",
            target_pubkey: &pubkey("a"),
            selected_relays: &["wss://a.example".to_owned()],
        })
        .ok_or("missing relay input")?;

        assert!(followees_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("a"))
        ));
        assert!(!followees_event_matches_read(
            &input,
            &event(KIND_TEXT_NOTE, &pubkey("a"))
        ));
        assert!(!followees_event_matches_read(
            &input,
            &event(KIND_FOLLOW_LIST, &pubkey("b"))
        ));
        Ok(())
    }

    fn event(kind: u64, pubkey: &str) -> NostrEvent {
        NostrEvent {
            id: "1".repeat(64),
            pubkey: pubkey.to_owned(),
            created_at: 3_000,
            kind,
            tags: Vec::new(),
            content: String::new(),
            sig: "f".repeat(128),
        }
    }

    fn pubkey(value: &str) -> String {
        value.repeat(64)
    }
}
