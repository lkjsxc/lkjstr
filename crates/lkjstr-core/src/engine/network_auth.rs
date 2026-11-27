//! NIP-42 challenges belong to one socket. AUTH never enters the public store.
use super::*;
use crate::engine::signer_orchestration::SignerWork;
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
    pub work: SignerWork,
    generation: u64,
}
impl AuthRequest {
    pub fn token(&self) -> u64 {
        self.generation
    }
}
#[derive(Default)]
pub(in crate::engine) struct Authentication {
    challenge: Option<String>, // <= 4096 bytes; discarded on disconnect.
    seen: BTreeSet<String>,    // <= 8 distinct challenges per connection.
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
            || r.auth.seen.len() >= 8
            || !r.auth.seen.insert(challenge.clone())
        {
            return;
        }
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
        self.mark_auth_required(relay);
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
        self.mark_auth_required(relay);
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
        let (url, challenge, account, work) = self.ready_auth(accounts, now)?;
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
            work,
            generation: self.auth_next_job,
        };
        r.auth.pending = Some((job.clone(), None));
        Some(job)
    }
    pub fn auth_current(&self, job: &AuthRequest, now: u64) -> bool {
        now < job.deadline
            && self.auth_needed(&job.relay, &job.event.pubkey, now)
            && self
                .relays
                .get(&job.relay)
                .and_then(|relay| relay.auth.pending.as_ref())
                .is_some_and(|(pending, _)| pending.generation == job.generation)
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn repeated_challenges_share_the_connection_history() {
        let url = "wss://auth.test/";
        let mut network = Network::default();
        network.relays.insert(
            url.into(),
            Relay {
                online: true,
                ..Default::default()
            },
        );
        network.auth_challenge(url, "first".into());
        network.auth_challenge(url, "first".into());
        network.auth_challenge(url, "new".into());
        network.auth_challenge(url, "first".into());
        assert_eq!(network.relays[url].auth.challenge.as_deref(), Some("new"));
        assert_eq!(network.relays[url].auth.seen.len(), 2);
        if let Some(relay) = network.relays.get_mut(url) {
            relay.auth.reset();
        }
        network.auth_challenge(url, "first".into());
        assert_eq!(network.relays[url].auth.challenge.as_deref(), Some("first"));
    }
}
