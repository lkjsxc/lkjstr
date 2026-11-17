//! Drain relay effects outside callbacks, then service bounded Worker jobs.
use super::*;
use crate::browser::socket::SocketEvent;
use lkjstr_core::engine::network::Effect;
use std::rc::Weak;
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    bunker::sync(&mut host.borrow_mut());
    let (effects, outputs) = {
        let mut h = host.borrow_mut();
        (h.engine.network.drain_effects(), h.engine.drain())
    };
    for o in outputs {
        if direct_messages::output(host, &o) {
            continue;
        }
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
                let sent = host
                    .borrow()
                    .sockets
                    .get(&url)
                    .is_some_and(|s| s.send(&text));
                host.borrow_mut()
                    .engine
                    .network
                    .publication_frame_sent(&url, &text, sent);
            }
        }
    }
    storage::pump(host);
    public_cache::pump(host);
    persist(host);
    identity::identities(host);
    accounts::pump_accounts(host);
    zaps::pump(host);
    accounts::status(host);
    relay_auth::pump_auth(host);
    uploads::pump_uploads(host);
    uploads::checks::pump(host);
    shared::expire(host);
    previews::pump_previews(host);
    direct_messages::pump(host);
    private_lists::pump(host);
}
