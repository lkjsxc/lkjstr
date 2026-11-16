//! Fresh-key fixtures; no remote services or persistent account data.
use lkjstr_core::{
    engine::private_lists::{Access, Demand, Job, Reads},
    store::Store,
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey, list_crypto};
use std::collections::BTreeMap;
pub type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
pub struct Fixture {
    pub key: SecretKey,
    pub store: Store,
    pub reads: Reads,
}
impl Fixture {
    pub fn new() -> Result<Self> {
        Ok(Self {
            key: SecretKey::from_bytes(*lkjstr_protocol::generate_secret_key().as_bytes())?,
            store: Store::with_caps(20_010, 256),
            reads: Reads::default(),
        })
    }
    pub fn account(&self) -> String {
        self.key.public_key()
    }
    pub fn access(&self) -> BTreeMap<String, Access> {
        [(
            self.account(),
            Access {
                authority: 1,
                local: false,
                error: None,
            },
        )]
        .into()
    }
    pub fn list(&mut self, kind: u16, at: u64, label: &str) -> Result<String> {
        let content = list_crypto::encrypt(
            &[vec!["word".into(), label.into()]],
            &self.key,
            lkjstr_protocol::generate_secret_key().as_bytes(),
        )?;
        self.envelope(kind, at, label, content)
    }
    pub fn envelope(&mut self, kind: u16, at: u64, label: &str, content: String) -> Result<String> {
        let tags = if kind == 30000 {
            vec![vec!["d".into(), label.into()]]
        } else {
            vec![]
        };
        let event = UnsignedEvent::new(self.account(), at, kind, tags, content)
            .sign(&self.key, &[0; 32])?;
        let parsed = lkjstr_protocol::parse_nostr_event_json(&event.to_json()?, None)
            .map_err(|_| "fixture parse")?;
        self.store.insert(parsed, None);
        Ok(event.id)
    }
    pub fn demand(&self, ids: &[String]) -> Demand {
        Demand {
            client: 1,
            sub: "list".into(),
            account: self.account(),
            events: ids.to_vec(),
            external: true,
        }
    }
    pub fn sync(&mut self, ids: &[String], now: u64) {
        self.reads
            .sync(&self.store, self.access(), vec![self.demand(ids)], now);
    }
    pub fn job(&mut self, now: u64) -> Result<Job> {
        self.reads
            .next(&self.store, now)
            .ok_or("missing private read job".into())
    }
}
