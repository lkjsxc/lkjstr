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
    progress: dm::delivery::Tracker,
    message: bool,
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
    let progress = dm::delivery::Tracker::new(packages.len())?;
    let message = rumor.is_some();
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
            progress,
            message,
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
    let Some((job, recipient)) = req.rsplit_once(':') else {
        return true;
    };
    let Ok(recipient) = recipient.parse::<usize>() else {
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
            let accepted = error.is_none() && deliveries.iter().any(|d| d.state == "accepted");
            if send.progress.settle(recipient, accepted) {
                send.deliveries.extend(deliveries.iter().cloned());
            }
        }
        Output::Error { .. } => {
            send.progress.settle(recipient, false);
        }
        _ => {}
    }
    if !send.progress.complete() {
        return true;
    }
    let Some(send) = h.dm.sending.remove(job) else {
        return true;
    };
    h.dm.running = h.dm.running.saturating_sub(1);
    let accepted = send.progress.accepted();
    let dm_delivery = send.message.then(|| send.progress.snapshot());
    if accepted && lifetime::check(&h, send.client, &send.account, send.epoch).is_ok() {
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
            ok: accepted,
            id: Some(send.id),
            delivery: Some(delivery),
            uploaded: None,
            key: None,
            encrypted_key: None,
            zap_intent: None,
            client_info: None,
            cancelled: None,
            dm_draft: None,
            dm_draft_revision: None,
            dm_delivery,
            error: (!accepted).then(|| lkjstr_core::engine::wire::Failure {
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

#[cfg(feature = "harness")]
pub(super) fn stop_probe(h: &Host) -> usize {
    h.dm.sending
        .values()
        .filter(|send| send.rumor.is_some())
        .count()
}
#[cfg(feature = "harness")]
pub(super) fn prime_stop_probe(
    h: &mut Host,
    client: u64,
    account: String,
    epoch: u64,
    rumor: lkjstr_nips::event::Rumor,
) -> Result<(), &'static str> {
    let progress = dm::delivery::Tracker::new(1)?;
    h.dm.sending.insert(
        "stop-publication".into(),
        Sending {
            client,
            req: "stop-publication".into(),
            account,
            epoch,
            id: rumor.id.clone(),
            rumor: Some(rumor),
            cache: vec![],
            progress,
            message: true,
            deliveries: vec![],
        },
    );
    h.dm.running += 1;
    Ok(())
}
