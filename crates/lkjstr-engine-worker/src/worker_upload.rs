//! Four concurrent uploads, 20 MiB each; auth waits and HTTP requests are bounded.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session};
use lkjstr_protocol::{UnsignedNostrEvent, upload};
pub(super) fn pump_uploads(host: &Rc<RefCell<Host>>) {
    let tasks = std::mem::take(&mut host.borrow_mut().upload_tasks);
    for (id, req, account, name, mime, bytes) in tasks {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let result = run(&host, id, &account, &name, &mime, &bytes).await;
            let mut h = host.borrow_mut();
            h.upload_inflight = h.upload_inflight.saturating_sub(1);
            if h.stopped {
                return;
            }
            let out = match result {
                Ok(uploaded) => {
                    h.scope.direct(
                        id,
                        &W::Progress {
                            req: req.clone(),
                            sent: bytes.len(),
                            total: bytes.len(),
                        },
                    );
                    W::Result {
                        req,
                        ok: true,
                        uploaded: Some(uploaded),
                        key: None,
                        error: None,
                        delivery: None,
                        id: None,
                    }
                }
                Err(code) => Session::failure(req, code),
            };
            h.scope.direct(id, &out);
        });
    }
}
async fn sign(
    host: &Rc<RefCell<Host>>,
    id: u64,
    event: UnsignedNostrEvent,
) -> Result<lkjstr_protocol::NostrEvent, &'static str> {
    let remote = host.borrow().accounts.remote(&event.pubkey);
    if let Some(remote) = remote {
        let raw = crate::browser::remote::rpc(
            &remote,
            "sign_event",
            vec![serde_json::to_string(&event).map_err(|_| "internal")?],
        )
        .await?;
        let signed =
            lkjstr_protocol::parse_nostr_event_json(&raw, None).map_err(|_| "signer-refused")?;
        lkjstr_core::actions::validate_signed_event(&event, &signed)
            .map_err(|_| "signer-refused")?;
        return Ok(signed);
    }
    let local = host.borrow().accounts.sign(&event)?;
    if let Some(event) = local {
        return Ok(event);
    }
    let req = {
        let mut h = host.borrow_mut();
        h.auth_next += 1;
        format!("upload-auth-{}", h.auth_next)
    };
    let promise = js_sys::Promise::new(&mut |resolve, _| {
        let mut h = host.borrow_mut();
        h.upload_auth
            .insert((id, req.clone()), (event.clone(), resolve));
        h.scope.direct(
            id,
            &W::Sign {
                req: req.clone(),
                pubkey: event.pubkey.clone(),
                event: serde_json::to_string(&event).unwrap_or_default(),
            },
        );
    });
    let result = crate::browser::promise::bounded(promise, 60, "signer-missing", || {}).await;
    host.borrow_mut().upload_auth.remove(&(id, req));
    let raw = result
        .map_err(|_| "signer-missing")?
        .as_string()
        .ok_or("signer-refused")?;
    let signed =
        lkjstr_protocol::parse_nostr_event_json(&raw, None).map_err(|_| "signer-refused")?;
    lkjstr_core::actions::validate_signed_event(&event, &signed).map_err(|_| "signer-refused")?;
    Ok(signed)
}
async fn run(
    host: &Rc<RefCell<Host>>,
    id: u64,
    account: &str,
    name: &str,
    mime: &str,
    bytes: &[u8],
) -> Result<serde_json::Value, &'static str> {
    host.borrow().accounts.require_signer(account)?;
    if !(mime.starts_with("image/") || mime.starts_with("video/") || mime.starts_with("audio/")) {
        return Err("unsupported");
    }
    for _ in 0..150 {
        if host.borrow().stopped {
            return Err("offline");
        }
        if host.borrow().engine.upload_servers_ready(account) {
            break;
        }
        crate::browser::promise::pause(100)
            .await
            .map_err(|_| "internal")?;
    }
    if !host.borrow().engine.upload_servers_ready(account) {
        return Err("offline");
    }
    let servers = {
        let h = host.borrow();
        h.engine.upload_servers(account)
    };
    if servers.is_empty() {
        return Err("not-found");
    }
    let hash = upload::hash(bytes);
    let mut failure = "offline";
    for server in servers.into_iter().take(8) {
        if !lkjstr_core::engine::settings::valid_server(&server) {
            continue;
        }
        for blossom in [true, false] {
            if host.borrow().stopped {
                return Err("offline");
            }
            let endpoint = if blossom {
                format!("{}/upload", server.trim_end_matches('/'))
            } else {
                let parsed = url_origin(&server).ok_or("rejected")?;
                let discovery = crate::browser::http::get(
                    &format!("{parsed}/.well-known/nostr/nip96.json"),
                    "application/json",
                    65536,
                )
                .await;
                let Ok(discovery) = discovery else {
                    continue;
                };
                let value: serde_json::Value =
                    serde_json::from_str(&discovery.body).unwrap_or_default();
                let Some(api) = value["api_url"]
                    .as_str()
                    .filter(|u| lkjstr_core::engine::settings::valid_server(u))
                else {
                    continue;
                };
                api.to_owned()
            };
            let event = sign(
                host,
                id,
                upload::auth(account.into(), now() / 1000, &endpoint, &hash, blossom),
            )
            .await?;
            let auth = upload::authorization(&event).map_err(|_| "internal")?;
            let data = js_sys::Uint8Array::from(bytes);
            let body: JsValue = if blossom {
                data.into()
            } else {
                let parts = js_sys::Array::new();
                parts.push(&data);
                let options = web_sys::BlobPropertyBag::new();
                options.set_type(mime);
                let blob = web_sys::Blob::new_with_u8_array_sequence_and_options(&parts, &options)
                    .map_err(|_| "internal")?;
                let form = web_sys::FormData::new().map_err(|_| "internal")?;
                form.append_with_blob_and_filename("file", &blob, name)
                    .map_err(|_| "internal")?;
                form.into()
            };
            let response = crate::browser::http::request(
                &endpoint,
                "application/json",
                65536,
                if blossom { "PUT" } else { "POST" },
                Some(&body),
                if blossom { Some(mime) } else { None },
                Some(&auth),
            )
            .await;
            if let Ok(response) = response {
                failure = if response.status == 413 {
                    "too-large"
                } else {
                    "rejected"
                };
                if matches!(response.status, 200 | 201)
                    && let Some(value) = upload::uploaded(&response.body, mime, &hash, blossom)
                {
                    let mut h = host.borrow_mut();
                    // At most 64 discovered servers across replaced lists.
                    if h.engine.servers.len() >= 64
                        && let Some(old) = h.engine.servers.keys().next().cloned()
                    {
                        h.engine.servers.remove(&old);
                    }
                    h.engine.servers.insert(
                        server.clone(),
                        (if blossom { "blossom" } else { "nip96" }.into(), true),
                    );
                    h.engine.invalidate();
                    return Ok(value);
                }
            }
        }
    }
    Err(failure)
}
fn url_origin(url: &str) -> Option<String> {
    let authority = url.strip_prefix("https://")?.split('/').next()?;
    Some(format!("https://{authority}"))
}
