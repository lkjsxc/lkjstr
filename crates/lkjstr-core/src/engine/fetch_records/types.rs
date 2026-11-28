use serde::Serialize;

#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum ResourceClass {
    Notes,
    Deletions,
    Counts,
    Profiles,
    RelayLists,
    Lists,
    Avatars,
    Media,
    Emoji,
    Previews,
    Nip05,
    Nip11,
    ServerLists,
    ZapEndpoints,
    OtherPublic,
    Mixed,
}
impl ResourceClass {
    pub fn event(kind: u64) -> Option<Self> {
        if !crate::optimizer::retention::public_kind(kind) {
            return None;
        }
        Some(match kind {
            0 => Self::Profiles,
            5 => Self::Deletions,
            7 | 9735 => Self::Counts,
            10002 => Self::RelayLists,
            10063 => Self::ServerLists,
            3 | 10000..=19999 | 30000..=30099 if kind != 30023 => Self::Lists,
            1 | 6 | 16 | 42 | 1111 | 30023 => Self::Notes,
            _ => Self::OtherPublic,
        })
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, serde::Deserialize)]
pub enum Lane {
    L0,
    L1,
    L2,
    L3,
    Unknown,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Connection {
    New,
    Reused,
    Unknown,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum WireBytes {
    Measured(u64),
    Unmeasured,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Outcome {
    Ok,
    PendingVerification,
    Duplicate,
    Rejected,
    Dropped,
    Miss,
    Timeout,
    Cancelled,
    Disconnected,
    RelayClosed,
    HttpStatus(u16),
    CorsBlocked,
    NetworkError,
    Unsupported,
    StorageUnavailable,
    Unknown,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Source {
    Memory,
    Indexeddb,
    HttpCache,
    Network,
    NetworkOrHttpCache,
    Unknown,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Scope {
    Resource,
    Request,
    Lookup,
    Store,
    Derive,
}
/// Hashes are keyed for this observer lifetime, not persistent resource identifiers.
/// Encode all 64 bits as text so a JavaScript JSON parser cannot round the key.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct KeyHash(pub(super) u64);
impl Serialize for KeyHash {
    fn serialize<S: serde::Serializer>(&self, serializer: S) -> Result<S::Ok, S::Error> {
        serializer.serialize_str(&format!("{:016x}", self.0))
    }
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct FetchRecord {
    pub class: ResourceClass,
    pub scope: Scope,
    pub lane: Lane,
    pub key: KeyHash,
    /// Origin only: never URL path, query, credentials, or relay error text.
    pub(super) origin: Option<String>,
    pub connection: Connection,
    pub wire_bytes: WireBytes,
    /// Verified event payload or committed Blob bytes; None means not observed.
    pub stored_bytes: Option<u64>,
    pub start_ms: Option<u64>,
    pub first_byte_ms: Option<u64>,
    pub end_ms: u64,
    pub outcome: Outcome,
    pub source: Source,
    pub display_size: Option<(u32, u32)>,
    pub first_visible_ms: Option<u64>,
    pub view: Option<KeyHash>,
    pub slot: Option<KeyHash>,
    /// Estimated link cost, not elapsed wall time. None means insufficient evidence.
    pub link_ms: Option<u64>,
}
impl FetchRecord {
    pub fn origin(&self) -> Option<&str> {
        self.origin.as_deref()
    }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum Action {
    Keep,
    Render,
    Resolution,
    Fetch,
    Relay,
    Prefetch,
    When,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize)]
pub struct Candidate {
    pub key: KeyHash,
    pub score: Option<u64>,
}
#[derive(Clone, Debug, PartialEq, Eq, Serialize)]
pub struct Decision {
    pub action: Action,
    pub at_ms: u64,
    pub candidates: Vec<Candidate>,
    pub omitted: usize,
    pub chosen: Vec<KeyHash>,
    pub chosen_omitted: usize,
}
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize)]
pub struct Totals {
    pub records: u64,
    pub measured_bytes: u64,
    pub unmeasured: u64,
    pub link_ms: u64,
    pub unknown_link: u64,
    pub zero_yield_eose: u64,
    pub replays: u64,
    pub ghost_hits: u64,
}
