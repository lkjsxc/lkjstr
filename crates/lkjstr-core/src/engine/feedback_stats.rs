//! Bounded Stats projections. Never serialize queries, rows or private views.
use super::{Engine, View, protocol::Source};
use serde_json::{Value, json};

impl Engine {
    pub(super) fn view_stats(&self) -> Vec<Value> {
        self.views
            .iter()
            .filter(|(_, view)| {
                !matches!(
                    view.query.source,
                    Source::Bookmarks | Source::List | Source::Mutes
                ) && super::public_reads::allowed(&self.store, &self.private_lists, &view.query)
                    && (view.query.source != Source::Relay
                        || !self.network.is_private_relay(view.query.target.as_deref()))
            })
            .take(128)
            .map(|(sub, view)| {
                view.stats(view.visible && self.network.focused_sub.as_ref() == Some(sub))
            })
            .collect()
    }

    pub(super) fn worker_stats(&self) -> Value {
        let replaceable = self.store.replaceable_len();
        json!({
            "verifiedTotal": self.verified,
            "rejectedTotal": self.rejected,
            "droppedTotal": self.dropped,
            "verifyQueueLen": self.queue.len(),
            "verifyIngressBytes": self.queue_bytes,
            "verifyIngressCapBytes": super::ingest::MAX_VERIFY_QUEUE_BYTES,
            "persistenceQueueLen": self.pending.len(),
            "lastTickMs": self.metrics.last_tick_ms,
            "maxTickMs": self.metrics.max_tick_ms,
            "sliceLimit": super::tick::VERIFY_SLICE_LIMIT,
            "regularStored": self.store.len() - replaceable,
            "replaceableStored": replaceable,
            "memoryCapBytes": self.store.byte_cap(),
        })
    }
}

impl View {
    fn stats(&self, focused: bool) -> Value {
        let kind = if self.time_window.is_some() {
            "at"
        } else if self.month_anchor.is_some() {
            "month"
        } else if self.anchor.is_some() {
            "key"
        } else {
            "top"
        };
        let source = match self.query.source {
            Source::TheirHome => json!("their-home"),
            Source::MediaServers => json!("media-servers"),
            other => json!(other),
        };
        let mut row = json!({
            "subId": format!("view-{}", self.telemetry_id),
            "source": source,
            "visible": self.visible,
            "focused": focused,
            "rowCount": self.rows.len(),
            "windowKind": kind,
            "freshCount": self.fresh_count,
        });
        if let Some(pivot) = &self.time_window {
            let (older, newer) = pivot.coverage();
            row["anchorAtMs"] = json!(pivot.at);
            row["olderCoverage"] = json!(older);
            row["newerCoverage"] = json!(newer);
        } else if let Some(month) = self.month_anchor {
            row["anchorAtMs"] = json!(month);
        }
        row
    }
}

#[cfg(test)]
#[path = "feedback_stats_test.rs"]
mod tests;
