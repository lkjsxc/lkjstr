//! Fixed admission weights for timeline pages. Transport and control precedence
//! are enforced by the caller; this score orders candidates within those lanes.
use crate::engine::network::{Network, Request, stats_relay};

#[derive(Clone, Copy)]
struct PageWeight {
    class: u64,
    source: u64,
    author_group: u64,
    ready_ms: u64,
}

impl PageWeight {
    fn score(self) -> u64 {
        self.class * self.source.clamp(1, 4) * self.author_group.clamp(1, 4) + self.ready_ms / 250
    }
}

impl Network {
    pub(in crate::engine::network) fn fetch_weight(&self, r: &Request, now: u64) -> u64 {
        if !stats_relay::public_filter(&r.filter)
            || r.filter.authors.is_none()
            || r.filter.ids.is_some()
            || !r.owns_time(None)
            || r.verification_retry
            || !r.filter.kinds.as_ref().is_some_and(|ks| ks.contains(&1))
        {
            return r.weight;
        }
        let class = match r.purpose {
            "visible" | "focused" | "history" => 8,
            "prefetch" if r.members.iter().any(|m| m.starts_with("~prefetch:")) => 4,
            "prefetch" if r.members.iter().any(|m| m.starts_with("~repair:")) => 2,
            _ => 1,
        };
        let source = self.relays.get(&r.relay).map_or(2, |relay| {
            if relay.received < 16 {
                2
            } else {
                1 + relay.useful.saturating_mul(3) / relay.received.max(1)
            }
        });
        PageWeight {
            class,
            source,
            author_group: r.weight.div_ceil(16).max(1),
            ready_ms: now.saturating_sub(r.ready_at),
        }
        .score()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn eligible_classes_yield_to_aging_and_inputs_are_bounded() {
        let visible = PageWeight {
            class: 8,
            source: 3,
            author_group: 2,
            ready_ms: 0,
        };
        let backfill = PageWeight {
            class: 2,
            ..visible
        };
        assert!(visible.score() > backfill.score());
        assert!(
            PageWeight {
                ready_ms: 10_000,
                ..backfill
            }
            .score()
                > visible.score()
        );
        assert_eq!(
            PageWeight {
                source: 99,
                author_group: 300,
                ..visible
            }
            .score(),
            PageWeight {
                source: 4,
                author_group: 4,
                ..visible
            }
            .score()
        );
    }
}
