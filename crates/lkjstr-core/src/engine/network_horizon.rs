//! Historical evidence from the actual filter sent on an answered relay request.
use super::*;
use crate::engine::even_history::Scope;
use std::ops::Range;

const BAND_SECONDS: u64 = 86_400;
const BANDS_PER_PASS: usize = 8;

impl Request {
    fn answered_range(&self) -> Option<Range<u64>> {
        if !self.asked
            || !self.page_eose
            || self.page_answered_at.is_none()
            || self.sent_at == 0
            || self.verification_retry
            || !self.received.verified()
        {
            return None;
        }
        let high = self
            .filter
            .until
            .unwrap_or(self.created_at / 1000)
            .saturating_add(1);
        let since = self.filter.since.unwrap_or(0);
        let low = if self.received.len() >= self.page_limit {
            since.max(self.oldest?.saturating_add(1))
        } else {
            since
        };
        (low < high).then_some(low..high)
    }
}

impl Network {
    pub(in crate::engine) fn has_history_answer(&self, sub: &str) -> bool {
        let repair = format!("~repair:{sub}");
        self.requests.values().any(|r| {
            r.page_eose
                && r.page_answered_at.is_some()
                && r.sent_at != 0
                && r.owns_time(None)
                && (r.members.contains(sub) || r.members.contains(&repair))
        })
    }

    /// Start at the existing boundary and extend only through adjoining evidence.
    /// Scratch is one interval per existing request and at most three signers per band.
    pub(in crate::engine) fn history_boundary(
        &self,
        sub: &str,
        filter: &NostrFilter,
        scope: &Scope<'_>,
        edge: u64,
    ) -> u64 {
        let repair = format!("~repair:{sub}");
        let pages: Vec<_> = self
            .requests
            .values()
            .filter(|r| {
                r.owns_time(None) && (r.members.contains(sub) || r.members.contains(&repair))
            })
            .filter_map(|r| Some((r, r.answered_range()?)))
            .filter(|(r, _)| {
                let mut family = r.page_filter.clone();
                family.until = filter.until;
                want_key::same(&family, filter)
            })
            .collect();
        extend(&pages, scope, edge)
    }
}

fn extend(pages: &[(&Request, Range<u64>)], scope: &Scope<'_>, mut edge: u64) -> u64 {
    for _ in 0..BANDS_PER_PASS {
        let pages = pages
            .iter()
            .filter(|(_, span)| span.start < edge && edge <= span.end);
        let Some(floor) = pages.clone().map(|(_, span)| span.start).min() else {
            break;
        };
        if scope.required == 0 {
            return floor;
        }
        let floor = floor.max(edge.saturating_sub(BAND_SECONDS));
        let mut authors = BTreeSet::new();
        let mut oldest = edge;
        for (page, span) in pages {
            for id in page.received.iter() {
                let Some(at) = page.received.timestamp(id) else {
                    continue;
                };
                if at < floor.max(span.start) || at >= edge {
                    continue;
                }
                if let Some(author) = scope.contributor(id) {
                    if authors.len() < scope.required {
                        authors.insert(author);
                    }
                    oldest = oldest.min(at);
                }
            }
        }
        if authors.len() < scope.required {
            break;
        }
        edge = oldest;
    }
    edge
}
