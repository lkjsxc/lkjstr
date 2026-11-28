//! R0 measurement adapter. A fetch rejection does not establish CORS failure.
use lkjstr_core::engine::fetch_records::{
    FetchRecord, Lane, Observer, Outcome, ResourceClass, Scope, Source, WireBytes,
};
use wasm_bindgen::JsValue;

pub fn clock() -> u64 {
    super::storage_inspection::now().unwrap_or(0)
}
pub struct HttpObservation {
    observer: Observer,
    record: Option<FetchRecord>,
}
impl HttpObservation {
    pub fn new(
        observer: Observer,
        class: ResourceClass,
        identity: &str,
        origin: &str,
        lane: Lane,
    ) -> Self {
        let at = clock();
        let mut record = observer.draft(class, Scope::Resource, identity, Some(origin), at);
        if let Some(r) = &mut record {
            r.start_ms = Some(at);
            r.lane = lane;
            r.source = Source::NetworkOrHttpCache;
        }
        Self { observer, record }
    }
    pub fn response(&mut self, status: u16) {
        if let Some(r) = &mut self.record {
            r.first_byte_ms = Some(clock()); // Fetch exposes headers before body chunks.
            r.outcome = if (200..300).contains(&status) {
                Outcome::Ok
            } else {
                Outcome::HttpStatus(status)
            };
            r.wire_bytes = WireBytes::Measured(0);
        }
    }
    pub fn bytes(&mut self, bytes: u64) {
        if let Some(r) = &mut self.record {
            let prior = match r.wire_bytes {
                WireBytes::Measured(n) => n,
                _ => 0,
            };
            r.wire_bytes = WireBytes::Measured(prior.saturating_add(bytes));
        }
    }
    pub fn cache_hit(&mut self) {
        if let Some(r) = &mut self.record {
            r.source = Source::HttpCache;
            r.wire_bytes = WireBytes::Measured(0);
            r.link_ms = Some(0);
            r.outcome = Outcome::Ok;
        }
    }
    pub fn record_mut(&mut self) -> Option<&mut FetchRecord> {
        self.record.as_mut()
    }
    pub fn complete(mut self, outcome: Option<Outcome>) {
        if let Some(mut r) = self.record.take() {
            if let Some(outcome) = outcome {
                r.outcome = outcome;
            }
            r.end_ms = clock();
            self.observer.record(r);
        }
    }
    pub fn error(error: &JsValue) -> Outcome {
        match error.as_string().as_deref() {
            Some("http-timeout") => Outcome::Timeout,
            Some("body-limit" | "invalid-utf8") => Outcome::Unsupported,
            _ => Outcome::NetworkError,
        }
    }
}
