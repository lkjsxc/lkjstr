//! Pure publication routing. Own routes precede reply context and NIP-65 inboxes.
use super::settings::strict_relay;
use serde::{Deserialize, Serialize};
use std::collections::BTreeSet;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Destination {
    pub url: String,
    pub rule: String,
    pub state: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}
#[derive(Default)]
pub struct PublicationInput {
    pub own: Vec<String>,
    pub context: Vec<String>,
    pub inboxes: Vec<Vec<String>>,
    pub deletion: bool,
}
/// Inputs are bounded by the caller: 128 own (old + new lists), 32 recipients x 64 inboxes,
/// and 64 context routes. Selection is stable and duplicates cost no budget.
pub fn plan(input: PublicationInput) -> Vec<Destination> {
    let mut out = Vec::new();
    let mut selected = BTreeSet::new();
    let mut own = 0;
    let mut extra = 0;
    let mut add = |raw: String, rule: &str, limit: usize, used: &mut usize, reason: &str| {
        let Some(url) = strict_relay(&raw) else {
            return;
        };
        if selected.contains(&url) {
            return;
        }
        let capacity = selected.len()
            >= if input.deletion {
                NOTE_ROUTE_LIMIT + 64
            } else {
                64
            };
        let skipped = capacity || *used >= limit;
        if !skipped {
            selected.insert(url.clone());
            *used += 1;
        }
        // A later rule may select a destination excluded by an earlier cap.
        out.retain(|d: &Destination| d.url != url);
        out.push(Destination {
            url,
            rule: rule.into(),
            state: if skipped { "skipped" } else { "pending" }.into(),
            reason: skipped.then(|| if capacity { "capacity" } else { reason }.into()),
        });
    };
    for url in input.own {
        add(url, "own", 12, &mut own, "own-cap");
    }
    for url in input.context {
        add(
            url,
            if input.deletion { "delete" } else { "reply" },
            if input.deletion {
                NOTE_ROUTE_LIMIT + 64
            } else {
                8
            },
            &mut extra,
            "inbox-cap",
        );
    }
    for urls in input.inboxes {
        let mut person = 0;
        let mut seen = BTreeSet::new();
        for url in urls {
            let Some(url) = strict_relay(&url) else {
                continue;
            };
            if !seen.insert(url.clone()) {
                continue;
            }
            if person >= 2 {
                add(url, "inbox", 0, &mut extra, "person-cap");
            } else {
                add(url, "inbox", 8, &mut extra, "inbox-cap");
            }
            person += 1;
        }
    }
    out
}

/// Note fanout includes long write and inbox lists. Keep the active plan bounded.
pub(super) const NOTE_ROUTE_LIMIT: usize = 128;

pub(super) fn plan_note(input: PublicationInput) -> Vec<Destination> {
    let mut seen = BTreeSet::new();
    let mut out = Vec::new();
    let mut add = |urls: Vec<String>, rule: &str| {
        for url in urls.into_iter().filter_map(|url| strict_relay(&url)) {
            if seen.insert(url.clone()) {
                let skipped = out.len() >= NOTE_ROUTE_LIMIT;
                out.push(Destination {
                    url,
                    rule: rule.into(),
                    state: if skipped { "skipped" } else { "pending" }.into(),
                    reason: skipped.then(|| "capacity".into()),
                });
            }
        }
    };
    add(input.own, "own");
    add(input.context, "reply");
    for urls in input.inboxes {
        add(urls, "inbox");
    }
    out
}
