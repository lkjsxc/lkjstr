//! Bounded Stage 1 observations. Learning parts remain off.
use super::Engine;
use serde_json::{Value, json};

impl Engine {
    pub(super) fn optimizer_stats(&self, now: u64) -> Value {
        let link = self.network.optimizer.link.state();
        let plan = self.network.first_screen_plan(now);
        let source = if link.samples >= 4 {
            "measured"
        } else {
            "fixed"
        };
        let variable = |id: &str, value: Value, unit: &str, source: &str| json!({"id":id,"value":value,"unit":unit,"source":source});
        let mut variables = vec![
            variable("fanout", json!(plan.fanout), "", "fixed"),
            variable("hedgeDelay", json!(plan.hedge_delay_ms), "ms", "fixed"),
            variable("limit", json!(plan.limit), "events", source),
            variable("chunk", json!(plan.author_chunk), "authors", source),
            variable("prefetch", json!(plan.prefetch_depth), "pages", source),
            variable("throughput", json!(link.throughput_bps), "B/s", source),
            variable(
                "rtt",
                json!(link.rtt_ms),
                "ms",
                if self.network.optimizer.link.has_rtt() {
                    "measured"
                } else {
                    "fixed"
                },
            ),
            variable("saturated", json!(link.saturated), "", source),
        ];
        if let Some(target) = plan.hedge_target {
            variables.push(variable("hedgeTarget", json!(target), "", "measured"));
        }
        let mut stats = self.store.keep_stats();
        stats["stage"] = json!(1);
        stats["parts"] =
            json!(["route", "hedge", "prefetch", "keep"].map(|id| {
                json!({"id":id,"mode":"off","trippedUntilMs":null,"tripReason":null})
            }));
        stats["link"] = json!(link);
        stats["variables"] = json!(variables);
        stats["shadow"] =
            json!({"decisions":0,"agreements":0,"brierStage1":null,"brierStage2":null});
        stats
    }
}
