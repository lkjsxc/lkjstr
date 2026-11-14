//! Same engine host with namespaced MessagePorts for one engine per origin.
use super::*;
use lkjstr_core::engine::clients::Clients;
use serde::Serialize;
pub(super) struct Peer {
    port: web_sys::MessagePort,
    _handler: Closure<dyn FnMut(web_sys::MessageEvent)>,
}
pub(super) enum Sink {
    Dedicated(web_sys::DedicatedWorkerGlobalScope),
    Shared {
        clients: Clients,
        peers: BTreeMap<u64, Peer>,
    },
}
impl Sink {
    pub(super) fn post(
        &self,
        out: &Output,
        engine: &Engine,
        sessions: &BTreeMap<u64, RefCell<lkjstr_core::engine::wire::Session>>,
    ) {
        match self {
            Self::Dedicated(scope) => {
                if let Some(session) = sessions.get(&0) {
                    for out in session.borrow_mut().output(out.clone(), engine) {
                        send(scope.as_ref(), &out);
                    }
                }
            }
            Self::Shared { clients, peers } => {
                for (id, out) in clients.output(out.clone()) {
                    if let (Some(peer), Some(session)) = (peers.get(&id), sessions.get(&id)) {
                        for out in session.borrow_mut().output(out, engine) {
                            send(peer.port.as_ref(), &out);
                        }
                    }
                }
            }
        }
    }
    pub(super) fn direct(&self, id: u64, out: &lkjstr_core::engine::wire::Output) {
        match self {
            Self::Dedicated(scope) => send(scope.as_ref(), out),
            Self::Shared { peers, .. } => {
                if let Some(peer) = peers.get(&id) {
                    send(peer.port.as_ref(), out);
                }
            }
        }
    }
    pub(super) fn close(&mut self) {
        match self {
            Self::Dedicated(scope) => scope.set_onmessage(None),
            Self::Shared { peers, .. } => {
                for peer in peers.values() {
                    peer.port.set_onmessage(None);
                    peer.port.close();
                }
                peers.clear();
            }
        }
    }
}
#[wasm_bindgen]
pub struct SharedWorkerHandle {
    host: Rc<RefCell<Host>>,
    scope: web_sys::SharedWorkerGlobalScope,
    _connect: Closure<dyn FnMut(web_sys::MessageEvent)>,
}
#[wasm_bindgen]
pub fn start_shared() -> Result<SharedWorkerHandle, JsValue> {
    let scope = js_sys::global().dyn_into::<web_sys::SharedWorkerGlobalScope>()?;
    let host = Rc::new(RefCell::new(Host {
        engine: initial_engine(),
        sessions: BTreeMap::new(),
        scope: Sink::Shared {
            clients: Clients::default(),
            peers: BTreeMap::new(),
        },
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
    let connect = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            let ports = event.ports();
            for value in ports.iter() {
                if let Ok(port) = value.dyn_into::<web_sys::MessagePort>() {
                    attach(&host, port);
                }
            }
        }
    });
    scope.set_onconnect(Some(connect.as_ref().unchecked_ref()));
    schedule(&host);
    load(&host);
    Ok(SharedWorkerHandle {
        host,
        scope,
        _connect: connect,
    })
}
fn attach(host: &Rc<RefCell<Host>>, port: web_sys::MessagePort) {
    let id = {
        let mut h = host.borrow_mut();
        let Sink::Shared { clients, .. } = &mut h.scope else {
            return;
        };
        clients.connect(now())
    };
    let Some(id) = id else {
        port.close();
        return;
    };
    let weak = Rc::downgrade(host);
    let handler = Closure::new(move |event: web_sys::MessageEvent| {
        if let Some(host) = weak.upgrade() {
            #[cfg(feature = "harness")]
            if js_sys::Reflect::get(&event.data(), &"t".into())
                .ok()
                .and_then(|v| v.as_string())
                .as_deref()
                == Some("test.relays")
            {
                if let Ok(value) = js_sys::Reflect::get(&event.data(), &"relays".into())
                    && let Ok(relays) = serde_wasm_bindgen::from_value::<Vec<String>>(value)
                {
                    let mut h = host.borrow_mut();
                    let at = h.time();
                    h.engine.input(Input::Configure { relays }, at);
                }
                pump(&host);
                return;
            }
            if let Ok(input) =
                serde_wasm_bindgen::from_value::<lkjstr_core::engine::wire::Input>(event.data())
            {
                host.borrow_mut().receive(id, input);
            }
            pump(&host);
        }
    });
    port.set_onmessage(Some(handler.as_ref().unchecked_ref()));
    port.start();
    ready(port.as_ref(), true);
    host.borrow_mut().sessions.insert(id, RefCell::default());
    if let Sink::Shared { peers, .. } = &mut host.borrow_mut().scope {
        peers.insert(
            id,
            Peer {
                port,
                _handler: handler,
            },
        );
    }
}
#[wasm_bindgen]
impl SharedWorkerHandle {
    pub fn stop(&mut self) {
        self.scope.set_onconnect(None);
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
impl Drop for SharedWorkerHandle {
    fn drop(&mut self) {
        self.stop();
    }
}

fn send(target: &JsValue, out: &lkjstr_core::engine::wire::Output) {
    if let Ok(value) = out.serialize(&serde_wasm_bindgen::Serializer::json_compatible())
        && let Ok(post) = js_sys::Reflect::get(target, &"postMessage".into())
        && let Some(post) = post.dyn_ref::<js_sys::Function>()
    {
        let _ = post.call1(target, &value);
    }
}
pub(super) fn ready(target: &JsValue, shared: bool) {
    send(target, &lkjstr_core::engine::wire::Session::ready(shared));
    send(
        target,
        &lkjstr_core::engine::wire::Output::Accounts {
            accounts: vec![],
            active: None,
        },
    );
}
