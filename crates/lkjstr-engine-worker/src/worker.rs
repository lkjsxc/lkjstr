//! Dedicated Worker entry. The handle owns every socket, callback and timer.
use crate::browser::{idb, socket::Socket};
#[cfg(feature = "harness")]
use lkjstr_core::engine::protocol::Input;
use lkjstr_core::engine::{Engine, protocol::Output};
use std::{cell::RefCell, collections::BTreeMap, rc::Rc};
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
use persistence::persist;
#[path = "worker_account_boot.rs"]
mod account_boot;
#[path = "worker_note_outbox.rs"]
mod note_outbox;
use account_boot::load;
#[path = "worker_account_failure.rs"]
mod account_failure;
#[path = "worker_account_store.rs"]
mod account_store;
#[path = "worker_calendar.rs"]
mod calendar;
#[path = "worker_defaults.rs"]
mod defaults;
use defaults::initial_engine;
#[path = "worker_accounts.rs"]
mod accounts;
#[path = "worker_avatars.rs"]
mod avatars;
#[path = "worker_bunker.rs"]
mod bunker;
#[path = "worker_dm.rs"]
mod direct_messages;
#[path = "worker_pump.rs"]
mod effects;
#[path = "worker_host.rs"]
mod host_state;
#[path = "worker_keys.rs"]
mod keys;
#[path = "worker_preview.rs"]
mod previews;
#[path = "worker_private_cache.rs"]
mod private_cache;
#[path = "worker_private_lists.rs"]
mod private_lists;
#[path = "worker_public_cache.rs"]
mod public_cache;
#[path = "worker_auth.rs"]
mod relay_auth;
#[path = "worker_relays.rs"]
mod relay_config;
#[path = "worker_sign_trace.rs"]
mod sign_trace;
#[path = "worker_sign.rs"]
mod signing;
#[path = "worker_storage.rs"]
mod storage;
#[path = "worker_upload.rs"]
mod uploads;
#[path = "worker_value.rs"]
mod value_boundary;
#[path = "worker_zaps.rs"]
mod zaps;
use effects::pump;
#[path = "worker_schedule.rs"]
mod scheduler;
struct Host {
    preview_probed: bool,
    preview_busy: bool,
    bootstrap_relays: Vec<lkjstr_core::engine::wire::RelayConfig>,
    relay_owner: Option<(String, String)>,
    account_revision: u64,
    upload_tasks: Vec<uploads::Task>,
    upload_control: uploads::control::Control,
    upload_inflight: usize,
    relay_auth_jobs: relay_auth::Jobs,
    dm: direct_messages::State,
    zaps: zaps::State,
    private_lists: private_lists::Book,
    public_cache: public_cache::State,
    storage: storage::State,
    avatars: avatars::State,
    bunker: bunker::State,
    server_checks: Vec<(u64, String, String, String, u64)>, // shared four-request bound
    auth_next: u64,
    upload_auth: BTreeMap<(u64, String), (lkjstr_protocol::UnsignedNostrEvent, js_sys::Function)>,

    accounts: lkjstr_core::engine::accounts::Accounts,
    account_tasks: Vec<(u64, String, lkjstr_core::engine::wire::actions::Action)>,
    account_busy: bool,
    account_store: account_store::State,
    discovery: BTreeMap<(u64, String), u64>,
    loaded: bool,
    startup: Vec<(u64, lkjstr_core::engine::wire::Input, sign_trace::Stamp)>,
    sign_trace: sign_trace::Trace,
    status: Option<(usize, usize)>,
    engine: Engine,
    sessions: BTreeMap<u64, RefCell<lkjstr_core::engine::wire::Session>>,
    scope: Sink,
    sockets: BTreeMap<String, Socket>,
    schedule: scheduler::Schedule,
    db: Option<web_sys::IdbDatabase>,
    next_persist: u64,
    publication_persisted: u64,
    note_outbox: note_outbox::Writer,
    quality_persisted: u64,
    flushing: bool,
    retention_due: bool,
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
    crate::measure::epoch_now()
}
/// Call once inside a dedicated Worker after wasm-bindgen initialization.
#[wasm_bindgen]
pub fn start() -> Result<WorkerHandle, JsValue> {
    let scope = js_sys::global().dyn_into::<web_sys::DedicatedWorkerGlobalScope>()?;
    let mut state = Host::new(Sink::Dedicated(scope.clone()));
    state.sessions.insert(0, RefCell::default());
    let host = Rc::new(RefCell::new(state));
    let weak = Rc::downgrade(&host);
    let message = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            host.borrow_mut().receive_value(0, event.data());
            pump(&host);
        }
    });
    scope.set_onmessage(Some(message.as_ref().unchecked_ref()));
    scheduler::start(&host);
    load(&host);

    Ok(WorkerHandle { host, message })
}
fn post(host: &Host, out: &Output) {
    host.scope.post(out, &host.engine, &host.sessions);
}
#[path = "worker_handle.rs"]
mod handle;
#[path = "worker_stop.rs"]
mod shutdown;

#[path = "worker_wire.rs"]
mod wire_boundary;
