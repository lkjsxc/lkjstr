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
pub use shared::{start_port_host, start_shared};
#[path = "worker_persist.rs"]
mod persistence;
use persistence::{load, persist};
#[path = "worker_defaults.rs"]
mod defaults;
use defaults::initial_engine;
#[path = "worker_accounts.rs"]
mod accounts;
#[path = "worker_preview.rs"]
mod previews;
#[path = "worker_relays.rs"]
mod relay_config;
#[path = "worker_sign.rs"]
mod signing;
#[path = "worker_upload.rs"]
mod uploads;
struct Host {
    preview_probed: bool,
    preview_busy: bool,
    bootstrap_relays: Vec<lkjstr_core::engine::wire::RelayConfig>,
    relay_owner: Option<(String, String)>,
    account_revision: u64,
    upload_tasks: Vec<uploads::Task>,
    upload_inflight: usize,
    server_checks: Vec<(u64, String, String, String, u64)>, // shared four-request bound
    auth_next: u64,
    upload_auth: BTreeMap<(u64, String), (lkjstr_protocol::UnsignedNostrEvent, js_sys::Function)>,

    accounts: lkjstr_core::engine::accounts::Accounts,
    account_tasks: Vec<(u64, String, lkjstr_core::engine::wire::actions::Action)>,
    account_busy: bool,
    discovery: BTreeMap<(u64, String), u64>,
    loaded: bool,
    startup: Vec<(u64, lkjstr_core::engine::wire::Input)>,
    status: Option<(usize, usize)>,
    engine: Engine,
    sessions: BTreeMap<u64, RefCell<lkjstr_core::engine::wire::Session>>,
    scope: Sink,
    sockets: BTreeMap<String, Socket>,
    timer: Option<Timer>,
    db: Option<web_sys::IdbDatabase>,
    next_persist: u64,
    publication_persisted: u64,
    quality_persisted: u64,
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
        account_revision: 0,
        bootstrap_relays: vec![],
        relay_owner: None,
        upload_tasks: vec![],
        upload_inflight: 0,
        server_checks: vec![],
        auth_next: 0,
        upload_auth: BTreeMap::new(),
        accounts: Default::default(),
        account_tasks: vec![],
        account_busy: false,
        discovery: BTreeMap::new(),
        loaded: false,
        startup: vec![],
        status: None,
        sessions: [(0, RefCell::default())].into_iter().collect(),
        scope: Sink::Dedicated(scope.clone()),
        sockets: BTreeMap::new(),
        timer: None,
        db: None,
        next_persist: 0,
        publication_persisted: 0,
        quality_persisted: 0,
        flushing: false,
        stopped: false,
        clock_offset: 0,
        preview_probed: false,
        preview_busy: false,
        identity_inflight: 0,
        identity_attempts: BTreeMap::new(),
    }));
    let weak = Rc::downgrade(&host);
    let message = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            host.borrow_mut().receive_value(0, event.data());
            pump(&host);
        }
    });
    scope.set_onmessage(Some(message.as_ref().unchecked_ref()));
    schedule(&host);
    load(&host);

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
                for (id, session) in &h.sessions {
                    for out in session.borrow_mut().timeline_tick(&h.engine, at) {
                        h.scope.direct(*id, &out);
                    }
                }
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
        if !signing::process(host, &o) {
            post(&host.borrow(), &o);
        }
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
                                SocketEvent::Closed(reason) => {
                                    let at = h.time();
                                    h.engine.network.disconnected(&relay, at);
                                    if let Some(r) = h.engine.network.relays.get_mut(&relay) {
                                        r.last_error = Some(reason.chars().take(512).collect());
                                    }
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
    accounts::pump_accounts(host);
    accounts::status(host);
    uploads::pump_uploads(host);
    uploads::checks::pump(host);
    shared::expire(host);
    previews::pump_previews(host);
}
#[path = "worker_handle.rs"]
mod handle;

#[path = "worker_wire.rs"]
mod wire_boundary;
