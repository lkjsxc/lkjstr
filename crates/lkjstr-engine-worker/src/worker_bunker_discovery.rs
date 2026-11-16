use super::*;
pub(in crate::worker) struct Caller {
    pub host: std::rc::Weak<RefCell<Host>>,
    pub client: u64,
    pub req: String,
}
pub(in crate::worker) async fn discover(
    caller: &Caller,
    remote: &lkjstr_protocol::remote::Remote,
    token: Option<String>,
) -> Result<String, &'static str> {
    let host = caller.host.upgrade().ok_or("offline")?;
    call(
        &host,
        remote,
        Call {
            client: caller.client,
            account: None,
            captured: None,
            action_req: Some(&caller.req),
            method: "connect",
            ms: 60_000,
            private: false,
            signal: None,
        },
        vec![remote.peer.clone(), token.unwrap_or_default()],
    )
    .await?;
    call(
        &host,
        remote,
        Call {
            client: caller.client,
            account: None,
            captured: None,
            action_req: Some(&caller.req),
            method: "get_public_key",
            ms: 60_000,
            private: false,
            signal: None,
        },
        vec![],
    )
    .await
}
