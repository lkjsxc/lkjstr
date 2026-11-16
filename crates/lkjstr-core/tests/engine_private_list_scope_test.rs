//! Cached private list membership belongs only to the signed list owner's query.
use lkjstr_core::engine::{
    Engine,
    network::Effect,
    protocol as p,
    wire::{Input, Output, Session},
};
use lkjstr_nips::{event::UnsignedEvent, keys::SecretKey, list_crypto};
use serde_json::{Value, json};
use std::collections::BTreeSet;
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;
const RELAY: &str = "wss://private-list-scope.test/";
struct Fixture {
    owner: String,
    other: String,
    public: String,
    private: String,
    id: String,
}
#[derive(Clone, Copy)]
enum Reader {
    Owner,
    Other,
    Absent,
}
fn key() -> Result<SecretKey> {
    Ok(SecretKey::from_bytes(
        *lkjstr_protocol::generate_secret_key().as_bytes(),
    )?)
}
impl Fixture {
    fn insert(engine: &mut Engine, public_private: bool) -> Result<Self> {
        let owner = key()?;
        let public = key()?.public_key();
        let private = key()?.public_key();
        let entries = vec![vec!["p".into(), private.clone()]];
        let nonce = *lkjstr_protocol::generate_secret_key().as_bytes();
        let content = list_crypto::encrypt(&entries, &owner, &nonce)?;
        let mut tags = vec![
            vec!["d".into(), "scope".into()],
            vec!["p".into(), public.clone()],
        ];
        if public_private {
            tags.push(vec!["p".into(), private.clone()]);
        }
        let signed = UnsignedEvent::new(owner.public_key(), 100, 30000, tags, content)
            .sign(&owner, &[0; 32])?;
        let plaintext = list_crypto::decrypt(&signed, &owner)?;
        let parsed = lkjstr_protocol::parse_nostr_event_json(&signed.to_json()?, None)
            .map_err(|_| "invalid signed list fixture")?;
        engine.store.insert(parsed, None);
        engine.private_lists.insert(signed.id.clone(), plaintext);
        Ok(Self {
            owner: owner.public_key(),
            other: key()?.public_key(),
            public,
            private,
            id: signed.id,
        })
    }
    fn account(&self, reader: Reader) -> Option<&str> {
        match reader {
            Reader::Owner => Some(&self.owner),
            Reader::Other => Some(&self.other),
            Reader::Absent => None,
        }
    }
    fn open(&self, engine: &mut Engine, reader: Reader) -> Result<Session> {
        let mut session = Session::default();
        let input: Input = serde_json::from_value(json!({
            "t":"open", "sub":"list",
            "query":{"source":"list", "tag":format!("30000:{}:scope", self.owner),
                "account":self.account(reader)}
        }))?;
        for input in session.input(input, engine).map_err(|(_, e)| e)? {
            engine.input(input, 100_000);
        }
        Ok(session)
    }
    fn rows(&self, engine: &mut Engine, reader: Reader) -> Result<Vec<String>> {
        let mut session = self.open(engine, reader)?;
        let output = engine.drain();
        let rows = output
            .into_iter()
            .flat_map(|o| session.output(o, engine))
            .filter_map(|o| match o {
                Output::Rows { rows, .. } => Some(rows),
                _ => None,
            })
            .flatten()
            .filter_map(|row| {
                if row["kind"] == "person" {
                    row["key"].as_str().map(str::to_owned)
                } else {
                    None
                }
            })
            .collect();
        Ok(rows)
    }
    fn profiles(&self, engine: &mut Engine, reader: Reader) -> Result<BTreeSet<String>> {
        engine.input(
            p::Input::Configure {
                relays: vec![RELAY.into()],
            },
            100_000,
        );
        let _session = self.open(engine, reader)?;
        engine.network.connected(RELAY, 100_001);
        let mut frames = Vec::new();
        for now in [100_100, 100_300, 100_600, 101_000] {
            engine.tick(now);
            for effect in engine.network.drain_effects() {
                if let Effect::Send(_, text) = effect {
                    frames.push(serde_json::from_str::<Value>(&text)?);
                }
            }
        }
        Ok(frames
            .iter()
            .filter(|f| f[0] == "REQ")
            .filter_map(Value::as_array)
            .flat_map(|f| f.iter().skip(2))
            .filter(|f| f["kinds"] == json!([0]))
            .flat_map(|f| f["authors"].as_array().into_iter().flatten())
            .filter_map(|p| p.as_str().map(str::to_owned))
            .collect())
    }
}
fn projection(reader: Reader, private: bool) -> Result {
    let mut engine = Engine::new();
    let fixture = Fixture::insert(&mut engine, false)?;
    let rows = fixture.rows(&mut engine, reader)?;
    assert!(
        rows.contains(&fixture.public),
        "the public member remains visible"
    );
    assert_eq!(
        rows.contains(&fixture.private),
        private,
        "private membership follows the query owner"
    );
    Ok(())
}
fn hydration(reader: Reader, private: bool) -> Result {
    let mut engine = Engine::new();
    let fixture = Fixture::insert(&mut engine, false)?;
    let authors = fixture.profiles(&mut engine, reader)?;
    assert!(
        authors.contains(&fixture.public),
        "the public member is hydrated"
    );
    assert_eq!(
        authors.contains(&fixture.private),
        private,
        "private membership cannot become another reader's lookup"
    );
    Ok(())
}
#[test]
fn owner_can_project_private_list_members() -> Result {
    projection(Reader::Owner, true)
}
#[test]
fn signed_out_list_query_projects_only_public_members() -> Result {
    projection(Reader::Absent, false)
}
#[test]
fn other_account_list_query_projects_only_public_members() -> Result {
    projection(Reader::Other, false)
}
#[test]
fn owner_can_hydrate_private_list_members() -> Result {
    hydration(Reader::Owner, true)
}
#[test]
fn signed_out_list_query_never_hydrates_private_members() -> Result {
    hydration(Reader::Absent, false)
}
#[test]
fn other_account_list_query_never_hydrates_private_members() -> Result {
    hydration(Reader::Other, false)
}
#[test]
fn an_explicit_public_member_stays_visible_once_for_every_reader() -> Result {
    for reader in [Reader::Owner, Reader::Other, Reader::Absent] {
        let mut engine = Engine::new();
        let fixture = Fixture::insert(&mut engine, true)?;
        let rows = fixture.rows(&mut engine, reader)?;
        assert_eq!(rows.iter().filter(|p| **p == fixture.private).count(), 1);
        assert!(
            fixture
                .profiles(&mut engine, reader)?
                .contains(&fixture.private)
        );
    }
    Ok(())
}
#[test]
fn revoking_one_owner_preserves_other_authorized_private_lists() -> Result {
    let mut engine = Engine::new();
    let first = Fixture::insert(&mut engine, false)?;
    let second = Fixture::insert(&mut engine, false)?;
    let retained = BTreeSet::from([second.owner.clone()]);
    assert!(
        engine
            .retain_private_accounts(&retained, 100_000, false)
            .is_some()
    );
    assert!(!engine.private_lists.contains_key(&first.id));
    assert!(engine.private_lists.contains_key(&second.id));
    assert_eq!(
        first.rows(&mut engine, Reader::Owner)?,
        vec![first.public.clone()]
    );
    let rows = second.rows(&mut engine, Reader::Owner)?;
    assert!(rows.contains(&second.public) && rows.contains(&second.private));
    Ok(())
}
