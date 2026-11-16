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
fn challenge_is_intermediate_for_the_same_request() -> Result {
    let f = Fixture::new()?;
    let event = f.response(json!({"id":"request", "result":"auth_url", "error":"https://signer.test/authorize?token=private"}))?;
    assert_eq!(f.remote.response(&event, "request"), None);
    assert_eq!(f.remote.response_private(&event, "request"), None);
    let response = f
        .remote
        .classify_response(&event, "request", true)
        .ok_or("challenge")?;
    assert!(
        matches!(response, p::remote::Response::Authenticate(ref url) if url.as_str().starts_with("https://signer.test/"))
    );
    assert!(!format!("{response:?}").contains("private"));
    let done = f.response(json!({"id":"request", "result":"ack"}))?;
    assert_eq!(f.remote.response(&done, "request"), Some(Ok("ack".into())));
    Ok(())
}
#[test]
fn challenge_requires_every_existing_authentication_check() -> Result {
    let f = Fixture::new()?;
    let event = f.response(
        json!({"id":"request", "result":"auth_url", "error":"https://signer.test/authorize"}),
    )?;
    assert!(f.remote.classify_response(&event, "other", false).is_none());
    let mut invalid = event.clone();
    invalid.sig = "0".repeat(128);
    assert!(
        f.remote
            .classify_response(&invalid, "request", false)
            .is_none()
    );
    let mut invalid = event.clone();
    invalid.kind = 1;
    assert!(
        f.remote
            .classify_response(&invalid, "request", false)
            .is_none()
    );
    let mut invalid = event;
    invalid.pubkey = "a".repeat(64);
    assert!(
        f.remote
            .classify_response(&invalid, "request", false)
            .is_none()
    );
    Ok(())
}
#[test]
fn url_policy_rejects_credentials_controls_and_remote_cleartext() -> Result {
    for bad in [
        "javascript:alert(1)",
        "data:text/plain,token",
        "file:///tmp/a",
        "https://user:password@signer.test/a",
        "https://user@signer.test/a",
        "https://signer.test/a\n",
        " https://signer.test/a",
        "https://signer.test/a b",
        "http://signer.test/a",
        "http://localhost/a",
        "http://127.1/a",
        "https://signer.test\\@elsewhere/a",
    ] {
        assert!(
            p::remote::AuthUrl::parse(bad).is_none(),
            "unsafe URL accepted"
        );
    }
    assert!(
        p::remote::AuthUrl::parse(&format!("https://signer.test/{}", "a".repeat(4096))).is_none()
    );
    for good in [
        "https://signer.test/authorize?token=private#challenge",
        "http://127.0.0.1:1234/auth",
        "http://[::1]:1234/auth",
    ] {
        assert!(p::remote::AuthUrl::parse(good).is_some());
    }
    let f = Fixture::new()?;
    for error in [json!(null), json!("javascript:alert(1)"), json!({})] {
        let event = f.response(json!({"id":"request", "result":"auth_url", "error":error}))?;
        assert_eq!(
            f.remote.response(&event, "request"),
            Some(Err("signer-refused"))
        );
    }
    Ok(())
}
#[test]
fn ordinary_errors_keep_the_existing_private_mapping() -> Result {
    let f = Fixture::new()?;
    for error in ["unsupported", "not authorized", "signer-timeout"] {
        let event = f.response(json!({"id":"request", "error":error}))?;
        assert_eq!(
            f.remote.response(&event, "request"),
            Some(Err("signer-refused"))
        );
        assert_eq!(
            f.remote.response_private(&event, "request"),
            Some(Err(if error == "unsupported" {
                "unsupported"
            } else {
                "signer-refused"
            }))
        );
    }
    Ok(())
}
