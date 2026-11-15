//! Four uploads, 20 MiB each. One visible destination; every signer/HTTP wait ends.
use super::*;
use lkjstr_core::engine::wire::{Output as W, Session};
use lkjstr_protocol::upload;
#[path = "worker_upload_http.rs"]
mod http;
#[path = "worker_upload_sign.rs"]
mod signing;
pub(super) struct Task {
    pub id: u64,
    pub req: String,
    pub account: String,
    pub name: String,
    pub mime: String,
    pub bytes: Vec<u8>,
    pub server: Option<String>,
}
pub(super) fn pump_uploads(host: &Rc<RefCell<Host>>) {
    let tasks = std::mem::take(&mut host.borrow_mut().upload_tasks);
    for mut task in tasks {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let result = task.run(&host).await;
            let mut h = host.borrow_mut();
            h.upload_inflight = h.upload_inflight.saturating_sub(1);
            if h.stopped {
                return;
            }
            let out = match result {
                Ok(uploaded) => {
                    task.progress(&h, "uploading", task.bytes.len());
                    W::Result {
                        req: task.req,
                        ok: true,
                        uploaded: Some(uploaded),
                        key: None,
                        error: None,
                        delivery: None,
                        id: None,
                    }
                }
                Err(code) => {
                    let mut result = Session::failure(task.req, code);
                    if let W::Result {
                        error: Some(error), ..
                    } = &mut result
                    {
                        error.code = code.into();
                        error.message = task.server;
                    }
                    result
                }
            };
            h.scope.direct(task.id, &out);
        });
    }
}
impl Task {
    fn progress(&self, host: &Host, phase: &str, sent: usize) {
        host.scope.direct(
            self.id,
            &W::Progress {
                req: self.req.clone(),
                server: self.server.clone(),
                phase: Some(phase.into()),
                sent,
                total: self.bytes.len(),
            },
        );
    }
    async fn run(&mut self, host: &Rc<RefCell<Host>>) -> Result<serde_json::Value, &'static str> {
        self.progress(&host.borrow(), "discovering", 0);
        host.borrow().accounts.require_signer(&self.account)?;
        if !(self.mime.starts_with("image/")
            || self.mime.starts_with("video/")
            || self.mime.starts_with("audio/"))
        {
            return Err("unsupported");
        }
        if self.server.is_none() {
            for _ in 0..150 {
                if host.borrow().stopped {
                    return Err("offline");
                }
                if host.borrow().engine.upload_servers_ready(&self.account) {
                    break;
                }
                crate::browser::promise::pause(100)
                    .await
                    .map_err(|_| "internal")?;
            }
            if !host.borrow().engine.upload_servers_ready(&self.account) {
                return Err("upload-discovery");
            }
            self.server = host
                .borrow()
                .engine
                .upload_servers(&self.account)
                .into_iter()
                .next();
        }
        let server = self.server.clone().ok_or("not-found")?;
        if !lkjstr_core::engine::settings::valid_server(&server) {
            return Err("rejected");
        }
        let nip96 = host.borrow().engine.upload_is_nip96(&server);
        let hash = upload::hash(&self.bytes);
        let mut blossom = !nip96;
        let mut endpoint = if blossom {
            lkjstr_protocol::blossom_upload_endpoint(&server).ok_or("rejected")?
        } else {
            self.progress(&host.borrow(), "discovering", 0);
            http::discover(&server).await?
        };
        loop {
            if host.borrow().stopped {
                return Err("offline");
            }
            self.progress(&host.borrow(), "signing", 0);
            let signed = signing::sign(
                host,
                self.id,
                upload::auth(
                    self.account.clone(),
                    now() / 1000,
                    &endpoint,
                    &hash,
                    blossom,
                ),
            )
            .await?;
            let auth = upload::authorization(&signed).map_err(|_| "internal")?;
            self.progress(&host.borrow(), "uploading", 0);
            let response = http::send(
                &endpoint,
                &auth,
                &self.name,
                &self.mime,
                &self.bytes,
                blossom,
            )
            .await;
            // Discover only when a server has no Blossom endpoint; refusals stay visible.
            if blossom
                && response
                    .as_ref()
                    .is_ok_and(|r| matches!(r.status, 404 | 405))
            {
                self.progress(&host.borrow(), "discovering", 0);
                endpoint = http::discover(&server).await?;
                blossom = false;
                continue;
            }
            // Some NIP-96 hosts refuse the Blossom preflight, hiding its HTTP status.
            let response = match response {
                Err("upload-network") if blossom => {
                    self.progress(&host.borrow(), "discovering", 0);
                    endpoint = http::discover(&server)
                        .await
                        .map_err(|_| "upload-network")?;
                    blossom = false;
                    continue;
                }
                other => other?,
            };
            http::status(response.status)?;
            let mut body = response.body;
            if !blossom && response.status == 202 {
                self.progress(&host.borrow(), "processing", 0);
                body = http::processed(&body).await?;
            }
            let value =
                upload::uploaded(&body, &self.mime, &hash, blossom).ok_or("upload-response")?;
            let mut h = host.borrow_mut();
            // At most 64 remembered server observations.
            if h.engine.servers.len() >= 64
                && let Some(old) = h.engine.servers.keys().next().cloned()
            {
                h.engine.servers.remove(&old);
            }
            h.engine.servers.insert(
                server,
                (if blossom { "blossom" } else { "nip96" }.into(), true),
            );
            h.engine.invalidate();
            return Ok(value);
        }
    }
}
