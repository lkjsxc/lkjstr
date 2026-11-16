use super::*;
#[wasm_bindgen]
impl SharedWorkerHandle {
    pub fn stop(&mut self) {
        if self.host.borrow().stopped {
            return;
        }
        self.scope.set_onconnect(None);
        shutdown::stop(&mut self.host.borrow_mut());
    }
}
impl Drop for SharedWorkerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(feature = "harness")]
#[wasm_bindgen]
impl SharedWorkerHandle {
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
