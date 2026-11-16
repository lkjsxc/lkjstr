//! Ephemeral, owner-bound NIP-46 authorization challenges. Never persisted or diagnosed.
#[path = "bunker_types.rs"]
mod types;
use super::accounts::secret::SecretText;
use std::collections::BTreeMap;
pub use types::{Authority, Context, Lease, Method, Owner, Reason, Removed, Start, Ticket};

pub const MAX_PENDING: usize = 64;
pub const MAX_PER_CLIENT: usize = 16;
pub const MAX_CHANGES: usize = 4;
#[derive(Default)]
pub struct Book {
    next: u64,
    jobs: BTreeMap<Lease, Ticket>,
}
impl Book {
    pub fn start(
        &mut self,
        start: Start,
        now: u64,
        context: &Context<'_>,
    ) -> Result<Lease, &'static str> {
        if !context.allows(&start.owner) {
            return Err("offline");
        }
        if start.expires_at <= now {
            return Err("signer-timeout");
        }
        if start.owner.account.is_none()
            && !matches!(start.method, Method::Connect | Method::PublicKey)
        {
            return Err("signed-out");
        }
        if !lkjstr_protocol::is_pubkey(&start.peer)
            || start
                .owner
                .request
                .as_ref()
                .is_some_and(|s| s.is_empty() || s.len() > 256)
            || start
                .owner
                .account
                .as_ref()
                .is_some_and(|(account, authority)| {
                    !lkjstr_protocol::is_pubkey(account)
                        || !lkjstr_protocol::is_pubkey(&authority.client)
                        || authority.peer != start.peer
                })
        {
            return Err("rejected");
        }
        if self.jobs.len() >= MAX_PENDING
            || self
                .jobs
                .values()
                .filter(|j| j.owner.client == start.owner.client)
                .count()
                >= MAX_PER_CLIENT
        {
            return Err("too-large");
        }
        self.next = self.next.checked_add(1).ok_or("internal")?;
        let lease = Lease(self.next);
        self.jobs.insert(
            lease,
            Ticket {
                owner: start.owner,
                method: start.method,
                peer: start.peer,
                expires_at: start.expires_at.min(now.saturating_add(60_000)),
                urls: Vec::new(),
            },
        );
        Ok(lease)
    }
    pub fn owners(&self) -> impl Iterator<Item = &Owner> {
        self.jobs.values().map(|job| &job.owner)
    }
    pub fn get(&self, lease: Lease) -> Option<&Ticket> {
        self.jobs.get(&lease)
    }
    pub fn challenge(
        &mut self,
        lease: Lease,
        url: &lkjstr_protocol::remote::AuthUrl,
        now: u64,
    ) -> Result<bool, &'static str> {
        let Some(job) = self.jobs.get_mut(&lease) else {
            return Err("offline");
        };
        if now >= job.expires_at {
            return Err("signer-timeout");
        }
        if job.urls.iter().any(|seen| &**seen == url.as_str()) {
            return Ok(false);
        }
        if job.urls.len() >= MAX_CHANGES {
            return Err("too-large");
        }
        job.urls.push(SecretText::new(url.as_str().into()));
        Ok(true)
    }
    pub fn finish(&mut self, lease: Lease, reason: Reason) -> Option<Removed> {
        let job = self.jobs.remove(&lease)?;
        Some(Removed {
            lease,
            owner: job.owner,
            shown: !job.urls.is_empty(),
            reason,
        })
    }
    pub fn cancel(&mut self, client: u64, lease: Lease, unsupported: bool) -> Option<Removed> {
        if self.jobs.get(&lease)?.owner.client != client {
            return None;
        }
        self.finish(
            lease,
            if unsupported {
                Reason::Unsupported
            } else {
                Reason::Cancelled
            },
        )
    }
    pub fn replace(&mut self, client: u64, request: &str) -> Vec<Removed> {
        let leases = self
            .jobs
            .iter()
            .filter(|(_, job)| {
                job.owner.client == client && job.owner.request.as_deref() == Some(request)
            })
            .map(|(lease, _)| *lease)
            .collect::<Vec<_>>();
        leases
            .into_iter()
            .filter_map(|lease| self.finish(lease, Reason::Revoked))
            .collect()
    }
    pub fn sync(&mut self, context: &Context<'_>, now: u64) -> Vec<Removed> {
        let ended = self
            .jobs
            .iter()
            .filter_map(|(lease, job)| {
                if !context.allows(&job.owner) {
                    Some((*lease, Reason::Revoked))
                } else if now >= job.expires_at {
                    Some((*lease, Reason::Expired))
                } else {
                    None
                }
            })
            .collect::<Vec<_>>();
        ended
            .into_iter()
            .filter_map(|(lease, reason)| self.finish(lease, reason))
            .collect()
    }
    pub fn clear(&mut self) -> Vec<Removed> {
        let leases = self.jobs.keys().copied().collect::<Vec<_>>();
        leases
            .into_iter()
            .filter_map(|lease| self.finish(lease, Reason::Revoked))
            .collect()
    }
    pub fn len(&self) -> usize {
        self.jobs.len()
    }
    pub fn is_empty(&self) -> bool {
        self.jobs.is_empty()
    }
}
