//! One destination attempt; only its own required HTTP failure permits fallback.
use super::*;
use lkjstr_core::engine::{feedback::ServerEvidence, upload::AttemptFailure};
use lkjstr_protocol::upload;
impl Task {
    fn record<T>(
        &self,
        host: &Rc<RefCell<Host>>,
        server: &str,
        blossom: bool,
        result: Result<T, &'static str>,
    ) -> Result<T, AttemptFailure> {
        host.borrow_mut().engine.observe_server(
            server,
            if blossom { "blossom" } else { "nip96" },
            ServerEvidence::Required(result.as_ref().map(|_| ()).map_err(|e| *e)),
        );
        result.map_err(AttemptFailure::required)
    }
    pub(super) async fn run_server(
        &self,
        host: &Rc<RefCell<Host>>,
        server: &str,
    ) -> Result<serde_json::Value, AttemptFailure> {
        if !lkjstr_core::engine::settings::valid_server(server) {
            return Err("rejected".into());
        }
        let nip96 = host.borrow().engine.upload_is_nip96(server);
        let hash = upload::hash(&self.bytes);
        let mut blossom = !nip96;
        let mut endpoint = if blossom {
            lkjstr_protocol::blossom_upload_endpoint(server).ok_or("rejected")?
        } else {
            self.progress(&host.borrow(), "discovering", 0);
            self.record(
                host,
                server,
                false,
                http::discover(server, self.deadline).await,
            )?
        };
        loop {
            if host.borrow().stopped {
                return Err("offline".into());
            }
            self.progress(&host.borrow(), "signing", 0);
            let signed = signing::sign(
                host,
                self.id,
                self.deadline,
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
                self.deadline,
            )
            .await;
            // Discover only when a server has no Blossom endpoint; refusals stay visible.
            if blossom
                && response
                    .as_ref()
                    .is_ok_and(|r| matches!(r.status, 404 | 405))
            {
                self.progress(&host.borrow(), "discovering", 0);
                endpoint = self.record(
                    host,
                    server,
                    false,
                    http::discover(server, self.deadline).await,
                )?;
                blossom = false;
                continue;
            }
            // Some NIP-96 hosts refuse the Blossom preflight, hiding its HTTP status.
            let response = match response {
                Err("upload-network") if blossom => {
                    self.progress(&host.borrow(), "discovering", 0);
                    endpoint = self.record(
                        host,
                        server,
                        false,
                        http::discover(server, self.deadline)
                            .await
                            .map_err(|_| "upload-network"),
                    )?;
                    blossom = false;
                    continue;
                }
                other => self.record(host, server, blossom, other)?,
            };
            self.record(host, server, blossom, http::status(response.status))?;
            let mut body = response.body;
            if !blossom && response.status == 202 {
                self.progress(&host.borrow(), "processing", 0);
                body = self.record(
                    host,
                    server,
                    blossom,
                    http::processed(&body, self.deadline).await,
                )?;
            }
            return self.record(
                host,
                server,
                blossom,
                upload::uploaded(&body, &self.mime, &hash, blossom).ok_or("upload-response"),
            );
        }
    }
}
