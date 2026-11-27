use super::*;
use lkjstr_core::engine::upload::Deadline;
pub(super) fn start(host: &Rc<RefCell<Host>>, job: InvoiceWork) {
    let controller = match AbortController::new() {
        Ok(value) => value,
        Err(_) => {
            host.borrow_mut()
                .engine
                .zaps
                .jobs
                .fail_invoice(job.token, Failure::Network);
            return;
        }
    };
    host.borrow_mut()
        .zaps
        .invoices
        .insert(job.token, controller.clone());
    let host = host.clone();
    wasm_bindgen_futures::spawn_local(async move {
        let result = run(&host, &job, &controller).await;
        let mut h = host.borrow_mut();
        h.zaps.invoices.remove(&job.token);
        if !h.stopped
            && let Err(error) = result
        {
            h.engine.zaps.jobs.fail_invoice(job.token, error);
        }
        h.wake();
    });
}
fn eligible(h: &Host, job: &InvoiceWork, signal: &web_sys::AbortSignal) -> Result<(), Failure> {
    if h.stopped
        || signal.aborted()
        || !h.sessions.contains_key(&job.owner.client)
        || !h
            .engine
            .zaps
            .jobs
            .invoice_active(job.token, &job.owner, &job.account, h.time() / 1000)
    {
        return Err(Failure::Cancelled);
    }
    h.accounts
        .require_signer(&job.account)
        .map_err(|_| Failure::SignerMissing)
}
async fn run(
    host: &Rc<RefCell<Host>>,
    job: &InvoiceWork,
    controller: &AbortController,
) -> Result<(), Failure> {
    let signal = controller.signal();
    eligible(&host.borrow(), job, &signal)?;
    let remaining = job
        .deadline
        .saturating_mul(1000)
        .saturating_sub(host.borrow().time())
        .min(90_000) as u32;
    if remaining == 0 {
        return Err(Failure::Network);
    }
    let deadline = Deadline::within(uploads::clock(), u64::from(remaining));
    let cancel = controller.clone();
    let _deadline = crate::browser::timer::Timer::after(remaining, move || cancel.abort())
        .map_err(|_| Failure::Network)?;
    for (index, request) in job.requests.iter().enumerate() {
        {
            let h = host.borrow();
            eligible(&h, job, &signal)?;
            request.current(&h.engine.store, h.time() / 1000)?;
        }
        let unsigned = serde_json::from_value(
            serde_json::to_value(&request.event).map_err(|_| Failure::Rejected)?,
        )
        .map_err(|_| Failure::Rejected)?;
        let signed = uploads::signing::sign_detailed_for(
            host,
            job.owner.client,
            deadline,
            unsigned,
            Some(&signal),
            Some(&job.owner.req),
        )
        .await
        .map_err(signer_failure)?;
        let (callback, json) = {
            let h = host.borrow();
            eligible(&h, job, &signal)?;
            let signed = policy_event(&signed)?;
            h.engine.zaps.jobs.callback(
                &h.engine.store,
                job.token,
                index,
                &signed,
                h.time() / 1000,
            )?
        };
        let response = crate::browser::http_public::get(&callback, 10_000, &signal)
            .await
            .map_err(http_failure);
        {
            let mut h = host.borrow_mut();
            eligible(&h, job, &signal)?;
            let at = h.time() / 1000;
            let Engine { store, zaps, .. } = &mut h.engine;
            if !zaps.jobs.invoice_response(
                store,
                job.token,
                index,
                (&json, &callback, response),
                at,
            ) {
                return Err(Failure::Cancelled);
            }
        }
    }
    Ok(())
}
fn policy_event(raw: &lkjstr_protocol::NostrEvent) -> Result<lkjstr_nips::event::Event, Failure> {
    serde_json::from_value(serde_json::to_value(raw).map_err(|_| Failure::Rejected)?)
        .map_err(|_| Failure::Rejected)
}
fn signer_failure(error: &str) -> Failure {
    match error {
        "signer-missing" => Failure::SignerMissing,
        "signer-timeout" => Failure::SignerTimeout,
        "upload-cancelled" => Failure::Cancelled,
        _ => Failure::SignerRefused,
    }
}
