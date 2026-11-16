//! Correlated, bounded external crypto. Only NIP-44 writes; NIP-04 is read-only.
use super::*;
use lkjstr_core::engine::upload::Deadline;
pub(super) fn random() -> Result<[u8; 32], &'static str> {
    crate::browser::random_bytes()
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
    let epoch = lifetime::lease(&host.borrow(), client, account)?;
    if data.len() > lkjstr_nips::nip44::MAX_PAYLOAD {
        return Err("too-large");
    }
    let local = host
        .borrow()
        .accounts
        .crypt(account, peer, operation, &data, &random()?)?;
    if let Some(value) = local {
        return Ok(value);
    }
    let ms = deadline
        .wait(uploads::clock(), 60_000)
        .map_err(|_| "signer-missing")?;
    let remote = host.borrow().accounts.remote(account);
    if let Some(remote) = remote {
        let method = match operation {
            "nip44.encrypt" => "nip44_encrypt",
            "nip44.decrypt" => "nip44_decrypt",
            "nip04.decrypt" => "nip04_decrypt",
            _ => return Err("unsupported"),
        };
        let result =
            crate::browser::remote::rpc_for(&remote, method, vec![peer.into(), data], ms).await;
        lifetime::check(&host.borrow(), client, account, epoch)?;
        return result;
    }
    let req = {
        let h = host.borrow();
        if h.dm.crypto.len() >= 8 {
            return Err("too-large");
        }
        format!(
            "dm-crypto-{}",
            lkjstr_nips::hex(&crate::browser::random_bytes::<16>()?)
        )
    };
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let mut h = host.borrow_mut();
        h.dm.crypto
            .insert((client, req.clone()), (account.into(), resolve));
        h.scope.direct(
            client,
            &W::Crypt {
                req: req.clone(),
                pubkey: account.into(),
                peer: peer.into(),
                operation: operation.into(),
                data: data.clone(),
            },
        );
    });
    let result = crate::browser::promise::bounded_ms(promise, ms, "signer-missing", || {}).await;
    host.borrow_mut().dm.crypto.remove(&(client, req));
    lifetime::check(&host.borrow(), client, account, epoch)?;
    let reply = result.map_err(|_| "signer-missing")?;
    if let Ok(code) = js_sys::Reflect::get(&reply, &"error".into())
        && let Some(code) = code.as_string()
    {
        return Err(match code.as_str() {
            "unsupported" => "unsupported",
            "signer-missing" => "signer-missing",
            _ => "signer-refused",
        });
    }
    let value = reply.as_string().ok_or("signer-refused")?;
    if value.len() > lkjstr_nips::nip44::MAX_PAYLOAD {
        return Err("too-large");
    }
    Ok(value)
}
