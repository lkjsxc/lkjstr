//! Bounded runtime counters and real host timings, never event bodies or keys.
use serde::Serialize;
#[derive(Debug, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Metrics {
    pub last_tick_ms: f64,
    pub max_tick_ms: f64,
    pub ticks: u64,
    pub served_from_cache: u64,
    pub verify_queue_peak: usize,
    pub last_commit_ms: f64,
    pub commits: u64,
}
impl Metrics {
    pub fn tick(&mut self, ms: f64) {
        self.last_tick_ms = ms;
        self.max_tick_ms = self.max_tick_ms.max(ms);
        self.ticks += 1;
    }
    pub fn commit(&mut self, ms: f64) {
        self.last_commit_ms = ms;
        self.commits += 1;
    }
}
