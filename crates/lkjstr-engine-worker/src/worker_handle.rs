use super::*;
#[wasm_bindgen]
impl WorkerHandle {
    pub fn stop(&mut self) {
        if self.host.borrow().stopped {
            return;
        }
        // A port host uses a Shared Sink inside a dedicated global scope.
        if let Ok(scope) = js_sys::global().dyn_into::<web_sys::DedicatedWorkerGlobalScope>() {
            scope.set_onmessage(None);
        }
        shutdown::stop(&mut self.host.borrow_mut());
    }
}
impl Drop for WorkerHandle {
    fn drop(&mut self) {
        self.stop();
        let _ = &self.message;
    }
}

impl Host {
    pub(super) fn time(&self) -> u64 {
        now().saturating_add(self.clock_offset)
    }
}
#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn tick_count(&self) -> f64 {
        self.host.borrow().engine.metrics.ticks as f64
    }

    pub fn advance_time(&mut self, ms: u32) {
        {
            let mut h = self.host.borrow_mut();
            h.clock_offset = h.clock_offset.saturating_add(ms as u64);
            let at = h.time();
            h.engine.tick(at);
        }
        pump(&self.host);
    }
}

#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn set_test_relays(&mut self, urls: JsValue) {
        if let Ok(relays) = serde_wasm_bindgen::from_value::<Vec<String>>(urls) {
            let mut h = self.host.borrow_mut();
            let at = h.time();
            h.engine.input(Input::Configure { relays }, at);
            h.wake();
        }
    }
}

#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn prime_private_stop(&mut self, account: &str) -> Result<(), JsValue> {
        direct_messages::stop_probe::prime(&mut self.host.borrow_mut(), account)
    }
    pub fn replay_stopped_input(&mut self, account: &str) -> Result<(), JsValue> {
        direct_messages::stop_probe::stale_input(&mut self.host.borrow_mut(), account)
    }
    pub fn private_stop_counts(&self, account: &str) -> Result<JsValue, JsValue> {
        direct_messages::stop_probe::counts(&self.host.borrow(), account)
    }
}

#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn hold_public_sign(&mut self, account: &str) -> bool {
        bunker::probe::arm(&mut self.host.borrow_mut(), account)
    }
    pub fn public_sign_queued(&self) -> bool {
        bunker::probe::queued(&self.host.borrow())
    }
    pub fn release_public_sign(&mut self) -> bool {
        bunker::probe::release(&mut self.host.borrow_mut())
    }
    pub fn renew_queued_bunker(&mut self, account: &str) -> bool {
        bunker::probe::renew(&mut self.host.borrow_mut(), account)
    }
}

// Only fixture builds can read local diagnostics or enable the baseline trace.
#[cfg(feature = "harness")]
#[wasm_bindgen]
impl WorkerHandle {
    pub fn observe_fetch_decisions(&self, enabled: bool) {
        self.host
            .borrow()
            .engine
            .network
            .fetches
            .set_decisions(enabled);
    }
    pub fn fetch_records_json(&self) -> Result<String, JsValue> {
        self.host
            .borrow()
            .engine
            .network
            .fetches
            .fetch_records_json()
            .map_err(|_| JsValue::from_str("fetch-record-serialize"))
    }
}
