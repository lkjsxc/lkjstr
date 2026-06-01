use std::collections::{BTreeMap, BTreeSet, VecDeque};

pub const fn max_relay_message_records() -> usize {
    32
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RelayMessageState {
    eose: BTreeSet<String>,
    closed: BTreeMap<String, String>,
    ok: BTreeMap<String, bool>,
    notices: VecDeque<String>,
    auth_challenges: VecDeque<String>,
    max_records: usize,
}

impl Default for RelayMessageState {
    fn default() -> Self {
        Self::new(max_relay_message_records())
    }
}

impl RelayMessageState {
    #[must_use]
    pub fn new(max_records: usize) -> Self {
        Self {
            eose: BTreeSet::new(),
            closed: BTreeMap::new(),
            ok: BTreeMap::new(),
            notices: VecDeque::new(),
            auth_challenges: VecDeque::new(),
            max_records,
        }
    }

    pub(super) fn record_eose(&mut self, subscription_id: String) {
        self.eose.insert(subscription_id);
    }

    pub(super) fn record_closed(&mut self, subscription_id: String, message: String) {
        prune_map(&mut self.closed, self.max_records);
        self.closed.insert(subscription_id, message);
    }

    pub(super) fn record_ok(&mut self, event_id: String, accepted: bool) {
        prune_map(&mut self.ok, self.max_records);
        self.ok.insert(event_id, accepted);
    }

    pub(super) fn record_notice(&mut self, message: String) {
        push_bounded(&mut self.notices, self.max_records, message);
    }

    pub(super) fn record_auth(&mut self, challenge: String) {
        push_bounded(&mut self.auth_challenges, self.max_records, challenge);
    }

    #[must_use]
    pub fn eose_seen(&self, subscription_id: &str) -> bool {
        self.eose.contains(subscription_id)
    }

    #[must_use]
    pub fn closed_reason(&self, subscription_id: &str) -> Option<&str> {
        self.closed.get(subscription_id).map(String::as_str)
    }

    #[must_use]
    pub fn ok_accepted(&self, event_id: &str) -> Option<bool> {
        self.ok.get(event_id).copied()
    }

    #[must_use]
    pub fn notice_count(&self) -> usize {
        self.notices.len()
    }

    #[must_use]
    pub fn auth_count(&self) -> usize {
        self.auth_challenges.len()
    }
}

fn push_bounded(records: &mut VecDeque<String>, max_records: usize, value: String) {
    if records.len() >= max_records {
        records.pop_front();
    }
    records.push_back(value);
}

fn prune_map<T>(records: &mut BTreeMap<String, T>, max_records: usize) {
    if records.len() < max_records {
        return;
    }
    if let Some(key) = records.keys().next().cloned() {
        records.remove(&key);
    }
}
