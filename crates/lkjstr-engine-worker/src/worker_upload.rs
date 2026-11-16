//! Four uploads, 20 MiB each. One visible destination; every signer/HTTP wait ends.
use super::*;
use lkjstr_core::engine::upload::Deadline;
use lkjstr_core::engine::wire::{Output as W, Session};
#[path = "worker_upload_attempt.rs"]
mod attempt;
#[path = "worker_server_check.rs"]
pub(super) mod checks;
#[path = "worker_upload_control.rs"]
pub(super) mod control;
#[path = "worker_upload_http.rs"]
mod http;
#[path = "worker_upload_input.rs"]
pub(super) mod input;
#[path = "worker_upload_sign.rs"]
pub(in crate::worker) mod signing;
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
    pub lease: lkjstr_core::engine::upload_jobs::Lease,
    pub signal: web_sys::AbortSignal,
}
pub(super) fn pump_uploads(host: &Rc<RefCell<Host>>) {
    control::prune(&mut host.borrow_mut());
    let tasks = std::mem::take(&mut host.borrow_mut().upload_tasks);
    for mut task in tasks {
        let host = host.clone();
        wasm_bindgen_futures::spawn_local(async move {
            let result = task.run(&host).await;
            let mut h = host.borrow_mut();
            if !h.upload_control.current(&task.lease) {
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
                        encrypted_key: None,
                        cancelled: None,
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
            if !h.upload_control.finish(&task.lease) {
                return;
            }
            h.upload_inflight = h.upload_inflight.saturating_sub(1);
            if !h.stopped {
                h.scope.direct(task.id, &out);
            }
        });
    }
}
impl Task {
    fn current(&self, host: &Host) -> Result<(), &'static str> {
        if self.signal.aborted() || !host.upload_control.current(&self.lease) {
            return Err(crate::browser::abort::CANCELLED);
        }
        if host.stopped || !host.sessions.contains_key(&self.id) {
            return Err("offline");
        }
        host.accounts.require_signer(&self.account).map(|_| ())
    }
    fn progress(&self, host: &Host, phase: &str, sent: usize) {
        if self.current(host).is_err() {
            return;
        }
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
        self.current(&host.borrow())?;
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
                self.current(&host.borrow())?;
                if host.borrow().engine.upload_servers_ready(&self.account) {
                    break;
                }
                crate::browser::promise::pause_for(
                    self.deadline.wait(clock(), 100)?,
                    Some(&self.signal),
                )
                .await
                .map_err(|error| {
                    if error.as_string().as_deref() == Some(crate::browser::abort::CANCELLED) {
                        crate::browser::abort::CANCELLED
                    } else {
                        "internal"
                    }
                })?;
            }
            if !host.borrow().engine.upload_servers_ready(&self.account) {
                return Err("upload-discovery".into());
            }
        }
        self.current(&host.borrow())?;
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
            self.current(&host.borrow())?;
            self.deadline.wait(clock(), 1)?;
            self.server = Some(server.clone());
            match self.run_server(host, &server).await {
                Ok(value) => {
                    self.current(&host.borrow())?;
                    self.deadline.wait(clock(), 1)?;
                    return Ok(value);
                }
                Err(failure) => {
                    self.current(&host.borrow())?;
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
