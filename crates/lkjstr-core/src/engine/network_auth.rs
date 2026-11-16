//! NIP-42 challenges belong to one socket. AUTH never enters the public store.
use super::*;
use lkjstr_protocol::UnsignedNostrEvent;
#[path = "network_auth_finish.rs"]
mod finish;
#[path = "network_auth_policy.rs"]
mod policy;
use policy::request_needs;
/// One host signing job; no private key or persisted authentication state.
#[derive(Clone)]
pub struct AuthRequest {
    pub relay: String,
    pub event: UnsignedNostrEvent,
    pub deadline: u64,
    generation: u64,
}
#[derive(Default)]
pub(in crate::engine) struct Authentication {
    challenge: Option<String>, // <= 4096 bytes; discarded on disconnect.
    changes: usize,            // <= 8 distinct challenges per connection.
    tried: BTreeSet<String>,   // <= 32 saved accounts per challenge.
    pending: Option<(AuthRequest, Option<String>)>,
    blocked: BTreeSet<String>, // Logical request IDs, pruned against requests.
    pub(super) writes: BTreeSet<String>, // <= 64 pending publication IDs.
}
impl Authentication {
    pub(super) fn reset(&mut self) {
        *self = Self::default();
    }
}
impl Network {
    pub(super) fn auth_challenge(&mut self, relay: &str, challenge: String) {
        let Some(r) = self.relays.get_mut(relay).filter(|r| r.online) else {
            return;
        };
        if challenge.len() > 4096
            || r.auth.challenge.as_ref() == Some(&challenge)
            || r.auth.changes >= 8
        {
            return;
        }
        r.auth.changes += 1;
        r.auth.challenge = Some(challenge);
        r.auth.pending = None;
        r.auth.tried.clear();
    }
    pub(super) fn auth_closed(&mut self, relay: &str, wire: &str, message: &str, now: u64) -> bool {
        if !message.starts_with("auth-required:") {
            return false;
        }
        let Some(relay_state) = self.relays.get_mut(relay).filter(|r| r.online) else {
            return false;
        };
        for (id, r) in self
            .requests
            .iter_mut()
            .filter(|(_, r)| r.relay == relay && r.wire_id == wire && r.sent)
        {
            relay_state.auth.blocked.insert(id.clone());
            r.sent = false;
            r.complete = false;
            r.eose = false;
            r.ready_at = u64::MAX;
            r.deadline = now.saturating_add(60_000);
        }
        relay_state.last_error = Some(message.chars().take(512).collect());
        self.profiles_changed = true;
        true
    }
    pub(super) fn auth_write(&mut self, relay: &str, id: &str, message: &str) -> bool {
        if !message.starts_with("auth-required:") {
            return false;
        }
        let Some(p) = self.publications.get(id).filter(|p| {
            p.attempted.contains(relay) && p.deliveries.get(relay).is_some_and(|s| s == "pending")
        }) else {
            return false;
        };
        let Some(r) = self.relays.get_mut(relay).filter(|r| r.online) else {
            return false;
        };
        r.auth.writes.insert(p.event.id.clone());
        r.last_error = Some(message.chars().take(512).collect());
        true
    }
    /// Active public reader, or the explicit owner of a private inbox/publication.
    /// A challenge alone never causes a signature or discloses an account.
    pub fn next_auth(
        &mut self,
        accounts: &[String],
        active: Option<&str>,
        now: u64,
    ) -> Option<AuthRequest> {
        self.set_auth_accounts(accounts, active, now);
        for url in self.relays.keys().cloned().collect::<Vec<_>>() {
            let r = &self.relays[&url];
            if !r.online || r.auth.pending.is_some() {
                continue;
            }
            let Some(challenge) = r.auth.challenge.clone() else {
                continue;
            };
            let account = accounts
                .iter()
                .take(32)
                .find(|account| {
                    !r.auth.tried.contains(*account) && self.auth_needed(&url, account, now)
                })
                .cloned();
            let Some(account) = account else { continue };
            self.auth_next_job = self.auth_next_job.checked_add(1)?;
            let r = self.relays.get_mut(&url)?;
            r.auth.tried.insert(account.clone());
            let job = AuthRequest {
                relay: url.clone(),
                event: UnsignedNostrEvent {
                    pubkey: account,
                    created_at: now / 1000,
                    kind: 22242,
                    tags: vec![
                        vec!["relay".into(), url],
                        vec!["challenge".into(), challenge],
                    ],
                    content: String::new(),
                },
                deadline: now.saturating_add(60_000),
                generation: self.auth_next_job,
            };
            r.auth.pending = Some((job.clone(), None));
            return Some(job);
        }
        None
    }
    /// Reject stale identity/demand, changed challenges and disconnected signer replies.
    pub fn auth_signed(&mut self, job: &AuthRequest, result: Result<NostrEvent, &str>, now: u64) {
        let Some((expected, _)) = self
            .relays
            .get(&job.relay)
            .filter(|r| r.online)
            .and_then(|r| r.auth.pending.as_ref())
            .cloned()
        else {
            return;
        };
        if expected.generation != job.generation {
            return;
        }
        if !self.auth_needed(&job.relay, &job.event.pubkey, now) {
            self.auth_cancel(job);
            return;
        }
        let event = result.ok().filter(|e| {
            now < expected.deadline
                && crate::actions::validate_signed_event(&expected.event, e).is_ok()
        });
        let Some(event) = event else {
            self.auth_finished(&job.relay, false, "authentication-failed", now);
            return;
        };
        if let Some((_, id)) = self
            .relays
            .get_mut(&job.relay)
            .and_then(|r| r.auth.pending.as_mut())
        {
            *id = Some(event.id.clone());
        }
        self.send(&job.relay, json!(["AUTH", event]));
    }
    pub(super) fn auth_answer(
        &mut self,
        relay: &str,
        id: &str,
        accepted: bool,
        message: &str,
        now: u64,
    ) -> bool {
        let Some((job, signed)) = self
            .relays
            .get(relay)
            .and_then(|r| r.auth.pending.as_ref())
            .cloned()
        else {
            return false;
        };
        if signed.as_deref() != Some(id) {
            return false;
        }
        if !self.auth_needed(relay, &job.event.pubkey, now) {
            self.auth_cancel(&job);
        } else if now >= job.deadline {
            self.auth_finished(relay, false, "authentication-timeout", now);
        } else {
            self.auth_finished(relay, accepted, message, now);
        }
        true
    }
}
