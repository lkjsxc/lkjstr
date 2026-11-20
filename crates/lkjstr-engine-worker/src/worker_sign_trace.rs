//! Public-event signing timings. Only the in-flight index uses request tokens.
use super::*;
use crate::measure;
use serde::Serialize;
use std::collections::VecDeque;

const SLOW_MS: f64 = 300.0;
const RETAIN_MS: f64 = 90_000.0;
const IN_FLIGHT: usize = 128;
const RECENT: usize = 32;
const ACTIVITY_LIMIT: usize = 256;

#[derive(Clone, Copy, Default)]
pub(super) struct Stamp {
    enqueue: Option<f64>,
    received: f64,
    hidden: bool,
    boot: bool,
    restart: bool,
}
impl Stamp {
    pub(super) fn read(value: &JsValue, boot: bool) -> Self {
        let received = measure::now();
        let get = |value, property: &str| js_sys::Reflect::get(value, &property.into()).ok();
        let meta = get(value, "signingTiming");
        let elapsed = meta
            .as_ref()
            .and_then(|m| get(m, "at")?.as_f64())
            .map(|at| at - measure::origin());
        let flag = |k| {
            meta.as_ref()
                .and_then(|m| get(m, k)?.as_bool())
                .unwrap_or(false)
        };
        Self {
            enqueue: elapsed.filter(|&t| t >= received - RETAIN_MS && t <= received + 1.0),
            received,
            hidden: flag("hidden"),
            boot: boot || flag("boot"),
            restart: flag("restart"),
        }
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) enum Activity {
    Ingest,
    Verify,
    Plan,
    Render,
    Timeline,
    Output,
    Cache,
    Idb,
    Sync,
    Boot,
    KeyOperation,
}
struct Span {
    activity: Activity,
    begin: f64,
    end: f64,
    busy: f64,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Sample {
    kind: u64,
    signer: &'static str,
    enqueue_ms: f64,
    received_ms: f64,
    start_ms: Option<f64>,
    response_ms: Option<f64>,
    signed_ms: Option<f64>,
    published_ms: Option<f64>,
    finished_ms: Option<f64>,
    hidden: bool,
    boot: bool,
    restart: bool,
    cache_busy_at_receipt: bool,
    account_busy_at_receipt: bool,
    overlapping: Vec<(Activity, f64, f64)>,
}
#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub(super) struct Trace {
    #[serde(skip)]
    pending: BTreeMap<String, Sample>,
    #[serde(skip)]
    activity: VecDeque<Span>,
    recent: VecDeque<Sample>,
    slow: VecDeque<Sample>,
    pub(super) last_unlock_ms: Option<f64>,
}
impl Trace {
    pub(super) fn enqueue(&mut self, req: &str, stamp: Stamp, cache: bool, account: bool) {
        self.pending
            .retain(|_, row| stamp.received - row.received_ms < RETAIN_MS);
        if self.pending.len() < IN_FLIGHT && req.len() <= 256 {
            self.pending.entry(req.into()).or_insert(Sample {
                kind: 0,
                signer: "unknown",
                enqueue_ms: stamp.enqueue.unwrap_or(stamp.received).min(stamp.received),
                received_ms: stamp.received,
                start_ms: None,
                response_ms: None,
                signed_ms: None,
                published_ms: None,
                finished_ms: None,
                hidden: stamp.hidden,
                boot: stamp.boot,
                restart: stamp.restart,
                cache_busy_at_receipt: cache,
                account_busy_at_receipt: account,
                overlapping: Vec::new(),
            });
        }
    }
    pub(super) fn start(&mut self, req: &str, kind: u64, signer: &'static str) {
        if let Some(row) = self.pending.get_mut(req) {
            row.kind = kind;
            row.signer = signer;
            row.start_ms = Some(measure::now());
        }
    }
    pub(super) fn span(&mut self, activity: Activity, begin: f64) {
        let end = measure::now();
        let busy = end - begin;
        if busy <= 0.0 {
            return;
        }
        if activity == Activity::Ingest
            && let Some(last) = self.activity.back_mut()
            && last.activity == activity
            && begin - last.end < 4.0
            && end - last.begin < 25.0
        {
            last.end = end;
            last.busy += busy;
            return;
        }
        push(
            &mut self.activity,
            Span {
                activity,
                begin,
                end,
                busy,
            },
            ACTIVITY_LIMIT,
        );
    }
    pub(super) fn response(&mut self, req: &str) {
        if let Some(row) = self.pending.get_mut(req) {
            row.response_ms = Some(measure::now());
        }
    }
    pub(super) fn signed(&mut self, req: &str, at: Option<f64>) {
        if let Some(row) = self.pending.get_mut(req) {
            row.signed_ms = at;
        }
    }
    pub(super) fn accepted(&mut self, req: &str) {
        if let Some(row) = self.pending.get_mut(req) {
            row.published_ms.get_or_insert_with(measure::now);
        }
    }
    pub(super) fn output(&mut self, output: &Output) {
        let (req, accepted) = match output {
            Output::Error { req: Some(req), .. } => (req, false),
            Output::Result {
                req, deliveries, ..
            } => (
                req,
                deliveries.iter().any(|relay| relay.state == "accepted"),
            ),
            _ => return,
        };
        let Some(mut row) = self.pending.remove(req) else {
            return;
        };
        if row.start_ms.is_none() {
            return;
        }
        let end = measure::now();
        row.finished_ms = Some(end);
        if accepted {
            row.published_ms.get_or_insert(end);
        }
        for span in &self.activity {
            let overlap = end.min(span.end) - row.enqueue_ms.max(span.begin);
            if overlap > 0.0 {
                let busy = span.busy.min(overlap);
                let blocked = (row.received_ms.min(span.end) - row.enqueue_ms.max(span.begin))
                    .clamp(0.0, span.busy);
                if let Some((_, total, queued)) = row
                    .overlapping
                    .iter_mut()
                    .find(|(k, _, _)| *k == span.activity)
                {
                    *total += busy;
                    *queued += blocked;
                } else {
                    row.overlapping.push((span.activity, busy, blocked));
                }
            }
        }
        if end - row.enqueue_ms > SLOW_MS {
            push(&mut self.slow, row.clone(), RECENT);
        }
        push(&mut self.recent, row, RECENT);
    }
    pub(super) fn stats(&self, engine: &Engine) -> serde_json::Value {
        let mut stats = engine.stats();
        stats["signing"] = serde_json::json!(self);
        stats
    }
}

fn push<T>(queue: &mut VecDeque<T>, row: T, capacity: usize) {
    if queue.len() == capacity {
        queue.pop_front();
    }
    queue.push_back(row);
}
