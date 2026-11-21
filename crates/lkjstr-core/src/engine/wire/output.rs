use super::*;
use crate::engine::{Engine, protocol as p};
use serde_json::json;
impl Session {
    pub(super) fn output_inner(&mut self, out: p::Output, engine: &Engine) -> Vec<Output> {
        match out {
            p::Output::Rows {
                sub,
                items,
                at_top,
                at_bottom,
            } => {
                let (at_top, at_bottom) = if self.queries.get(&sub).is_some_and(|q| {
                    q.convert()
                        .is_some_and(|q| super::list_edges::projected(q.source))
                        || q.notifications == Some(true)
                }) {
                    let edges = self.source_edges(&sub, engine);
                    (edges.0, at_bottom && edges.1)
                } else {
                    (at_top, at_bottom)
                };
                let mut rows = self.rows(&sub, &items, engine);
                if self.projects_source(&sub) {
                    let account = self.queries.get(&sub).and_then(|q| q.account.as_deref());
                    for row in &mut rows {
                        super::quote_state::settle(row, engine, account);
                    }
                }
                let same_window = !self.visibility_navigation.remove(&sub);
                if let Some(previous) = self.delivered.remove(&sub) {
                    self.evidence_of_pruning(&sub, &previous, engine);
                    let anchor = self
                        .windows
                        .get(&sub)
                        .and_then(|(anchor, _, _)| anchor.as_deref());
                    super::visibility_terminal::retain_terminal(
                        &previous,
                        &mut rows,
                        engine,
                        anchor,
                        same_window,
                    );
                }
                self.delivered.insert(sub.clone(), rows.clone());
                let mut out = vec![Output::Rows {
                    sub: sub.clone(),
                    rows,
                    at_top,
                    at_bottom,
                }];
                if self
                    .queries
                    .get(&sub)
                    .is_some_and(|q| matches!(q.source.as_str(), "channels" | "channel"))
                    && engine.network.request_progress(&sub).1 == 0
                {
                    out.push(Output::State {
                        sub,
                        state: json!({"phase":"cache","relaysAsked":0,"relaysAnswered":0}),
                    });
                }
                out
            }
            p::Output::Patch { sub, ops, order } => self.patch(sub, ops, order, engine),
            p::Output::Fresh {
                sub,
                count,
                own_head,
            } => {
                let (count, own_head) =
                    if self.queries.get(&sub).is_some_and(|q| {
                        q.notifications == Some(true) || q.source == "notifications"
                    }) {
                        self.source_fresh(&sub, engine)
                    } else {
                        (count, own_head)
                    };
                let ops = self.settled_quote_patch(&sub, engine);
                let mut out = vec![Output::Fresh {
                    sub: sub.clone(),
                    count,
                    own_head: own_head.then_some(true),
                }];
                if !ops.is_empty() {
                    out.push(Output::Patch { sub, ops });
                }
                out
            }
            p::Output::TimeWindow {
                sub,
                at,
                key,
                newer,
                older,
                follow_list,
            } => vec![Output::TimeWindow {
                sub,
                at,
                key,
                newer,
                older,
                follow_list,
            }],
            p::Output::Sign { req, event } => vec![Output::Sign {
                action_req: None,
                req,
                pubkey: event.pubkey.clone(),
                event: serde_json::to_string(&event).unwrap_or_default(),
            }],
            p::Output::PublishSigned { req, id } => vec![Output::PublishSigned { req, id }],
            p::Output::PublishFallback { req } => vec![Output::PublishFallback { req }],
            p::Output::Delivery { req, deliveries } => vec![Output::Delivery {
                req,
                relays: deliveries.into_iter().map(super::delivery::value).collect(),
            }],
            p::Output::Result {
                req,
                id,
                deliveries,
                error,
            } => {
                let delivery = deliveries
                    .into_iter()
                    .map(super::delivery::value)
                    .collect::<Vec<_>>();
                let ok = error.is_none() && delivery.iter().any(|d| d["state"] == "ok");
                let unknown = error.is_none() && delivery.iter().any(|d| d["state"] == "timeout");
                vec![Output::Result {
                    req,
                    ok,
                    error: if ok || unknown {
                        None
                    } else {
                        Some(Failure {
                            code: error.unwrap_or_else(|| "rejected".into()),
                            message: None,
                        })
                    },
                    delivery: Some(delivery),
                    id,
                    uploaded: None,
                    key: None,
                    encrypted_key: None,
                    zap_intent: None,
                    dm_draft: None,
                    dm_draft_revision: None,
                    dm_delivery: None,
                    client_info: None,
                    cancelled: None,
                }]
            }
            p::Output::Status {
                sub,
                state,
                asked_relays,
                answered_relays,
            } => {
                let ops = self.settled_quote_patch(&sub, engine);
                let answered = answered_relays;
                let empty_profile = self
                    .queries
                    .get(&sub)
                    .is_some_and(|q| q.source == "profile")
                    && self
                        .delivered
                        .get(&sub)
                        .is_some_and(|r| r.iter().all(|r| r["kind"] == "profile"))
                    && engine.views.get(&sub).is_some_and(|v| v.source_exhausted);
                let known_channel = self.queries.get(&sub).is_some_and(|q| {
                    q.source == "channel"
                        && q.convert()
                            .and_then(|q| q.target)
                            .and_then(|id| engine.store.get(&id))
                            .is_some_and(|e| e.kind == 40)
                });
                let mut out = vec![Output::State {
                    sub: sub.clone(),
                    state: json!({"phase":match state.as_str(){"pending"=>"cache","data"=>if self.queries.get(&sub).is_some_and(|q| q.source=="channels") || empty_profile {"done"} else {"live"},"not-found"=>if known_channel {"live"} else {"done"},_=>"failed"},"relaysAsked":asked_relays,"relaysAnswered":answered}),
                }];
                if !ops.is_empty() {
                    out.push(Output::Patch { sub, ops });
                }
                out
            }
            p::Output::Diagnostics { sub, .. } => {
                let rows = self.source_rows(&sub, engine);
                self.delivered.insert(sub.clone(), rows.clone());
                vec![Output::Rows {
                    sub,
                    rows,
                    at_top: true,
                    at_bottom: true,
                }]
            }
            p::Output::Error {
                req: Some(req),
                code,
            } => vec![Self::failure(req, &code)],
            _ => vec![],
        }
    }
}
