//! Namespaced clients for one SharedWorker/leader host. No cross-client leakage.
use super::protocol::{Input, Output};
use std::collections::{BTreeMap, BTreeSet};
#[derive(Default)]
struct Client {
    subs: BTreeSet<String>,
    visible: BTreeSet<String>,
    last_seen: u64,
}
#[derive(Default)]
pub struct Clients {
    clients: BTreeMap<u64, Client>,
    next: u64,
}
impl Clients {
    pub fn connect(&mut self, now: u64) -> Option<u64> {
        if self.clients.len() >= 32 {
            return None;
        }
        self.next = self.next.saturating_add(1);
        self.clients.insert(
            self.next,
            Client {
                last_seen: now,
                ..Default::default()
            },
        );
        Some(self.next)
    }
    pub fn input(&mut self, id: u64, input: Input, now: u64) -> Vec<Input> {
        let Some(c) = self.clients.get_mut(&id) else {
            return vec![];
        };
        c.last_seen = now;
        let ns = |s: String| format!("{id}:{s}");
        let input = match input {
            Input::Open { sub, query } => {
                let sub = ns(sub);
                c.subs.insert(sub.clone());
                c.visible.insert(sub.clone());
                Input::Open { sub, query }
            }
            Input::Close { sub } => {
                let sub = ns(sub);
                c.subs.remove(&sub);
                c.visible.remove(&sub);
                Input::Close { sub }
            }
            Input::Window {
                sub,
                anchor,
                before,
                after,
            } => Input::Window {
                sub: ns(sub),
                anchor,
                before,
                after,
            },
            Input::Action {
                req,
                account,
                action,
            } => Input::Action {
                req: ns(req),
                account,
                action,
            },
            Input::Signed { req, event, error } => Input::Signed {
                req: ns(req),
                event,
                error,
            },
            Input::Hint {
                visible_subs,
                page_hidden,
                idle,
                save_data,
            } => {
                c.visible = if page_hidden {
                    BTreeSet::new()
                } else {
                    visible_subs
                        .into_iter()
                        .map(ns)
                        .filter(|s| c.subs.contains(s))
                        .collect()
                };
                return vec![Input::Hint {
                    visible_subs: self
                        .clients
                        .values()
                        .flat_map(|c| c.visible.iter().cloned())
                        .collect(),
                    page_hidden: false,
                    idle,
                    save_data,
                }];
            }
            other => other,
        };
        vec![input]
    }
    pub fn disconnect(&mut self, id: u64) -> Vec<Input> {
        self.clients
            .remove(&id)
            .map(|c| c.subs.into_iter().map(|sub| Input::Close { sub }).collect())
            .unwrap_or_default()
    }
    pub fn expire(&mut self, now: u64) -> Vec<u64> {
        // Hosts require a hint heartbeat at least once per minute. Three minutes
        // tolerate background throttling; suspended clients reopen after expiry.
        self.clients
            .iter()
            .filter(|(_, c)| now.saturating_sub(c.last_seen) > 180000)
            .map(|(id, _)| *id)
            .collect()
    }
    pub fn output(&self, out: Output) -> Vec<(u64, Output)> {
        let key = match &out {
            Output::Rows { sub, .. }
            | Output::Patch { sub, .. }
            | Output::Fresh { sub, .. }
            | Output::Status { sub, .. }
            | Output::Diagnostics { sub, .. } => Some(sub.as_str()),
            Output::Sign { req, .. }
            | Output::Delivery { req, .. }
            | Output::Result { req, .. } => Some(req.as_str()),
            Output::Error { req, .. } => req.as_deref(),
        };
        if let Some(key) = key {
            let Some((id, local)) = key.split_once(':') else {
                return vec![];
            };
            let Ok(id) = id.parse::<u64>() else {
                return vec![];
            };
            if !self.clients.contains_key(&id) {
                return vec![];
            }
            let local = local.to_owned();
            let mut out = out;
            match &mut out {
                Output::Rows { sub, .. }
                | Output::Patch { sub, .. }
                | Output::Fresh { sub, .. }
                | Output::Status { sub, .. }
                | Output::Diagnostics { sub, .. } => *sub = local,
                Output::Sign { req, .. }
                | Output::Delivery { req, .. }
                | Output::Result { req, .. } => *req = local,
                Output::Error { req, .. } => *req = Some(local),
            }
            vec![(id, out)]
        } else {
            self.clients.keys().map(|id| (*id, out.clone())).collect()
        }
    }
}
