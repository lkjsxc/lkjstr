//! Durable account authority: confirmed loads, checked revisions and no stale replay.
use super::accounts::Accounts;

pub const DATABASE_SCHEMA: u32 = 2;
pub const ACCOUNTS_KEY: &str = "engine-accounts";
pub const REVISION_KEY: &str = "engine-accounts-cas-v2";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Failure {
    Unavailable,
    Conflict,
    Exhausted,
}
impl Failure {
    pub fn code(self) -> &'static str {
        match self {
            Self::Conflict => "rejected",
            Self::Unavailable | Self::Exhausted => "internal",
        }
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct Revision(u64);
impl Revision {
    pub const INITIAL: Self = Self(0);
    pub fn parse(raw: &str) -> Result<Self, Failure> {
        if raw.is_empty() || raw.len() > 20 || !raw.bytes().all(|v| v.is_ascii_digit()) {
            return Err(Failure::Unavailable);
        }
        let value = raw.parse::<u64>().map_err(|_| Failure::Unavailable)?;
        if value.to_string() != raw {
            return Err(Failure::Unavailable);
        }
        Ok(Self(value))
    }
    pub fn encoded(self) -> String {
        self.0.to_string()
    }
    pub fn next(self) -> Result<Self, Failure> {
        self.0.checked_add(1).map(Self).ok_or(Failure::Exhausted)
    }
    pub fn compare(self, current: Self, writing: bool) -> Result<Self, Failure> {
        if current != self {
            return Err(Failure::Conflict);
        }
        if writing { self.next() } else { Ok(self) }
    }
}

/// Effects must not turn an error or non-string IndexedDB value into Absent.
pub enum Read<'a> {
    Absent,
    Text(&'a str),
    Failed,
}
pub struct Loaded {
    pub accounts: Accounts,
    pub revision: Revision,
}
pub fn load(value: Read<'_>, revision: Read<'_>) -> Result<Loaded, Failure> {
    let Read::Text(revision) = revision else {
        return Err(Failure::Unavailable);
    };
    let revision = Revision::parse(revision)?;
    let accounts: Accounts = match value {
        Read::Absent if revision == Revision::INITIAL => Accounts::default(),
        Read::Absent => return Err(Failure::Unavailable),
        Read::Text(raw) => serde_json::from_str(raw).map_err(|_| Failure::Unavailable)?,
        Read::Failed => return Err(Failure::Unavailable),
    };
    let mut seen = std::collections::BTreeSet::new();
    if accounts.entries.len() > 32
        || accounts
            .entries
            .iter()
            .any(|a| !lkjstr_protocol::is_pubkey(&a.pubkey) || !seen.insert(a.pubkey.clone()))
        || accounts.active.as_ref().is_some_and(|a| !seen.contains(a))
    {
        return Err(Failure::Unavailable);
    }
    Ok(Loaded { accounts, revision })
}

#[derive(Default)]
pub enum State {
    #[default]
    Loading,
    Ready(Revision),
    Unavailable,
    Stale,
}
impl State {
    pub fn expected(&self) -> Result<Revision, Failure> {
        match self {
            Self::Ready(value) => Ok(*value),
            Self::Stale => Err(Failure::Conflict),
            _ => Err(Failure::Unavailable),
        }
    }
    pub fn committed(&mut self, expected: Revision, next: Revision) -> Result<(), Failure> {
        if self.expected()? != expected || !(next == expected || next == expected.next()?) {
            return Err(Failure::Conflict);
        }
        *self = Self::Ready(next);
        Ok(())
    }
    pub fn rejected(&mut self, expected: Revision, failure: Failure) {
        if failure == Failure::Conflict && self.expected() == Ok(expected) {
            *self = Self::Stale;
        }
    }
}
