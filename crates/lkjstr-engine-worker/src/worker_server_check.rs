//! A row retry never uploads data. Optional BUD-06 failures stay unknown.
use super::*;
use lkjstr_core::engine::feedback::ServerEvidence;
use lkjstr_core::engine::wire::{Output, Session};
pub(in crate::worker) fn start(host: &mut Host, id: u64, req: String, server: String) {
    if !lkjstr_core::engine::settings::valid_server(&server) || host.upload_inflight >= 4 {
        host.scope.direct(id, &Session::failure(req, "rejected"));
        return;
    }
    let protocol = host.engine.server_row(&server)["protocol"]
        .as_str()
        .unwrap_or("unknown")
        .to_owned();
    let generation = host
        .engine
        .observe_server(&server, &protocol, ServerEvidence::Checking);
    host.upload_inflight += 1;
    host.server_checks
        .push((id, req, server, protocol, generation));
}
pub(in crate::worker) fn pump(host: &Rc<RefCell<Host>>) {
    for (id, req, server, protocol, generation) in
        std::mem::take(&mut host.borrow_mut().server_checks)
    {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let (protocol, evidence) = if protocol == "nip96" {
                (
                    protocol,
                    ServerEvidence::Required(
                        http::discover(&server, Deadline::new(clock()))
                            .await
                            .map(|_| ()),
                    ),
                )
            } else {
                let endpoint =
                    lkjstr_protocol::blossom_upload_endpoint(&server).unwrap_or_default();
                let response = crate::browser::http::request(
                    &endpoint,
                    "application/json",
                    65536,
                    "HEAD",
                    None,
                    None,
                    None,
                )
                .await;
                let answers = response.is_ok_and(|r| r.status == 200);
                (
                    if answers { "blossom".into() } else { protocol },
                    ServerEvidence::Optional(answers),
                )
            };
            let mut h = host.borrow_mut();
            h.upload_inflight = h.upload_inflight.saturating_sub(1);
            if h.stopped {
                return;
            }
            // A late row check must never overwrite a newer upload result.
            if h.engine
                .servers
                .get(&server)
                .is_some_and(|v| v.generation == generation)
            {
                h.engine.observe_server(&server, &protocol, evidence);
            }
            h.scope.direct(
                id,
                &Output::Result {
                    req,
                    ok: true,
                    uploaded: None,
                    key: None,
                    encrypted_key: None,
                    zap_intent: None,
                    dm_draft: None,
                    dm_draft_revision: None,
                    dm_delivery: None,
                    cancelled: None,
                    error: None,
                    delivery: None,
                    id: None,
                },
            );
        });
    }
}
