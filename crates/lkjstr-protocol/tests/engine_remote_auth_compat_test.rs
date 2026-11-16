//! Only signed, correlated auth challenges may keep a bunker RPC pending.
use lkjstr_nips::{keys::SecretKey, nip44};
use lkjstr_protocol as p;
use serde_json::{Value, json};
type Result<T = ()> = std::result::Result<T, Box<dyn std::error::Error>>;

struct Fixture {
    secret: SecretKey,
    remote: p::remote::Remote,
}
impl Fixture {
    fn new() -> Result<Self> {
        let secret = SecretKey::from_bytes([7; 32]).map_err(|_| "fixture key")?;
        let (remote, _) = p::remote::Remote::parse(&format!(
            "bunker://{}?relay=ws://127.0.0.1:1",
            secret.public_key()
        ))
        .ok_or("fixture remote")?;
        Ok(Self { secret, remote })
    }
    fn response(&self, value: Value) -> Result<p::NostrEvent> {
        let client = self.remote.client().ok_or("fixture client")?;
        let peer = lkjstr_nips::unhex::<32>(&client).map_err(|_| "fixture peer")?;
        let key = nip44::conversation_key(&self.secret, &peer).map_err(|_| "fixture key")?;
        let content =
            nip44::encrypt(&value.to_string(), &key, &[9; 32]).map_err(|_| "fixture encrypt")?;
        Ok(p::sign_event_with_secret_hex(
            &p::UnsignedNostrEvent {
                pubkey: self.secret.public_key(),
                kind: 24133,
                created_at: 1700000000,
                tags: vec![vec!["p".into(), client]],
                content,
            },
            &lkjstr_nips::hex(&[7; 32]),
        )
        .map_err(|_| "fixture sign")?)
    }
}
#[test]
fn auth_url_does_not_settle_the_existing_response_contract() -> Result {
    let f = Fixture::new()?;
    let auth = f.response(
        json!({"id":"same-request", "result":"auth_url", "error":"https://signer.test/auth"}),
    )?;
    assert_eq!(f.remote.response(&auth, "same-request"), None);
    assert_eq!(f.remote.response_private(&auth, "same-request"), None);
    let done = f.response(json!({"id":"same-request", "result":"ack"}))?;
    assert_eq!(
        f.remote.response(&done, "same-request"),
        Some(Ok("ack".into()))
    );
    Ok(())
}
