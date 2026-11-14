//! The orchestration layer's planner. Tiles state *what* they need (`Want`);
//! the planner decides *where and how*: outbox relay choice, coalescing
//! across tiles, filter batching. The browser runtime diffs successive plans
//! into REQ and CLOSE messages and reports progress per want.

mod build;
mod filters;
mod routes;

pub use build::PlanContext;

pub use build::plan;

use std::collections::BTreeSet;

use lkjstr_protocol::{NostrFilter, filter_to_value};

pub type WantId = u32;

/// Default kinds shown in note timelines: notes and reposts.
pub const NOTE_KINDS: [u64; 2] = [1, 6];
/// Notification kinds: replies/mentions, reposts, reactions, zap receipts.
pub const MENTION_KINDS: [u64; 4] = [1, 6, 7, 9735];

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Want {
    /// Notes by these authors. `until` pages back in time (one-shot).
    Notes {
        authors: Vec<String>,
        until: Option<u64>,
        limit: u64,
    },
    Global {
        until: Option<u64>,
        limit: u64,
    },
    Mentions {
        pubkey: String,
        until: Option<u64>,
        limit: u64,
    },
    /// A note, its replies and reactions. Stays live.
    Thread {
        root: String,
        author: Option<String>,
        relays: Vec<String>,
    },
    /// Specific events (reply parents, quotes). One-shot.
    Events {
        ids: Vec<String>,
        relays: Vec<String>,
    },
    /// Deletions targeting displayed cached events. Stays live.
    Deletions {
        ids: Vec<String>,
        relays: Vec<String>,
    },
    /// Metadata and relay lists; `contacts` adds kind 3. One-shot.
    Profiles {
        pubkeys: Vec<String>,
        contacts: bool,
    },
    Search {
        query: String,
        limit: u64,
    },
}

impl Want {
    /// Live wants keep their subscription open after EOSE.
    pub fn is_live(&self) -> bool {
        match self {
            Want::Notes { until, .. }
            | Want::Global { until, .. }
            | Want::Mentions { until, .. } => until.is_none(),
            Want::Thread { .. } | Want::Deletions { .. } => true,
            _ => false,
        }
    }
}

/// Where requests may go when nothing better is known.
#[derive(Debug, Clone, Default)]
pub struct RelayDefaults {
    /// The user's read relays (or the app defaults).
    pub read: Vec<String>,
    /// Relays that index kind 0/10002 widely.
    pub indexers: Vec<String>,
    /// Relays that implement NIP-50 search.
    pub search: Vec<String>,
}

/// Lookup of each author's NIP-65 relays; the store implements it.
pub trait Directory {
    fn write_relays(&self, pubkey: &str) -> Option<Vec<String>>;
    fn read_relays(&self, pubkey: &str) -> Option<Vec<String>>;
}

/// One REQ on one relay, serving one or more wants.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Planned {
    pub relay: String,
    pub filters: Vec<NostrFilter>,
    pub wants: BTreeSet<WantId>,
    pub live: bool,
}

impl Planned {
    /// Stable identity of the request; equal keys mean the same REQ.
    pub fn key(&self) -> String {
        let filters: Vec<String> = self
            .filters
            .iter()
            .map(|filter| filter_to_value(filter).to_string())
            .collect();
        format!("{}|{}|{}", self.relay, self.live, filters.join(","))
    }
}
