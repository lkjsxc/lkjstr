use super::*;
impl Network {
    pub fn drain_effects(&mut self) -> Vec<Effect> {
        std::mem::take(&mut self.effects)
    }
    pub fn drain_output(&mut self) -> Vec<Output> {
        std::mem::take(&mut self.output)
    }
    pub fn stats(&self) -> Value {
        let wires = self.open_wires();
        json!(self.relays.iter().map(|(url,r)|json!({"url":url,"online":r.online,
        "lastRx":r.last_rx,"received":r.received,"useful":r.useful,"sent":r.sent,"failures":r.failures,
        "nip11":r.nip11,"maxReqs":r.max_reqs,"latencyMs":r.latency_ms,
        "pages":self.requests.values().filter(|q|q.relay==*url && q.filter.kinds.as_deref()==Some(&[1,6])).take(256).map(|q|json!({"until":q.filter.until,"received":q.received.len(),"pageLimit":q.page_limit,"pageEose":q.page_eose,"complete":q.complete,"sent":q.sent,"oldest":q.oldest})).collect::<Vec<_>>(),
        "activeReqs":wires.get(url.as_str()).copied().unwrap_or(0)})).collect::<Vec<_>>())
    }
}
