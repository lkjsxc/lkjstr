#![allow(clippy::unwrap_used)]
use super::common;
use common::*;
use lkjstr_core::{engine::zaps::*, store::Store};
use lkjstr_nips::lnurl;
use serde_json::{Value, json};

#[test]
fn lnurl_roundtrip_accepts_uppercase_but_rejects_bad_checksum_and_scheme() {
    let url = "https://ln.test/.well-known/lnurlp/alice?x=1";
    let encoded = lnurl::encode(url).unwrap();
    assert_eq!(lnurl::decode(&encoded).unwrap(), url);
    assert_eq!(lnurl::decode(&encoded.to_ascii_uppercase()).unwrap(), url);
    assert!(lnurl::decode(&(encoded + "q")).is_err());
    assert!(lnurl::encode("file:///secret").is_err());
    assert!(lnurl::encode("https://user:pass@ln.test/").is_err());
}
#[test]
fn profile_binding_is_verified_current_and_canonical() {
    let mut store = Store::new(8);
    profile(&mut store, 2, "alice@LN.TEST", 1);
    let bound = binding(&store, &key(2).public_key()).unwrap();
    assert_eq!(bound.endpoint, "https://ln.test/.well-known/lnurlp/alice");
    assert_eq!(bound.address.as_deref(), Some("alice@ln.test"));
    let mut forged = event(2, 0, vec![], r#"{"lud16":"bob@ln.test"}"#, 2);
    forged.content.push(' ');
    store.insert(forged, None);
    assert_eq!(
        binding(&store, &key(2).public_key()),
        Err(Failure::Rejected)
    );
}
#[test]
fn malformed_address_never_falls_back_to_an_unrelated_lud06() {
    let mut store = Store::new(8);
    let encoded = lnurl::encode("https://ln.test/pay").unwrap();
    store.insert(
        event(
            2,
            0,
            vec![],
            &json!({"lud16":"alice@evil.test/path","lud06":encoded}).to_string(),
            1,
        ),
        None,
    );
    assert_eq!(
        binding(&store, &key(2).public_key()),
        Err(Failure::Rejected)
    );
    store.insert(
        event(2, 0, vec![], &json!({"lud06":encoded}).to_string(), 2),
        None,
    );
    assert_eq!(
        binding(&store, &key(2).public_key()).unwrap().endpoint,
        "https://ln.test/pay"
    );
}
#[test]
fn private_destinations_and_unsafe_address_characters_are_rejected() {
    for address in [
        "alice@127.0.0.1",
        "alice@10.0.0.1",
        "alice@localhost",
        "alice@host.local",
        "alice@ln.test:8443",
        "alice@ln.test?x=1",
        "alice@ln.test#fragment",
        "ALICE@ln.test",
        "alice@@ln.test",
    ] {
        let mut store = Store::new(8);
        profile(&mut store, 2, address, 1);
        assert!(binding(&store, &key(2).public_key()).is_err(), "{address}");
    }
}
#[test]
fn provider_requires_valid_key_limits_metadata_and_no_redirect() {
    let (store, _, _) = setup();
    let bound = binding(&store, &key(2).public_key()).unwrap();
    let original = response(&bound, 4);
    let good = provider(bound.clone(), &original, 100).unwrap();
    assert_eq!(good.expires_at, 700);
    for (field, value, expected) in [
        ("nostrPubkey", json!("ff".repeat(32)), Failure::Rejected),
        ("allowsNostr", json!(false), Failure::Unsupported),
        ("minSendable", json!(0), Failure::Rejected),
        ("maxSendable", json!(0), Failure::Rejected),
        (
            "callback",
            json!("http://ln.test/pay"),
            Failure::Unsupported,
        ),
        (
            "callback",
            json!("https://ln.test/pay?amount=5"),
            Failure::Rejected,
        ),
        (
            "metadata",
            json!(r#"[["text/plain","a"],["text/plain","b"]]"#),
            Failure::Rejected,
        ),
        (
            "payerData",
            json!({"email":{"mandatory":true}}),
            Failure::Unsupported,
        ),
    ] {
        let mut response = original.clone();
        let mut value_json: Value = serde_json::from_str(&response.body).unwrap();
        value_json[field] = value;
        response.body = value_json.to_string();
        assert_eq!(provider(bound.clone(), &response, 100), Err(expected));
    }
    let mut redirected = original;
    redirected.final_url.push_str("?redirect");
    assert_eq!(provider(bound, &redirected, 100), Err(Failure::Network));
}
#[test]
fn unknown_metadata_entries_can_contain_non_string_json() {
    let (store, _, _) = setup();
    let bound = binding(&store, &key(2).public_key()).unwrap();
    let mut response = response(&bound, 4);
    let mut value: Value = serde_json::from_str(&response.body).unwrap();
    value["metadata"] = json!(
        json!([
            ["text/plain","fixture"],["text/identifier","alice@ln.test"],
            ["application/example",{"arbitrary":[1,true]}]
        ])
        .to_string()
    );
    response.body = value.to_string();
    assert!(provider(bound, &response, 100).is_ok());
}

#[test]
fn lightning_address_tags_allow_the_services_canonical_base_identifier() {
    let mut store = Store::new(8);
    profile(&mut store, 2, "alice+receipt@LN.TEST", 1);
    let bound = binding(&store, &key(2).public_key()).unwrap();
    let mut response = response(&bound, 4);
    let mut value: Value = serde_json::from_str(&response.body).unwrap();
    value["metadata"] = json!(
        json!([
            ["text/plain", "tagged fixture"],
            ["text/identifier", "alice@LN.TEST"]
        ])
        .to_string()
    );
    response.body = value.to_string();
    assert!(provider(bound, &response, 100).is_ok());
}

#[test]
fn larger_provider_limits_are_capped_without_rejecting_supported_small_payments() {
    let (store, _, _) = setup();
    let bound = binding(&store, &key(2).public_key()).unwrap();
    let mut response = response(&bound, 4);
    let mut value: Value = serde_json::from_str(&response.body).unwrap();
    value["maxSendable"] = json!(u64::MAX);
    value["commentAllowed"] = json!(u64::MAX);
    response.body = value.to_string();
    let provider = provider(bound, &response, 100).unwrap();
    assert_eq!(provider.max_msat, MAX_MSAT);
    assert_eq!(provider.comment_allowed, 4096);
}
