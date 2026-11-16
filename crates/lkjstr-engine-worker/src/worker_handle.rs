use super::*;
#[wasm_bindgen]
impl WorkerHandle {
    pub fn stop(&mut self) {
        let mut h = self.host.borrow_mut();
        h.stopped = true;
        uploads::control::stop(&mut h);
        h.scope.close();
        h.timer.take();
        h.sockets.clear();
        if let Some(db) = h.db.take() {
            db.close();
        }
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
        }
    }
}
