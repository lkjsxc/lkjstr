use super::*;
use crate::engine::{Engine, protocol as p};
use serde_json::{Value, json};
impl Session {
    pub fn output(&mut self, out: p::Output, engine: &Engine) -> Vec<Output> {
        match out {
            p::Output::Rows {
                sub,
                items,
                at_top,
                at_bottom,
            } => {
                let rows = self.rows(&sub, &items, engine);
                self.delivered.insert(sub.clone(), rows.clone());
                vec![Output::Rows {
                    sub,
                    rows,
                    at_top,
                    at_bottom,
                }]
            }
            p::Output::Patch { sub, ops } => {
                // The wire protocol uses keys and insertion points, not numeric indices.
                let mut old = self.delivered.get(&sub).cloned().unwrap_or_default();
                let mut internal = Vec::new();
                for op in ops {
                    match op {
                        p::Patch::Remove { id } => old.retain(|r| r["key"].as_str() != Some(&id)),
                        p::Patch::Upsert { index, item } => internal.push((index, *item)),
                    }
                }
                let mut next = old.clone();
                for (index, row) in internal {
                    let row = self.rows(&sub, &[row], engine).into_iter().next();
                    if let Some(row) = row {
                        let key = row["key"].clone();
                        next.retain(|r| r["key"] != key);
                        let at = index.min(next.len());
                        next.insert(at, row);
                    }
                }
                // Specialized sources are recalculated from the store as one typed window.
                if self.queries.get(&sub).is_some_and(|q| {
                    matches!(
                        q.source.as_str(),
                        "profile" | "followers" | "following" | "mutes" | "list" | "notifications"
                    )
                }) {
                    let next = self.source_rows(&sub, engine);
                    let previous = self
                        .delivered
                        .insert(sub.clone(), next.clone())
                        .unwrap_or_default();
                    let ops = diff(&previous, &next);
                    return if ops.is_empty() {
                        vec![]
                    } else {
                        vec![Output::Patch { sub, ops }]
                    };
                }
                let previous = self
                    .delivered
                    .insert(sub.clone(), next.clone())
                    .unwrap_or_default();
                let ops = diff(&previous, &next);
                if ops.is_empty() {
                    vec![]
                } else {
                    vec![Output::Patch { sub, ops }]
                }
            }
            p::Output::Fresh { sub, count } => vec![Output::Fresh { sub, count }],
            p::Output::Sign { req, event } => vec![Output::Sign {
                req,
                pubkey: event.pubkey.clone(),
                event: serde_json::to_string(&event).unwrap_or_default(),
            }],
            p::Output::Delivery{req,deliveries}=>vec![Output::Delivery{req,relays:deliveries.into_iter().map(|d|json!({"url":d.relay,"state":match d.state.as_str(){"accepted"=>"ok","rejected"=>"failed",other=>other}})).collect()}],
            p::Output::Result {
                req,
                id,
                deliveries,
                error,
            } => {
                let delivery=deliveries.into_iter().map(|d|json!({"url":d.relay,"state":match d.state.as_str(){"accepted"=>"ok","rejected"=>"failed",other=>other}})).collect::<Vec<_>>();
                let ok = error.is_none() && delivery.iter().any(|d| d["state"] == "ok");
                vec![Output::Result {
                    req,
                    ok,
                    error: if ok {
                        None
                    } else {
                        Some(Failure {
                            code: error.unwrap_or_else(|| "rejected".into()),
                            message: None,
                        })
                    },
                    delivery: Some(delivery),
                    id,
                }]
            }
            p::Output::Status {
                sub,
                state,
                asked_relays,
            } => {
                let ops=self.settled_quote_patch(&sub,engine);
                let (_,answered)=engine.network.request_progress(&sub);
                let mut out=vec![Output::State{sub:sub.clone(),state:json!({"phase":match state.as_str(){"data"=>"live","not-found"=>"done",_=>"failed"},"relaysAsked":asked_relays,"relaysAnswered":answered})}];
                if !ops.is_empty(){out.push(Output::Patch{sub,ops});}out
            },
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
    pub fn failure(req: String, code: &str) -> Output {
        let mapped = match code {
            "list-not-loaded" | "target-unavailable" => "not-found",
            "signer-rejected" => "signer-refused",
            "signer-timeout" => "signer-missing",
            "event-too-large" => "too-large",
            "invalid-account" => "signed-out",
            "no-relays" => "no-relays",
            "unsupported" | "upload-not-implemented" => "unsupported",
            _ => "internal",
        };
        Output::Result {
            req,
            ok: false,
            error: Some(Failure {
                code: mapped.into(),
                message: Some(code.into()),
            }),
            delivery: None,
            id: None,
        }
    }
    fn rows(&self, sub: &str, items: &[crate::engine::rows::Row], engine: &Engine) -> Vec<Value> {
        let q = self.queries.get(sub);
        if q.is_some_and(|q| {
            matches!(
                q.source.as_str(),
                "profile" | "followers" | "following" | "mutes" | "list" | "notifications"
            )
        }) {
            return self.source_rows(sub, engine);
        }
        items
            .iter()
            .filter(|r| !r.own.muted)
            .map(|r| super::note::note(r, &engine.store, q.and_then(|q| q.account.as_deref())))
            .collect()
    }
}
fn diff(old: &[Value], next: &[Value]) -> Vec<Value> {
    let mut ops = Vec::new();
    let mut order = old.iter().map(|r| r["key"].clone()).collect::<Vec<_>>();
    for row in old {
        if !next.iter().any(|r| r["key"] == row["key"]) {
            ops.push(json!({"op":"remove","key":row["key"]}));
            order.retain(|k| *k != row["key"]);
        }
    }
    for (i, row) in next.iter().enumerate().rev() {
        let key = row["key"].clone();
        let before = next
            .get(i + 1)
            .map(|r| r["key"].clone())
            .unwrap_or(Value::Null);
        let old_at = order.iter().position(|k| *k == key);
        let follows =
            old_at.is_some_and(|at| order.get(at + 1).cloned().unwrap_or(Value::Null) == before);
        if !follows {
            if old_at.is_some() {
                ops.push(json!({"op":"remove","key":key}));
                order.retain(|k| *k != key);
            }
            ops.push(json!({"op":"insert","before":before,"rows":[row]}));
            let at = order
                .iter()
                .position(|k| *k == before)
                .unwrap_or(order.len());
            order.insert(at, key);
        } else if old.iter().find(|r| r["key"] == key) != Some(row) {
            ops.push(json!({"op":"update","row":row}));
        }
    }
    ops
}
