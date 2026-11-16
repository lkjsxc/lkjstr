use super::*;
use lkjstr_protocol::remote::Remote;
pub(in crate::worker) struct Call<'a> {
    pub client: u64,
    pub account: Option<&'a str>,
    pub captured: Option<&'a policy::Authority>,
    pub action_req: Option<&'a str>,
    pub method: &'a str,
    pub ms: u32,
    pub private: bool,
    pub signal: Option<&'a web_sys::AbortSignal>,
}
pub(in crate::worker) async fn call(
    host: &Rc<RefCell<Host>>,
    remote: &Remote,
    call: Call<'_>,
    params: Vec<String>,
) -> Result<String, &'static str> {
    crate::browser::abort::check(call.signal).map_err(|_| crate::browser::abort::CANCELLED)?;
    let controller = web_sys::AbortController::new().map_err(|_| "internal")?;
    let signal = controller.signal();
    let reason = Rc::new(Cell::new(None));
    let nonce = crate::browser::random_bytes::<16>()?;
    let lease = {
        let mut h = host.borrow_mut();
        sync(&mut h);
        let account = call
            .account
            .map(|account| {
                call.captured
                    .cloned()
                    .or_else(|| authority(&h, account))
                    .map(|a| (account.to_string(), a))
                    .ok_or("signer-missing")
            })
            .transpose()?;
        if account
            .as_ref()
            .is_some_and(|(_, a)| Some(a.client.clone()) != remote.client())
        {
            return Err("offline");
        }
        if let Some(req) = call.action_req {
            for old in h.bunker.book.replace(call.client, req) {
                release(&mut h, old);
            }
        }
        let owner = policy::Owner {
            client: call.client,
            account,
            request: call.action_req.map(str::to_owned),
        };
        let (clients, accounts) = context(&h, Some(&owner));
        let now = h.time();
        let start = policy::Start {
            owner,
            peer: remote.peer.clone(),
            method: policy::Method::parse(call.method).ok_or("unsupported")?,
            expires_at: now.saturating_add(u64::from(call.ms.min(60_000))),
        };
        let lease = h.bunker.book.start(
            start,
            now,
            &policy::Context {
                clients: &clients,
                accounts: &accounts,
            },
        )?;
        h.bunker.flights.insert(
            lease,
            Flight {
                handle: format!(
                    "bunker-auth-{}-{}",
                    lease.serial(),
                    lkjstr_nips::hex(&nonce)
                ),
                controller: controller.clone(),
                reason: reason.clone(),
            },
        );
        lease
    };
    // Listener must never borrow Host: cancellation may run during a Host mutation.
    let parent = call
        .signal
        .map(|signal| {
            let controller = controller.clone();
            let reason = reason.clone();
            crate::browser::abort::listen(signal, move || {
                reason.set(Some(policy::Reason::Revoked));
                controller.abort();
            })
        })
        .transpose();
    if parent.is_err() {
        end(&mut host.borrow_mut(), lease, policy::Reason::Revoked);
        return Err("internal");
    }
    let weak = Rc::downgrade(host);
    let handler = Rc::new(move |url| {
        let host = weak.upgrade().ok_or("offline")?;
        announce(&mut host.borrow_mut(), lease, url)
    });
    let result = crate::browser::remote::rpc_owned(
        remote,
        call.method,
        params,
        call.ms.min(60_000),
        Some(&signal),
        call.private,
        handler,
    )
    .await;
    drop(parent);
    {
        let mut h = host.borrow_mut();
        sync(&mut h);
        end(&mut h, lease, policy::Reason::Finished);
    }
    match reason.get() {
        Some(policy::Reason::Finished) => result,
        Some(policy::Reason::Unsupported) => Err("unsupported"),
        Some(policy::Reason::Cancelled) => Err("signer-refused"),
        Some(policy::Reason::Expired) => Err(if call.private {
            "signer-timeout"
        } else {
            "signer-missing"
        }),
        Some(policy::Reason::Limited) => Err("too-large"),
        _ if call.signal.is_some_and(web_sys::AbortSignal::aborted) => {
            Err(crate::browser::abort::CANCELLED)
        }
        _ => Err("offline"),
    }
}
