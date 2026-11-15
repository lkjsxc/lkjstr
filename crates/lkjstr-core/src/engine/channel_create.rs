//! Two signed publications form a create. Report the creation id only after both settle.
use super::{
    Engine,
    protocol::{Action, Delivery, Output},
};
use lkjstr_protocol::NostrEvent;
pub(super) struct Creation {
    id: String,
    finished: [bool; 2],
    deliveries: Vec<Delivery>,
    error: Option<String>,
}
impl Engine {
    pub(super) fn start_channel_create(&mut self, req: String, event: NostrEvent, now: u64) {
        let id = event.id.clone();
        let account = event.pubkey.clone();
        self.channel_creates.insert(
            req.clone(),
            Creation {
                id: id.clone(),
                finished: [false; 2],
                deliveries: vec![],
                error: None,
            },
        );
        self.network.publish(format!("{req}~channel40"), event, now);
        self.action(
            format!("{req}~channel10005"),
            account,
            Action::ChannelJoin { id, on: true },
            now,
        );
    }
    pub(super) fn channel_outputs(&mut self, outputs: Vec<Output>) -> Vec<Output> {
        let mut out = vec![];
        for output in outputs {
            let req = match &output {
                Output::Result { req, .. } | Output::Delivery { req, .. } => Some(req),
                Output::Error { req, .. } => req.as_ref(),
                _ => None,
            };
            let stage = req.and_then(|r| {
                r.strip_suffix("~channel40")
                    .map(|r| (r.to_owned(), 0))
                    .or_else(|| r.strip_suffix("~channel10005").map(|r| (r.to_owned(), 1)))
            });
            let Some((req, stage)) = stage.filter(|(r, _)| self.channel_creates.contains_key(r))
            else {
                out.push(output);
                continue;
            };
            let Some(job) = self.channel_creates.get_mut(&req) else {
                out.push(output);
                continue;
            };
            match output {
                Output::Result {
                    deliveries, error, ..
                } => {
                    if error.is_some() || !deliveries.iter().any(|d| d.state == "accepted") {
                        job.error = Some(error.unwrap_or_else(|| "rejected".into()));
                    }
                    job.deliveries.extend(deliveries);
                    job.finished[stage] = true;
                }
                Output::Error { code, .. } => {
                    job.error = Some(code);
                    job.finished[stage] = true;
                }
                Output::Delivery { deliveries, .. } => out.push(Output::Delivery {
                    req: req.clone(),
                    deliveries,
                }),
                _ => {}
            }
            if job.finished.iter().all(|v| *v) {
                let Some(job) = self.channel_creates.remove(&req) else {
                    continue;
                };
                let mut deliveries = std::collections::BTreeMap::<String, Delivery>::new();
                for delivery in job.deliveries {
                    let key = delivery.relay.clone();
                    if deliveries
                        .get(&key)
                        .is_none_or(|old| old.state == "accepted")
                    {
                        deliveries.insert(key, delivery);
                    }
                }
                out.push(Output::Result {
                    req,
                    id: Some(job.id),
                    deliveries: deliveries.into_values().collect(),
                    error: job.error,
                });
            }
        }
        out
    }
}
