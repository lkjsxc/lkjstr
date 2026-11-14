//! One cancellable deadline per visible want; settled content stays live.
use super::App;
use leptos::prelude::*;
use lkjstr_core::plan::WantId;
use lkjstr_protocol::ClientMessage;
use std::time::Duration;

impl App {
    pub(super) fn watch_want(self, id: WantId) {
        self.cancel_deadline(id);
        if let Ok(timer) = set_timeout_with_handle(
            move || {
                self.update(|rt| {
                    rt.deadlines.remove(&id);
                    if !rt.wants.contains_key(&id) {
                        return;
                    }
                    let p = rt.progress(id);
                    if p.total > 0 && !p.settled() {
                        let deadline = lkjstr_core::requests::Deadline::expire(&rt.net.subs, id);
                        rt.expired.insert(id, deadline);
                        rt.schedule_replan(1);
                    }
                });
                self.net_rev.update(|r| *r += 1);
            },
            Duration::from_secs(12),
        ) {
            self.update(|rt| {
                rt.deadlines.insert(id, timer);
            });
        }
    }

    pub(super) fn cancel_deadline(self, id: WantId) {
        self.update(|rt| {
            if let Some(timer) = rt.deadlines.remove(&id) {
                timer.clear();
            }
        });
    }

    pub fn retry(self, id: WantId) {
        self.update(|rt| {
            rt.expired.remove(&id);
            for (relay, sub_id) in lkjstr_core::requests::retry(&mut rt.net.subs, id) {
                rt.send(&relay, &ClientMessage::Close(sub_id));
            }
            rt.schedule_replan(1);
        });
        self.watch_want(id);
    }

    pub fn retry_event(self, event: &str) {
        let ids = self.with(|rt| rt.wants.iter().filter(|(_, w)| matches!(w, lkjstr_core::plan::Want::Events { ids, .. } if ids.iter().any(|id| id == event))).map(|(id, _)| *id).collect::<Vec<_>>());
        for id in ids {
            self.retry(id);
        }
    }
}
