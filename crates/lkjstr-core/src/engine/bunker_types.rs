use super::super::accounts::secret::SecretText;
use std::collections::{BTreeMap, BTreeSet};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Method {
    Connect,
    PublicKey,
    Sign,
    Encrypt44,
    Decrypt44,
    Decrypt04,
}
impl Method {
    pub fn name(self) -> &'static str {
        match self {
            Self::Connect => "connect",
            Self::PublicKey => "get_public_key",
            Self::Sign => "sign_event",
            Self::Encrypt44 => "nip44_encrypt",
            Self::Decrypt44 => "nip44_decrypt",
            Self::Decrypt04 => "nip04_decrypt",
        }
    }
    pub fn parse(method: &str) -> Option<Self> {
        [
            Self::Connect,
            Self::PublicKey,
            Self::Sign,
            Self::Encrypt44,
            Self::Decrypt44,
            Self::Decrypt04,
        ]
        .into_iter()
        .find(|m| m.name() == method)
    }
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Authority {
    pub generation: u64,
    pub peer: String,
    pub client: String,
}
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Owner {
    pub client: u64,
    pub account: Option<(String, Authority)>,
    pub request: Option<String>,
}
pub struct Context<'a> {
    pub clients: &'a BTreeSet<u64>,
    pub accounts: &'a BTreeMap<String, Authority>,
}
impl Context<'_> {
    pub(super) fn allows(&self, owner: &Owner) -> bool {
        self.clients.contains(&owner.client)
            && owner
                .account
                .as_ref()
                .is_none_or(|(account, authority)| self.accounts.get(account) == Some(authority))
    }
}
#[derive(Clone, Copy, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct Lease(pub(super) u64);
impl Lease {
    pub fn serial(self) -> u64 {
        self.0
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Reason {
    Finished,
    Cancelled,
    Unsupported,
    Revoked,
    Expired,
    Limited,
}
pub struct Removed {
    pub lease: Lease,
    pub owner: Owner,
    pub shown: bool,
    pub reason: Reason,
}
pub struct Start {
    pub owner: Owner,
    pub method: Method,
    pub peer: String,
    pub expires_at: u64,
}
pub struct Ticket {
    pub owner: Owner,
    pub method: Method,
    pub peer: String,
    pub expires_at: u64,
    pub(super) urls: Vec<SecretText>, // at most four distinct, bounded URLs
}
impl Ticket {
    pub fn url(&self) -> Option<&str> {
        self.urls.last().map(|url| &**url)
    }
}
