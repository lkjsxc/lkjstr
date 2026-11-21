//! Effects for core zap policy. Never sends kind 9734 to a relay or pays an invoice.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session};
use lkjstr_core::engine::zaps::{self as policy, Failure, InvoiceWork, Owner, QueryReply};
use web_sys::AbortController;
#[path = "worker_zap_input.rs"]
mod input;
#[path = "worker_zap_invoice.rs"]
mod invoice;
#[path = "worker_zap_lifetime.rs"]
mod lifetime;
pub(super) use input::input;
pub(super) use lifetime::{account_change, committed, detach, stop};
#[derive(Default)]
pub(super) struct State {
    providers: BTreeMap<u64, AbortController>,
    invoices: BTreeMap<u64, AbortController>,
    revision: (u64, u64),
}
pub(super) fn pump(host: &Rc<RefCell<Host>>) {
    let effects = {
        let mut h = host.borrow_mut();
        if h.stopped {
            return;
        }
        let revision = h.engine.zaps.revision();
        if h.zaps.revision != revision {
            h.zaps.revision = revision;
            h.account_revision = u64::MAX;
        }
        let effects = h.engine.zaps.effects();
        for token in &effects.abort_providers {
            if let Some(controller) = h.zaps.providers.remove(token) {
                controller.abort();
            }
        }
        for token in &effects.abort_invoices {
            if let Some(controller) = h.zaps.invoices.remove(token) {
                controller.abort();
            }
        }
        for (owner, reply) in h.engine.zaps.jobs.replies() {
            if !h.sessions.contains_key(&owner.client) {
                continue;
            }
            let out = match reply {
                QueryReply::Quote(quote) => W::ZapQuote {
                    req: owner.req,
                    quote,
                },
                QueryReply::Receipts(page) => W::ZapReceipts {
                    req: owner.req,
                    page,
                },
            };
            h.scope.direct(owner.client, &out);
        }
        let at = h.time() / 1000;
        let Engine { store, zaps, .. } = &mut h.engine;
        zaps.jobs.revalidate_outcomes(store, at);
        for (owner, result) in h.engine.zaps.jobs.outcomes() {
            if !h.sessions.contains_key(&owner.client) {
                continue;
            }
            let out = match result {
                Ok(batch) => W::Result {
                    req: owner.req,
                    ok: true,
                    error: None,
                    delivery: None,
                    id: None,
                    uploaded: None,
                    key: None,
                    encrypted_key: None,
                    dm_draft: None,
                    dm_draft_revision: None,
                    dm_delivery: None,
                    client_info: None,
                    cancelled: None,
                    zap_intent: Some(batch),
                },
                Err(Failure::Cancelled) => W::Result {
                    req: owner.req,
                    ok: false,
                    error: None,
                    delivery: None,
                    id: None,
                    uploaded: None,
                    key: None,
                    encrypted_key: None,
                    dm_draft: None,
                    dm_draft_revision: None,
                    dm_delivery: None,
                    client_info: None,
                    cancelled: Some(true),
                    zap_intent: None,
                },
                Err(error) => Session::failure(owner.req, failure(error)),
            };
            h.scope.direct(owner.client, &out);
        }
        effects
    };
    for job in effects.providers {
        provider(host, job);
    }
    for job in effects.invoices {
        invoice::start(host, job);
    }
}
fn provider(host: &Rc<RefCell<Host>>, job: policy::Discovery) {
    let Ok(controller) = AbortController::new() else {
        let mut h = host.borrow_mut();
        let at = h.time() / 1000;
        let Engine { store, zaps, .. } = &mut h.engine;
        zaps.provider_response(store, &job, Err(Failure::Network), at);
        return;
    };
    host.borrow_mut()
        .zaps
        .providers
        .insert(job.token, controller.clone());
    let weak = Rc::downgrade(host);
    wasm_bindgen_futures::spawn_local(async move {
        let result =
            crate::browser::http_public::get(&job.binding.endpoint, 14_000, &controller.signal())
                .await
                .map_err(http_failure);
        if let Some(host) = weak.upgrade() {
            let mut h = host.borrow_mut();
            h.zaps.providers.remove(&job.token);
            if h.stopped {
                return;
            }
            let at = h.time() / 1000;
            let Engine { store, zaps, .. } = &mut h.engine;
            zaps.provider_response(store, &job, result, at);
        }
    });
}
fn http_failure(error: JsValue) -> Failure {
    if error.as_string().as_deref() == Some("body-limit") {
        Failure::TooLarge
    } else {
        Failure::Network
    }
}
pub(super) fn failure(error: Failure) -> &'static str {
    match error {
        Failure::NotFound => "not-found",
        Failure::Unsupported => "unsupported",
        Failure::Rejected | Failure::Untrusted | Failure::Stale | Failure::Expired => "rejected",
        Failure::TooLarge => "too-large",
        Failure::Network => "offline",
        Failure::SignerMissing => "signer-missing",
        Failure::SignerRefused => "signer-refused",
        Failure::SignerTimeout => "signer-timeout",
        Failure::Cancelled => "cancelled",
    }
}
