use super::*;
#[wasm_bindgen]
impl SharedWorkerHandle {
    pub fn stop(&mut self) {
        self.scope.set_onconnect(None);
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
impl Drop for SharedWorkerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}
