use super::*;
/// Dedicated fallback leader: accepts transferred ports from the elected page.
#[wasm_bindgen]
pub fn start_port_host() -> Result<WorkerHandle, JsValue> {
    let mut handle = super::start()?;
    {
        let mut h = handle.host.borrow_mut();
        h.sessions.clear();
        h.scope = Sink::Shared {
            clients: Clients::default(),
            peers: BTreeMap::new(),
        };
    }
    let weak = Rc::downgrade(&handle.host);
    let handler = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            for value in event.ports().iter() {
                if let Ok(port) = value.dyn_into::<web_sys::MessagePort>() {
                    attach(&host, port);
                }
            }
        }
    });
    let scope = js_sys::global().dyn_into::<web_sys::DedicatedWorkerGlobalScope>()?;
    scope.set_onmessage(Some(handler.as_ref().unchecked_ref()));
    handle.message = handler;
    Ok(handle)
}
