//! HTTP effects only. Preview work runs last, one request at a time, and never competes for relay slots.
use super::*;
use crate::browser::http;
use serde_json::Value;
pub(super) fn pump_previews(host: &Rc<RefCell<Host>>) {
    let mut h = host.borrow_mut();
    if h.stopped || h.preview_busy {
        return;
    }
    if !h.preview_probed {
        h.preview_probed = true;
        h.preview_busy = true;
        drop(h);
        let weak = Rc::downgrade(host);
        wasm_bindgen_futures::spawn_local(async move {
            let ok = http::get("/preview/health", "application/json", 1024)
                .await
                .ok()
                .filter(|r| r.status == 200)
                .and_then(|r| serde_json::from_str::<Value>(&r.body).ok())
                .is_some_and(|v| v["ok"] == true && v["version"] == 1);
            if let Some(host) = weak.upgrade() {
                let mut h = host.borrow_mut();
                h.preview_busy = false;
                h.engine.previews.available = ok;
                refresh(&h);
            }
        });
        return;
    }
    if !h.engine.previews.available
        || h.identity_inflight > 0
        || h.upload_inflight > 0
        || h.account_busy
    {
        return;
    }
    let url = h
        .sessions
        .values()
        .find_map(|s| s.borrow().preview_want(&h.engine));
    let Some(url) = url else {
        return;
    };
    if !h.engine.previews.begin(&url) {
        return;
    }
    h.preview_busy = true;
    drop(h);
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let address = format!("/preview?url={}", js_sys::encode_uri_component(&url));
        let answer = http::get(&address, "application/json", 32768)
            .await
            .ok()
            .filter(|r| r.status == 200)
            .and_then(|r| serde_json::from_str::<Value>(&r.body).ok())
            .filter(valid);
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            h.preview_busy = false;
            h.engine.previews.finish(&url, answer);
            refresh(&h);
        }
    });
}
fn valid(v: &Value) -> bool {
    v["url"]
        .as_str()
        .is_some_and(|u| u.starts_with("https://") || u.starts_with("http://"))
        && v["title"].as_str().is_some_and(|s| s.len() <= 4096)
}
pub(super) fn refresh(h: &Host) {
    for (id, session) in &h.sessions {
        for out in session.borrow_mut().preview_refresh(&h.engine) {
            h.scope.direct(*id, &out);
        }
    }
}
