#![allow(clippy::unwrap_used)]
mod common;
use common::key;
use lkjstr_nips::{
    Error, auth,
    identity::{self, HttpResponse, Identifier},
};
use std::{
    future::Future,
    pin::pin,
    task::{Context, Poll, Waker},
};

#[test]
fn identifiers_root_alias_idna_and_injection_rejection() {
    assert_eq!(
        Identifier::parse("alice@EXAMPLE.com").unwrap().url(),
        "https://example.com/.well-known/nostr.json?name=alice"
    );
    assert_eq!(Identifier::parse("example.com").unwrap().name, "_");
    assert!(
        Identifier::parse("user@bücher.example")
            .unwrap()
            .domain
            .starts_with("xn--")
    );
    for invalid in [
        "",
        "a@@example.com",
        "A@example.com",
        "@example.com",
        "a@",
        "a+tag@example.com",
        "a@host/path",
        "a@host:443",
        "a@host?x",
        "a@host#frag",
        "a@host%2fpath",
        "a@-host.com",
        "a@host..com",
        "a@host\\evil",
        "a@ host",
        "a@host.",
    ] {
        assert!(
            Identifier::parse(invalid).is_err(),
            "invalid identifier accepted"
        );
    }
}
fn response(id: &Identifier, pubkey: &str) -> HttpResponse {
    HttpResponse {
        status: 200,
        final_url: id.url(),
        body: serde_json::json!({"names":{id.name.clone():pubkey},
        "relays":{pubkey:["wss://relay.example", "https://bad.example"]}})
        .to_string(),
    }
}
#[test]
fn response_binding_rejects_redirects_failures_oversize_and_key_replacement() {
    let id = Identifier::parse("alice@example.com").unwrap();
    let public = key(1).public_key();
    let binding = identity::verify_response(&id, &public, response(&id, &public), 4096).unwrap();
    assert_eq!(binding.pubkey, public);
    assert_eq!(binding.relays, vec!["wss://relay.example/"]);
    for status in [0, 201, 301, 302, 404, 500] {
        let mut r = response(&id, &public);
        r.status = status;
        assert!(identity::verify_response(&id, &public, r, 4096).is_err());
    }
    let mut r = response(&id, &public);
    r.final_url = "https://other.example/".into();
    assert_eq!(
        identity::verify_response(&id, &public, r, 4096),
        Err(Error::Http)
    );
    assert!(
        identity::verify_response(&id, &public, response(&id, &key(2).public_key()), 4096).is_err()
    );
    assert!(
        identity::verify_response(&id, &public, response(&id, &public.to_uppercase()), 4096)
            .is_err()
    );
    assert!(identity::verify_response(&id, &public, response(&id, &public), 1).is_err());
}
#[test]
fn async_fetch_is_injected_and_redirects_are_disabled() {
    let public = key(1).public_key();
    let id = Identifier::parse("alice@example.com").unwrap();
    let future = identity::verify("alice@example.com", &public, 4096, |request| {
        assert_eq!(request.url, id.url());
        assert!(!request.follow_redirects);
        assert_eq!(request.max_bytes, 4096);
        let r = response(&id, &public);
        async move { Ok(r) }
    });
    let mut future = pin!(future);
    let mut context = Context::from_waker(Waker::noop());
    let result = match future.as_mut().poll(&mut context) {
        Poll::Ready(r) => Some(r),
        Poll::Pending => None,
    };
    assert!(result.unwrap().is_ok());
}
#[test]
fn auth_event_message_challenge_relay_time_and_signature() {
    let key = key(1);
    let auth = auth::event(&key, "wss://relay.example", "challenge", 1000, &[4; 32]).unwrap();
    auth::verify(&auth, "wss://relay.example/", "challenge", 1600, 600).unwrap();
    assert!(auth::verify(&auth, "wss://relay.example/", "challenge", 1601, 600).is_err());
    assert!(auth::verify(&auth, "wss://other.example/", "challenge", 1000, 600).is_err());
    assert!(auth::verify(&auth, "wss://relay.example/", "different", 1000, 600).is_err());
    let message: serde_json::Value = serde_json::from_str(&auth::message(&auth).unwrap()).unwrap();
    assert_eq!(message[0], "AUTH");
    assert_eq!(message[1]["kind"], 22242);
    let mut invalid = auth.clone();
    invalid.data.kind = 1;
    assert!(auth::message(&invalid).is_err());
    let mut duplicate = auth.data.clone();
    duplicate
        .tags
        .push(vec!["challenge".into(), "challenge".into()]);
    let duplicate = duplicate.sign(&key, &[0; 32]).unwrap();
    assert!(auth::verify(&duplicate, "wss://relay.example", "challenge", 1000, 600).is_err());
}
