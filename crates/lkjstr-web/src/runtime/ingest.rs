//! Incoming events: queued per message, then verified and inserted in
//! time-boxed slices so the UI thread never stalls on a burst.

use leptos::prelude::Update;
use lkjstr_core::store::Inserted;
use lkjstr_protocol::{NostrEvent, VerificationResult, parse_nostr_event_json, verify_event};

use super::{App, Rt};
use crate::host::{after, now_ms};

/// Most queued events; a flood beyond this is dropped (relays resend).
const MAX_QUEUE: usize = 20_000;
/// Main-thread budget per slice.
const SLICE_MS: f64 = 8.0;
/// Kinds worth keeping across reloads.
const PERSIST_KINDS: [u64; 8] = [0, 1, 3, 5, 6, 7, 9735, 10002];

fn perf_now() -> f64 {
    web_sys::window()
        .and_then(|window| window.performance())
        .map_or(0.0, |perf| perf.now())
}

impl Rt {
    pub(super) fn enqueue(&mut self, relay: &str, event: NostrEvent) {
        if self.incoming.len() < MAX_QUEUE {
            self.incoming.push_back((relay.to_owned(), event));
        }
        if !self.flags.ingest {
            self.flags.ingest = true;
            if let Some(app) = self.app() {
                after(0, move || app.ingest_slice());
            }
        }
    }

    /// Verifies and inserts until the budget runs out. Returns whether the
    /// store changed and whether work remains.
    fn ingest(&mut self) -> (bool, bool) {
        let start = perf_now();
        let mut changed = false;
        while let Some((relay, event)) = self.incoming.pop_front() {
            if self.store.get(&event.id).is_some() {
                self.store.insert(event, Some(&relay));
                self.scores.entry(&relay).on_event(now_ms(), false);
                continue;
            }
            if !matches!(verify_event(&event), VerificationResult::Ok(_)) {
                continue;
            }
            if event.kind == 6
                && let Ok(inner) = parse_nostr_event_json(&event.content, None)
                && matches!(verify_event(&inner), VerificationResult::Ok(_))
            {
                changed |= self.accept(inner, &relay);
            }
            let fresh = self.accept(event, &relay);
            changed |= fresh;
            self.scores.entry(&relay).on_event(now_ms(), fresh);
            if perf_now() - start > SLICE_MS {
                break;
            }
        }
        (changed, !self.incoming.is_empty())
    }

    /// Inserts a verified event; local-first publishing uses this too.
    pub(super) fn accept(&mut self, event: NostrEvent, relay: &str) -> bool {
        let keep = self.db.is_some() && PERSIST_KINDS.contains(&event.kind);
        let copy = keep.then(|| event.clone());
        let relay = (!relay.is_empty()).then_some(relay);
        let own_list = event.kind == 10002 && self.session.active.as_ref() == Some(&event.pubkey);
        if event.kind == 10002 {
            self.schedule_replan(800);
        }
        match self.store.insert(event, relay) {
            Inserted::New | Inserted::Replaced => {
                if own_list {
                    self.apply_session_relays();
                }
                if let Some(copy) = copy {
                    self.unsaved.push(copy, self.db.is_some());
                    self.schedule_persist();
                }
                true
            }
            _ => false,
        }
    }
}

impl App {
    fn ingest_slice(self) {
        let (changed, more) = self.update(|rt| {
            let result = rt.ingest();
            if !result.1 {
                rt.flags.ingest = false;
            }
            result
        });
        if changed {
            self.bump_rev();
        }
        if more {
            after(0, move || self.ingest_slice());
        }
    }

    /// Coalesces revision bumps to at most one per animation-ish interval.
    pub(crate) fn bump_rev(self) {
        let due = self.update(|rt| {
            let due = !rt.flags.rev;
            rt.flags.rev = true;
            due
        });
        if due {
            after(120, move || {
                self.update(|rt| rt.flags.rev = false);
                self.rev.update(|rev| *rev += 1);
            });
        }
    }
}
