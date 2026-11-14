//! Dedicated Worker entry. The handle owns every socket, callback and timer.
use crate::browser::{
    idb,
    socket::{Socket, SocketEvent},
    timer::Timer,
};
#[cfg(feature = "harness")]
use lkjstr_core::engine::protocol::Input;
use lkjstr_core::engine::{Engine, network::Effect, protocol::Output};
use std::{
    cell::RefCell,
    collections::BTreeMap,
    rc::{Rc, Weak},
};
use wasm_bindgen::{JsCast, closure::Closure, prelude::*};
#[path = "worker_identity.rs"]
mod identity;
#[path = "worker_shared.rs"]
mod shared;
use shared::Sink;
#[path = "worker_relay_info.rs"]
mod relay_information;
use relay_information::relay_info;
pub use shared::start_shared;
#[path = "worker_persist.rs"]
mod persistence;
use persistence::{load, persist};
#[path = "worker_defaults.rs"]
mod defaults;
use defaults::initial_engine;
struct Host {
    engine: Engine,
    sessions: BTreeMap<u64, RefCell<lkjstr_core::engine::wire::Session>>,
    scope: Sink,
    sockets: BTreeMap<String, Socket>,
    timer: Option<Timer>,
    db: Option<web_sys::IdbDatabase>,
    next_persist: u64,
    flushing: bool,
    stopped: bool,
    clock_offset: u64,
    identity_inflight: usize,
    identity_attempts: BTreeMap<String, (String, u64)>,
}
#[wasm_bindgen]
pub struct WorkerHandle {
    host: Rc<RefCell<Host>>,
    message: Closure<dyn FnMut(web_sys::MessageEvent)>,
}
fn now() -> u64 {
    js_sys::Date::now() as u64
}
/// Call once inside a dedicated Worker after wasm-bindgen initialization.
#[wasm_bindgen]
pub fn start() -> Result<WorkerHandle, JsValue> {
    let scope = js_sys::global().dyn_into::<web_sys::DedicatedWorkerGlobalScope>()?;
    let host = Rc::new(RefCell::new(Host {
        engine: initial_engine(),
        sessions: [(0, RefCell::default())].into_iter().collect(),
        scope: Sink::Dedicated(scope.clone()),
        sockets: BTreeMap::new(),
        timer: None,
        db: None,
        next_persist: 0,
        flushing: false,
        stopped: false,
        clock_offset: 0,
        identity_inflight: 0,
        identity_attempts: BTreeMap::new(),
    }));
    let weak = Rc::downgrade(&host);
    let message = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            if let Ok(input) =
                serde_wasm_bindgen::from_value::<lkjstr_core::engine::wire::Input>(event.data())
            {
                host.borrow_mut().receive(0, input);
            }
            pump(&host);
        }
    });
    scope.set_onmessage(Some(message.as_ref().unchecked_ref()));
    schedule(&host);
    load(&host);
    shared::ready(scope.as_ref(), false);
    Ok(WorkerHandle { host, message })
}
fn post(host: &Host, out: &Output) {
    host.scope.post(out, &host.engine, &host.sessions);
}
fn schedule(host: &Rc<RefCell<Host>>) {
    let weak = Rc::downgrade(host);
    let timer = Timer::after(25, move || {
        if let Some(h) = weak.upgrade() {
            {
                let mut h = h.borrow_mut();
                let at = h.time();
                let begin = crate::measure::now();
                h.engine.tick(at);
                let elapsed = crate::measure::now() - begin;
                h.engine.metrics.tick(elapsed);
            }
            pump(&h);
            schedule(&h);
        }
    })
    .ok();
    host.borrow_mut().timer = timer;
}
fn pump(host: &Rc<RefCell<Host>>) {
    let (effects, outputs) = {
        let mut h = host.borrow_mut();
        (h.engine.network.drain_effects(), h.engine.drain())
    };
    for o in outputs {
        post(&host.borrow(), &o);
    }
    for effect in effects {
        match effect {
            Effect::Inspect(url) => relay_info(host, url),
            Effect::Connect(url) => {
                if host.borrow().sockets.contains_key(&url) {
                    continue;
                }
                let weak: Weak<RefCell<Host>> = Rc::downgrade(host);
                let relay = url.clone();
                let socket = Socket::connect(&url, move |event| {
                    if let Some(h) = weak.upgrade() {
                        {
                            let mut h = h.borrow_mut();
                            match event {
                                SocketEvent::Open => {
                                    let at = h.time();
                                    h.engine.network.connected(&relay, at)
                                }
                                SocketEvent::Closed(_) => {
                                    let at = h.time();
                                    h.engine.network.disconnected(&relay, at)
                                }
                                SocketEvent::Message(text) => {
                                    let at = h.time();
                                    if let Some(e) = h.engine.network.message(&relay, &text, at) {
                                        h.engine.enqueue(relay.clone(), e);
                                    }
                                }
                            }
                        }
                        // Effects are drained by the next tick, outside the callback borrow.
                    }
                });
                match socket {
                    Ok(socket) => {
                        host.borrow_mut().sockets.insert(url, socket);
                    }
                    Err(_) => {
                        let mut h = host.borrow_mut();
                        let at = h.time();
                        h.engine.network.disconnected(&url, at)
                    }
                }
            }
            Effect::Disconnect(url) => {
                host.borrow_mut().sockets.remove(&url);
            }
            Effect::Send(url, text) => {
                if let Some(s) = host.borrow().sockets.get(&url) {
                    s.send(&text);
                }
            }
        }
    }
    persist(host);
    identity::identities(host);
}
#[wasm_bindgen]
impl WorkerHandle {
    pub fn stop(&mut self) {
        let mut h = self.host.borrow_mut();
        h.stopped = true;
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
    fn time(&self) -> u64 {
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

#[path = "worker_wire.rs"]
mod wire_boundary;
