//! Correlated, serialized private crypto. Only NIP-44 writes; NIP-04 is read-only.
use super::*;
#[path = "worker_dm_extension.rs"]
mod extension;
use dm::signers::Read;
use lkjstr_core::engine::{accounts::secret::SecretText, upload::Deadline};
pub(super) fn random() -> Result<[u8; 32], &'static str> {
    crate::browser::random_bytes()
}
struct Call<'a> {
    client: u64,
    account: &'a str,
    peer: &'a str,
    operation: &'a str,
    read: Option<&'a Read>,
    list: Option<&'a lkjstr_core::engine::private_lists::Job>,
}
pub(super) async fn crypt(
    host: &Rc<RefCell<Host>>,
    client: u64,
    account: &str,
    peer: &str,
    operation: &str,
    data: String,
    deadline: Deadline,
) -> Result<String, &'static str> {
    crypt_for(
        host,
        Call {
            client,
            account,
            peer,
            operation,
            read: None,
            list: None,
        },
        data,
        deadline,
    )
    .await
}
pub(super) async fn read(
    host: &Rc<RefCell<Host>>,
    read: &Read,
    peer: &str,
    operation: &str,
    data: String,
    deadline: Deadline,
) -> Result<String, &'static str> {
    crypt_for(
        host,
        Call {
            client: read.client(),
            account: read.account(),
            peer,
            operation,
            read: Some(read),
            list: None,
        },
        data,
        deadline,
    )
    .await
}
pub(super) async fn list(
    host: &Rc<RefCell<Host>>,
    job: &lkjstr_core::engine::private_lists::Job,
    data: String,
) -> Result<String, &'static str> {
    crypt_for(
        host,
        Call {
            client: job.client,
            account: &job.account,
            peer: &job.account,
            operation: job.format.operation(),
            read: None,
            list: Some(job),
        },
        data,
        Deadline::within(uploads::clock(), 90_000),
    )
    .await
}
async fn crypt_for(
    host: &Rc<RefCell<Host>>,
    call: Call<'_>,
    data: String,
    deadline: Deadline,
) -> Result<String, &'static str> {
    let data = SecretText::new(data);
    if data.len() > lkjstr_nips::nip44::MAX_PAYLOAD {
        return Err("too-large");
    }
    let epoch = {
        let mut h = host.borrow_mut();
        signers::sync(&mut h);
        let epoch = lifetime::lease(&h, call.client, call.account)?;
        if call.list.is_none() {
            h.dm.signers.gate.allowed(call.account, epoch)?;
        }
        if let Some(job) = call.list {
            private_lists::check(&h, job)?;
        }
        if let Some(read) = call.read {
            signers::check_read(&h, read)?;
        }
        if let Some(value) =
            h.accounts
                .crypt(call.account, call.peer, call.operation, &data, &random()?)?
        {
            return Ok(value);
        }
        epoch
    };
    let pending = if let Some(job) = call.list {
        let mut h = host.borrow_mut();
        let pending = signers::begin_list(&mut h, call.client, call.account, epoch, data)?;
        if let Err(code) = private_lists::bind(&mut h, job, pending.lease.clone()) {
            signers::cancel_list(&mut h, &pending.lease);
            return Err(code);
        }
        pending
    } else {
        signers::begin(
            &mut host.borrow_mut(),
            call.client,
            call.account,
            epoch,
            call.read,
            data,
        )?
    };
    let waiting = match deadline.wait(uploads::clock(), u32::MAX) {
        Ok(ms) => crate::browser::promise::bounded_ms_for(
            pending.ready,
            ms,
            "signer-missing",
            || {},
            Some(&pending.signal),
        )
        .await
        .map_err(|_| "signer-missing"),
        Err(_) => Err("signer-missing"),
    };
    if let Err(code) = waiting {
        return signers::finish(&mut host.borrow_mut(), &pending.lease, Err(code), false);
    }
    signers::check(&host.borrow(), &pending.lease)?;
    if let Some(job) = call.list {
        private_lists::check(&host.borrow(), job)?;
    }
    let ms = match deadline.wait(uploads::clock(), 60_000) {
        Ok(ms) => ms,
        Err(_) => {
            return signers::finish(
                &mut host.borrow_mut(),
                &pending.lease,
                Err("signer-missing"),
                false,
            );
        }
    };
    let remote = host.borrow().accounts.remote(call.account);
    let data = signers::take_input(&mut host.borrow_mut(), &pending.lease)?;
    let outcome = if let Some(remote) = remote {
        let method = match call.operation {
            "nip44.encrypt" => "nip44_encrypt",
            "nip44.decrypt" => "nip44_decrypt",
            "nip04.decrypt" => "nip04_decrypt",
            _ => {
                return signers::finish(
                    &mut host.borrow_mut(),
                    &pending.lease,
                    Err("unsupported"),
                    false,
                );
            }
        };
        let params = vec![call.peer.into(), data.to_string()];
        drop(data);
        crate::browser::remote::rpc_private(&remote, method, params, ms, Some(&pending.signal))
            .await
    } else {
        let request = extension::begin(&mut host.borrow_mut(), &call, &data, &pending.lease);
        drop(data);
        match request {
            Ok(request) => extension::finish(host, request, &pending.signal, ms).await,
            Err(code) => Err(code),
        }
    };
    let outcome = outcome.and_then(|value| {
        if value.len() > lkjstr_nips::nip44::MAX_PAYLOAD {
            drop(SecretText::new(value));
            Err("too-large")
        } else {
            Ok(value)
        }
    });
    signers::finish(&mut host.borrow_mut(), &pending.lease, outcome, true)
}
