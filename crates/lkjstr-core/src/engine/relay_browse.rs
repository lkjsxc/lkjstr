//! One relay opened on its own (`relay` source): what it says about itself (NIP-11) and the notes it served.
//! Bounds: one summary per known relay (64 readers), short text, at most 64 NIP numbers.
use super::{Engine, protocol::Source};
use lkjstr_nips::metadata::RelayInformation;
use serde_json::{Value, json};

/// The relay's information document as far as it is known.
#[derive(Clone, Debug, Default, PartialEq)]
pub enum InfoState {
    #[default]
    Unknown,
    /// Asked; no document came (no 200, too large, not JSON).
    Missing,
    Ready(Box<RelayInfo>),
}

/// What a reader can see of a relay's NIP-11 document; text is plain and cut short, nothing is fetched.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct RelayInfo {
    pub name: Option<String>,
    pub description: Option<String>,
    pub software: Option<String>,
    pub version: Option<String>,
    pub contact: Option<String>,
    /// Administrator key, only when it is 64 lower-case hex.
    pub admin: Option<String>,
    pub nips: Vec<u32>,
    pub auth: bool,
    pub payment: bool,
    pub restricted: bool,
    pub pow: Option<u64>,
}

fn text(value: Option<&String>, max: usize) -> Option<String> {
    let clean: String = value?
        .chars()
        .map(|c| if c.is_control() && c != '\n' { ' ' } else { c })
        .take(max)
        .collect();
    let clean = clean.trim();
    (!clean.is_empty()).then(|| clean.to_owned())
}

impl RelayInfo {
    pub fn of(info: &RelayInformation) -> Self {
        let limit = |key: &str| info.limitation.as_ref().and_then(|l| l.get(key));
        let flag = |key: &str| limit(key).and_then(Value::as_bool) == Some(true);
        let mut nips: Vec<u32> = info
            .supported_nips
            .iter()
            .copied()
            .filter(|n| *n < 10000)
            .collect();
        nips.sort_unstable();
        nips.dedup();
        nips.truncate(64);
        Self {
            name: text(info.name.as_ref(), 80),
            description: text(info.description.as_ref(), 600),
            software: text(info.software.as_ref(), 200),
            version: text(info.version.as_ref(), 40),
            contact: text(info.contact.as_ref(), 200),
            admin: info.pubkey.clone().filter(|k| {
                k.len() == 64
                    && k.bytes()
                        .all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
            }),
            nips,
            auth: flag("auth_required"),
            payment: flag("payment_required"),
            restricted: flag("restricted_writes"),
            pow: limit("min_pow_difficulty")
                .and_then(Value::as_u64)
                .filter(|n| *n > 0),
        }
    }
}

impl Engine {
    /// A relay served an event the store already held: a `relay` view showing that relay may now include it.
    pub(super) fn relay_served(&mut self, relay: &str, id: &str) {
        if !relay.starts_with("ws") || !self.store.note_seen(id, relay) {
            return;
        }
        for v in self.views.values_mut() {
            if v.query.source == Source::Relay && v.query.target.as_deref() == Some(relay) {
                v.dirty = true;
            }
        }
    }

    /// The answer to an information request (`None`: none came). Redraws the views of that relay.
    pub fn relay_information(&mut self, relay: &str, json: Option<&str>) {
        match json {
            Some(json) => self.network.relay_information(relay, json),
            None => self.network.record_information(relay, None),
        }
        for v in self.views.values_mut() {
            if v.query.source == Source::Relay && v.query.target.as_deref() == Some(relay) {
                v.dirty = true;
            }
        }
    }

    /// The relay row heading a `relay` view: its state, the reader's use of it, and its NIP-11 facts.
    pub fn relay_head(&self, url: &str) -> Value {
        let known = self.network.known.get(url);
        let relay = self.network.relays.get(url);
        let state = match relay {
            Some(s) if s.online => "connected",
            Some(s) if s.connecting => "connecting",
            Some(s) if s.failures > 0 => "waiting",
            _ => "idle",
        };
        let (read, write) = known.map_or((false, false), |k| (k.read, k.write));
        let why = if read || write {
            "yours"
        } else if known.is_some_and(|k| k.search) {
            "search"
        } else {
            "unused"
        };
        let mut row = json!({"kind":"relay","key":format!("relay:{url}"),"url":url,"state":state,
            "inUse":relay.is_some_and(|r| r.online),"why":why,"read":read,"write":write,"subs":0,
            "events":relay.map_or(0, |r| r.received)});
        if let Some(ms) = relay.and_then(|r| r.latency_ms) {
            row["latencyMs"] = json!(ms);
        }
        if let Some(error) = relay.and_then(|r| r.last_error.as_ref()) {
            row["error"] = json!(error);
        }
        info_fields(&mut row, relay.map(|r| &r.info));
        if let Some(admin) = relay.and_then(|r| match &r.info {
            InfoState::Ready(info) => info.admin.as_deref(),
            _ => None,
        }) {
            row["admin"] = super::wire::note::author(&super::rows::author(&self.store, admin));
        }
        row
    }
}

/// NIP-11 fields of a relay row; `info` says whether the document is still awaited, absent or read.
pub fn info_fields(row: &mut Value, info: Option<&InfoState>) {
    let info = match info {
        None | Some(InfoState::Unknown) => {
            row["info"] = json!("unknown");
            return;
        }
        Some(InfoState::Missing) => {
            row["info"] = json!("missing");
            return;
        }
        Some(InfoState::Ready(info)) => info,
    };
    row["info"] = json!("ready");
    for (key, value) in [
        ("name", &info.name),
        ("description", &info.description),
        ("software", &info.software),
        ("version", &info.version),
        ("contact", &info.contact),
    ] {
        if let Some(value) = value {
            row[key] = json!(value);
        }
    }
    if !info.nips.is_empty() {
        row["nips"] = json!(info.nips);
    }
    let mut limits = vec![];
    for (on, code) in [
        (info.auth, "auth"),
        (info.payment, "payment"),
        (info.restricted, "restricted"),
    ] {
        if on {
            limits.push(json!(code));
        }
    }
    if !limits.is_empty() {
        row["limits"] = json!(limits);
    }
    if let Some(pow) = info.pow {
        row["pow"] = json!(pow);
    }
}

impl super::network::Network {
    /// Keeps what a relay said about itself (`None`: it said nothing readable).
    pub fn record_information(&mut self, relay: &str, info: Option<&RelayInformation>) {
        if let Some(r) = self.relays.get_mut(relay) {
            r.info = info.map_or(InfoState::Missing, |i| {
                InfoState::Ready(Box::new(RelayInfo::of(i)))
            });
        }
    }
}
