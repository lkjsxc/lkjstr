//! NIP-01 filters and NIP-50 search. Exact IDs, never implicit prefix matching.
use crate::{
    Error, Result,
    event::{Event, values},
    unhex,
};
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;

/// Wire-compatible query filter; omitted and empty lists are distinct.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct Filter {
    /// Exact lowercase event IDs.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ids: Option<Vec<String>>,
    /// Exact lowercase authors.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub authors: Option<Vec<String>>,
    /// Allowed kinds.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub kinds: Option<Vec<u16>>,
    /// Inclusive lower timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub since: Option<u64>,
    /// Inclusive upper timestamp.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub until: Option<u64>,
    /// Initial query limit only, ignored by live matching.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub limit: Option<usize>,
    /// NIP-50 query, interpreted only by an explicit policy.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub search: Option<String>,
    /// Indexed single-letter filters, including their `#` prefix.
    #[serde(flatten)]
    pub tags: BTreeMap<String, Vec<String>>,
}
impl Filter {
    /// Validate exact IDs and indexed tag names before sending to a relay.
    pub fn validate(&self) -> Result<()> {
        for list in [&self.ids, &self.authors].into_iter().flatten() {
            for value in list {
                unhex::<32>(value)?;
            }
        }
        for (key, values) in &self.tags {
            if key.len() != 2 || !key.starts_with('#') || !key.as_bytes()[1].is_ascii_alphabetic() {
                return Err(Error::Invalid);
            }
            if key == "#e" || key == "#p" {
                for value in values {
                    unhex::<32>(value)?;
                }
            }
        }
        Ok(())
    }
    /// Live event matching. NIP-50 requires `matches_with_search`.
    pub fn matches(&self, event: &Event) -> Result<bool> {
        if self.search.is_some() {
            return Err(Error::SearchPolicy);
        }
        self.matches_with_search(event, |_, _| false)
    }
    /// Match ANDed fields; list elements are ORed. Limit is intentionally ignored.
    pub fn matches_with_search(
        &self,
        event: &Event,
        search: impl Fn(&str, &Event) -> bool,
    ) -> Result<bool> {
        self.validate()?;
        let e = &event.data;
        Ok(self.ids.as_ref().is_none_or(|ids| ids.contains(&event.id))
            && self
                .authors
                .as_ref()
                .is_none_or(|authors| authors.contains(&e.pubkey))
            && self
                .kinds
                .as_ref()
                .is_none_or(|kinds| kinds.contains(&e.kind))
            && self.since.is_none_or(|t| e.created_at >= t)
            && self.until.is_none_or(|t| e.created_at <= t)
            && self.tags.iter().all(|(key, allowed)| {
                values(&e.tags, &key[1..]).any(|v| allowed.iter().any(|a| a == v))
            })
            && self
                .search
                .as_ref()
                .is_none_or(|query| search(query, event)))
    }
}
/// OR across a subscription's filters. Empty subscriptions match nothing.
pub fn matches_any(filters: &[Filter], event: &Event) -> Result<bool> {
    let mut matched = false;
    for filter in filters {
        matched |= filter.matches(event)?;
    }
    Ok(matched)
}
