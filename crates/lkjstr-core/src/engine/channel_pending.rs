//! Explicit list edits own their lookup until ready or the 20-second deadline.
use super::{
    Engine,
    protocol::{Action, Query, Source},
};
use lkjstr_protocol::NostrFilter;
pub(super) struct Pending {
    account: String,
    action: Action,
    deadline: u64,
}
impl Pending {
    fn kind(&self) -> u64 {
        if matches!(self.action, Action::Pin { .. }) {
            10001
        } else {
            10005
        }
    }
}
impl Engine {
    pub(super) fn defer_channel_action(
        &mut self,
        req: String,
        account: String,
        action: Action,
        now: u64,
    ) {
        if self.channel_pending.len() >= 64 {
            self.error(Some(req), "too-large");
            return;
        }
        self.channel_pending.insert(
            req,
            Pending {
                account,
                action,
                deadline: now.saturating_add(20000),
            },
        );
        self.replan(now);
    }
    pub(super) fn channel_action_wants(&self) -> Vec<(String, NostrFilter, Query)> {
        let accounts = self
            .channel_pending
            .values()
            .map(|p| (p.account.clone(), p.kind()))
            .collect::<std::collections::BTreeSet<_>>();
        accounts
            .into_iter()
            .map(|(account, kind)| {
                (
                    format!("~list-action:{kind}:{account}"),
                    NostrFilter {
                        authors: Some(vec![account.clone()]),
                        kinds: Some(vec![kind]),
                        limit: Some(1),
                        ..Default::default()
                    },
                    Query {
                        source: if kind == 10001 {
                            Source::Pins
                        } else {
                            Source::Channels
                        },
                        target: Some(account.clone()),
                        account: Some(account),
                        ..Default::default()
                    },
                )
            })
            .collect()
    }
    pub(super) fn resume_channel_actions(&mut self, now: u64) {
        let ready = self
            .channel_pending
            .iter()
            .filter(|(_, p)| {
                now >= p.deadline
                    || self.store.replaceable(&p.account, p.kind()).is_some()
                    || self.network.list_loaded(&self.store, &p.account, p.kind())
            })
            .map(|(req, _)| req.clone())
            .collect::<Vec<_>>();
        if ready.is_empty() {
            return;
        }
        for req in ready {
            let Some(pending) = self.channel_pending.remove(&req) else {
                continue;
            };
            if now >= pending.deadline {
                self.error(Some(req), "list-not-loaded");
            } else {
                self.action(req, pending.account, pending.action, now);
            }
        }
        self.replan(now);
    }
}
