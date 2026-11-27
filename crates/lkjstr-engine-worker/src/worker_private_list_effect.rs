use super::*;
use lkjstr_core::engine::accounts::secret::SecretText;
pub(super) fn start(host: &Rc<RefCell<Host>>, job: Job, data: String) {
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let Some(host) = weak.upgrade() else {
            return;
        };
        let result = direct_messages::list_read(&host, &job, data).await;
        let mut h = host.borrow_mut();
        sync(&mut h);
        h.private_lists.flights.remove(&job.token);
        if h.stopped {
            if let Ok(text) = result {
                drop(SecretText::new(text));
            }
            return;
        }
        let now = h.time();
        let engine = &mut h.engine;
        if let Some(tags) = engine
            .private_reads
            .finish(&engine.store, &job, result, now, true)
        {
            engine.private_lists.insert(job.event, tags);
            private_cache::revoke(&mut h, true);
            h.wake();
        }
    });
}
