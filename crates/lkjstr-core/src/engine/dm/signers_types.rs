//! Opaque identities for bounded private signer work; no message or key material.
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct Read {
    pub(super) serial: u64,
    pub(super) account: String,
    pub(super) client: u64,
    pub(super) epoch: u64,
    pub(super) event: String,
}
impl Read {
    pub fn account(&self) -> &str {
        &self.account
    }
    pub fn client(&self) -> u64 {
        self.client
    }
    pub fn epoch(&self) -> u64 {
        self.epoch
    }
    pub fn event(&self) -> &str {
        &self.event
    }
}
#[derive(Clone, Debug, Eq, Ord, PartialEq, PartialOrd)]
pub struct Lease {
    pub(super) serial: u64,
    pub(super) account: String,
    pub(super) client: u64,
    pub(super) epoch: u64,
    pub(super) read: Option<u64>,
}
impl Lease {
    pub fn account(&self) -> &str {
        &self.account
    }
    pub fn client(&self) -> u64 {
        self.client
    }
    pub fn epoch(&self) -> u64 {
        self.epoch
    }
}
#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum Failure {
    Refused,
    Unsupported,
    Timeout,
    Missing,
}
impl Failure {
    pub fn from_code(code: &str) -> Option<Self> {
        match code {
            "signer-refused" => Some(Self::Refused),
            "unsupported" => Some(Self::Unsupported),
            "signer-timeout" => Some(Self::Timeout),
            "signer-missing" => Some(Self::Missing),
            _ => None,
        }
    }
    pub fn code(self) -> &'static str {
        match self {
            Self::Refused => "signer-refused",
            Self::Unsupported => "unsupported",
            Self::Timeout => "signer-timeout",
            Self::Missing => "signer-missing",
        }
    }
}
pub(super) struct Account {
    pub epoch: u64,
    pub visible: bool,
    pub failure: Option<Failure>,
    pub reading: Option<Read>,
}
pub(super) struct Call {
    pub lease: Lease,
    pub running: bool,
}
