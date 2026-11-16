use lkjstr_core::{
    engine::{
        network::{Effect, Network},
        protocol::{Query, Source},
    },
    store::Store,
};
use lkjstr_protocol::{
    EventTemplate, NostrEvent, NostrFilter, SecretKeyBytes, finalize_event, generate_secret_key,
};
use serde_json::{Value, json};
pub type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
pub const A: &str = "wss://a.test/";
pub const B: &str = "wss://b.test/";
pub const C: &str = "wss://c.test/";
pub const NOW: u64 = 200_000;
pub struct Fixture {
    pub network: Network,
    pub head: NostrFilter,
    pub query: Query,
    pub initial: Vec<(String, Value)>,
    key: SecretKeyBytes,
}
pub fn frames(network: &mut Network) -> Result<Vec<(String, Value)>> {
    network
        .drain_effects()
        .into_iter()
        .filter_map(|effect| match effect {
            Effect::Send(url, text) => {
                Some(serde_json::from_str::<Value>(&text).map(|frame| (url, frame)))
            }
            _ => None,
        })
        .collect::<std::result::Result<Vec<_>, _>>()
        .map_err(Into::into)
}
pub fn history(frames: &[(String, Value)]) -> Vec<(String, Value)> {
    frames
        .iter()
        .filter(|(_, f)| f[0] == "REQ" && f[2]["until"].is_number())
        .cloned()
        .collect()
}
impl Fixture {
    pub fn new() -> Result<Self> {
        let key = generate_secret_key();
        let event = signed(&key, 100)?;
        let query = Query {
            source: Source::Home,
            account: Some(event.pubkey.clone()),
            ..Default::default()
        };
        let head = NostrFilter {
            kinds: Some(vec![1, 6]),
            authors: Some(vec![event.pubkey]),
            limit: Some(200),
            ..Default::default()
        };
        let mut network = Network::default();
        network.configure(vec![A.into(), B.into(), C.into()], NOW);
        for url in [A, B, C] {
            network.relay_information(url, r#"{"limitation":{"max_limit":3}}"#);
        }
        let mut fixture = Self {
            network,
            head,
            query,
            initial: vec![],
            key,
        };
        fixture.plan(None, NOW + 1);
        fixture.initial = frames(&mut fixture.network)?;
        Ok(fixture)
    }
    pub fn plan(&mut self, page: Option<NostrFilter>, now: u64) {
        let mut wants = vec![("home".into(), self.head.clone(), self.query.clone())];
        if let Some(page) = page {
            wants.push(("home".into(), page, self.query.clone()));
        }
        self.network.plan(wants, &Store::new(0), now);
        for url in [A, B, C] {
            if self.network.relays.get(url).is_some_and(|r| r.connecting) {
                self.network.connected(url, now);
            }
        }
    }
    pub fn event(&self, at: u64) -> Result<NostrEvent> {
        signed(&self.key, at)
    }
    pub fn initial(&self, relay: &str) -> Result<Value> {
        self.initial
            .iter()
            .find(|(url, f)| url == relay && f[0] == "REQ")
            .map(|(_, f)| f.clone())
            .ok_or_else(|| "missing initial request".into())
    }
    pub fn answer(&mut self, relay: &str, request: &Value, times: &[u64], now: u64) -> Result {
        for at in times {
            let event = self.event(*at)?;
            assert!(
                self.network
                    .message(relay, &json!(["EVENT", request[1], event]).to_string(), now)
                    .is_some()
            );
        }
        self.network
            .message(relay, &json!(["EOSE", request[1]]).to_string(), now + 1);
        Ok(())
    }
    pub fn full_b() -> Result<Self> {
        let mut fixture = Self::new()?;
        fixture.answer(A, &fixture.initial(A)?, &[], NOW + 2)?;
        // Duplicate/cached responses count toward a full page without useful-arrival credit.
        fixture.answer(B, &fixture.initial(B)?, &[100, 90, 80], NOW + 2000)?;
        fixture.plan(None, NOW + 2002);
        frames(&mut fixture.network)?;
        assert_eq!(fixture.network.page_cursor(&fixture.head), Some(80));
        assert!(!fixture.network.page_exhausted(&fixture.head));
        Ok(fixture)
    }
    pub fn next(&self, until: u64) -> NostrFilter {
        NostrFilter {
            until: Some(until),
            ..self.head.clone()
        }
    }
}
fn signed(key: &SecretKeyBytes, at: u64) -> Result<NostrEvent> {
    finalize_event(
        &EventTemplate {
            pubkey: None,
            created_at: at,
            kind: 1,
            content: "owned history fixture".into(),
            tags: vec![],
        },
        key,
    )
    .map_err(|_| "fixture signing".into())
}
