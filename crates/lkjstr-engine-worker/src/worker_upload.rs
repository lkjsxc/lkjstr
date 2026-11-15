//! Four uploads, 20 MiB each. One visible destination; every signer/HTTP wait ends.
use super::*;
use lkjstr_core::engine::upload::Deadline;
use lkjstr_core::engine::wire::{Output as W, Session};
#[path = "worker_upload_attempt.rs"]
mod attempt;
#[path = "worker_server_check.rs"]
pub(super) mod checks;
#[path = "worker_upload_http.rs"]
mod http;
#[path = "worker_upload_sign.rs"]
mod signing;
pub(super) fn clock() -> u64 {
    crate::measure::now() as u64
}
pub(super) struct Task {
    pub id: u64,
    pub req: String,
    pub account: String,
    pub name: String,
    pub mime: String,
    pub bytes: Vec<u8>,
    pub server: Option<String>,
    pub deadline: Deadline,
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
                    let mut result = Session::failure(task.req, &code);
                    if let W::Result {
                        error: Some(error), ..
                    } = &mut result
                    {
                        error.code = code;
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
    async fn run(&mut self, host: &Rc<RefCell<Host>>) -> Result<serde_json::Value, String> {
        self.progress(&host.borrow(), "discovering", 0);
        host.borrow().accounts.require_signer(&self.account)?;
        if !(self.mime.starts_with("image/")
            || self.mime.starts_with("video/")
            || self.mime.starts_with("audio/"))
        {
            return Err("unsupported".into());
        }
        if self.server.is_none() {
            for _ in 0..150 {
                if host.borrow().stopped {
                    return Err("offline".into());
                }
                if host.borrow().engine.upload_servers_ready(&self.account) {
                    break;
                }
                crate::browser::promise::pause(self.deadline.wait(clock(), 100)?)
                    .await
                    .map_err(|_| "internal")?;
            }
            if !host.borrow().engine.upload_servers_ready(&self.account) {
                return Err("upload-discovery".into());
            }
        }
        let candidates = if let Some(server) = self.server.clone() {
            vec![server]
        } else {
            match host.borrow().engine.upload_candidates(&self.account) {
                Ok(servers) => servers,
                Err(error) => {
                    self.server = error.server;
                    return Err(error.code);
                }
            }
        };
        let mut error = "not-found";
        for server in candidates {
            self.deadline.wait(clock(), 1)?;
            self.server = Some(server.clone());
            match self.run_server(host, &server).await {
                Ok(value) => {
                    self.deadline.wait(clock(), 1)?;
                    return Ok(value);
                }
                Err(failure) => {
                    self.deadline.wait(clock(), 1)?;
                    error = failure.code;
                    if !failure.fallback {
                        return Err(error.into());
                    }
                }
            }
        }
        Err(error.into())
    }
}
