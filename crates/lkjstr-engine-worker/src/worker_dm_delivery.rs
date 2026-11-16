//! A DM succeeds only when each recipient's distinct wrap, including self, is accepted.
use super::*;
use lkjstr_core::engine::{protocol, publication_plan::Destination};
pub(super) struct Sending {
    client: u64,
    req: String,
    account: String,
    epoch: u64,
    id: String,
    rumor: Option<lkjstr_nips::event::Rumor>,
    cache: Vec<lkjstr_protocol::NostrEvent>,
    waiting: BTreeSet<String>,
    accepted: bool,
    deliveries: Vec<protocol::Delivery>,
}
pub(super) fn begin(
    h: &mut Host,
    client: u64,
    req: String,
    account: String,
    epoch: u64,
    rumor: Option<lkjstr_nips::event::Rumor>,
    packages: Vec<(lkjstr_protocol::NostrEvent, Vec<Destination>)>,
) -> Result<(), &'static str> {
    if !h.engine.dm_publishable(
        &packages
            .iter()
            .map(|(e, _)| e.id.clone())
            .collect::<Vec<_>>(),
    ) {
        return Err("too-large");
    }
    lifetime::check(h, client, &account, epoch)?;
    h.dm.serial += 1;
    let job = format!("~dm-publication-{}", h.dm.serial);
    let id = rumor
        .as_ref()
        .map(|r| r.id.clone())
        .or_else(|| packages.first().map(|(e, _)| e.id.clone()))
        .ok_or("internal")?;
    let cache = packages
        .iter()
        .filter(|(e, _)| {
            e.kind == 10050
                || e.tags
                    .iter()
                    .any(|t| t.first().is_some_and(|s| s == "p") && t.get(1) == Some(&account))
        })
        .map(|(e, _)| e.clone())
        .collect();
    let waiting: BTreeSet<_> = (0..packages.len()).map(|i| format!("{job}:{i}")).collect();
    h.dm.sending.insert(
        job.clone(),
        Sending {
            client,
            req,
            account: account.clone(),
            epoch,
            id,
            rumor,
            cache,
            waiting,
            accepted: true,
            deliveries: vec![],
        },
    );
    let now = h.time();
    for (i, (event, routes)) in packages.into_iter().enumerate() {
        h.engine
            .network
            .publish_as(format!("{job}:{i}"), event, routes, now, account.clone());
    }
    Ok(())
}
pub(super) fn output(host: &Rc<RefCell<Host>>, output: &Output) -> bool {
    let req = match output {
        Output::Delivery { req, .. } | Output::Result { req, .. } => req,
        Output::Error { req: Some(req), .. } => req,
        _ => return false,
    };
    if !req.starts_with("~dm-publication-") {
        return false;
    }
    let Some((job, _)) = req.rsplit_once(':') else {
        return true;
    };
    let mut h = host.borrow_mut();
    let Some(send) = h.dm.sending.get_mut(job) else {
        return true;
    };
    match output {
        Output::Result {
            deliveries, error, ..
        } => {
            if send.waiting.remove(req) {
                send.accepted &=
                    error.is_none() && deliveries.iter().any(|d| d.state == "accepted");
                send.deliveries.extend(deliveries.iter().cloned());
            }
        }
        Output::Error { .. } => {
            send.waiting.remove(req);
            send.accepted = false;
        }
        _ => {}
    }
    if !send.waiting.is_empty() {
        return true;
    }
    let Some(send) = h.dm.sending.remove(job) else {
        return true;
    };
    h.dm.running = h.dm.running.saturating_sub(1);
    if send.accepted && lifetime::check(&h, send.client, &send.account, send.epoch).is_ok() {
        if let Some(rumor) = send.rumor {
            let _ = h.dm.inbox.insert(&send.account, rumor);
        }
        for event in send.cache {
            h.engine.enqueue("dm-local".into(), event);
        }
    }
    let delivery = send.deliveries.into_iter().map(|d| {
        let mut value = serde_json::json!({"url":d.relay, "state":match d.state.as_str() {"accepted"=>"ok","timeout"=>"timeout",_=>"failed"}});
        if let Some(message) = d.message { value["message"] = serde_json::json!(message); }
        value
    }).collect();
    h.scope.direct(
        send.client,
        &W::Result {
            req: send.req,
            ok: send.accepted,
            id: Some(send.id),
            delivery: Some(delivery),
            uploaded: None,
            key: None,
            encrypted_key: None,
            cancelled: None,
            error: (!send.accepted).then(|| lkjstr_core::engine::wire::Failure {
                code: "rejected".into(),
                message: None,
            }),
        },
    );
    true
}

pub(super) fn revoke(h: &mut Host, account: &str) {
    for send in h.dm.sending.values_mut().filter(|s| s.account == account) {
        send.rumor = None;
    }
}
