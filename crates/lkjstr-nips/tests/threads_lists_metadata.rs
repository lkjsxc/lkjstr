#![allow(clippy::unwrap_used)]
mod common;
use common::{tag, unsigned};
use lkjstr_nips::{
    address::Coordinate,
    lists::{self, Contact, List},
    metadata::{self, RelayInformation},
    thread,
};

#[test]
fn marked_threads_override_positional_references_and_quotes_are_not_replies() {
    let (root, parent, mention) = ("11".repeat(32), "22".repeat(32), "33".repeat(32));
    let e = unsigned(
        1,
        vec![
            tag(&["e", &mention]),
            tag(&["e", &parent, "", "reply"]),
            tag(&["e", &root, "wss://relay.example", "root"]),
            tag(&["q", &mention]),
        ],
        "",
    );
    let parsed = thread::parse(&e);
    assert_eq!(parsed.root.unwrap().id, root);
    assert_eq!(parsed.reply.unwrap().id, parent);
    assert!(parsed.mentions.is_empty());
    let e = unsigned(1, vec![tag(&["e", &root, "", "root"])], "");
    assert_eq!(thread::parse(&e).root, thread::parse(&e).reply);
    assert!(
        thread::parse(&unsigned(1, vec![tag(&["q", &mention])], ""))
            .reply
            .is_none()
    );
}
#[test]
fn positional_threads_and_malformed_references() {
    let ids: Vec<_> = (1..=3).map(|n| format!("{n:064x}")).collect();
    let e = unsigned(1, ids.iter().map(|id| tag(&["e", id])).collect(), "");
    let t = thread::parse(&e);
    assert_eq!(t.root.unwrap().id, ids[0]);
    assert_eq!(t.reply.unwrap().id, ids[2]);
    assert_eq!(t.mentions[0].id, ids[1]);
    let e = unsigned(1, vec![tag(&["e", &ids[0]])], "");
    assert_eq!(thread::parse(&e).root, thread::parse(&e).reply);
    assert!(
        thread::parse(&unsigned(14, vec![tag(&["e", &ids[0]])], ""))
            .root
            .is_none()
    );
    assert!(
        thread::parse(&unsigned(1, vec![tag(&["e", "bad"])], ""))
            .reply
            .is_none()
    );
}
#[test]
fn contact_order_petname_empty_relay_and_duplicates() {
    let key = "ab".repeat(32);
    let contacts = vec![Contact {
        pubkey: key.clone(),
        relay: None,
        petname: Some("friend".into()),
    }];
    let tags = lists::contact_tags(&contacts).unwrap();
    assert_eq!(tags[0], tag(&["p", &key, "", "friend"]));
    let mut e = unsigned(3, tags, "legacy relay JSON");
    e.tags.push(tag(&["p", &key]));
    e.tags.push(tag(&["p", "bad"]));
    assert_eq!(lists::contacts(&e).unwrap(), contacts);
    assert!(lists::contacts(&unsigned(1, vec![], "")).is_err());
}
#[test]
fn lists_preserve_unknown_tags_order_private_ciphertext_and_set_identifiers() {
    for kind in [
        10000, 10001, 10002, 10003, 10007, 10050, 30000, 30001, 30002, 30003, 30015, 30030,
    ] {
        let e = unsigned(
            kind,
            vec![tag(&["d", "friends"]), tag(&["future", "value"])],
            "opaque ciphertext",
        );
        let list = List::parse(&e).unwrap();
        assert_eq!(list.event(e.pubkey.clone(), e.created_at).unwrap(), e);
        assert_eq!(list.encrypted_content, "opaque ciphertext");
    }
    assert!(List::parse(&unsigned(30000, vec![], "")).is_err());
    assert!(List::parse(&unsigned(1, vec![], "")).is_err());
    assert_eq!(
        List::private_entries("[[\"p\",\"key\"]]", 100).unwrap(),
        vec![tag(&["p", "key"])]
    );
    assert!(List::private_entries("[[]]", 100).is_err());
    assert!(List::private_entries("[]", 1).is_err());
}
#[test]
fn relay_information_optional_fields_extensions_and_request_path() {
    let info = RelayInformation::parse(r#"{"name":"test","supported_nips":[1,11,50],"future":true,"limitation":{"auth_required":true}}"#, 1024).unwrap();
    assert!(info.supports(50));
    assert!(!info.supports(44));
    assert!(info.extra.contains_key("future"));
    assert!(RelayInformation::parse("{}", 10).is_ok());
    assert!(RelayInformation::parse("{}", 1).is_err());
    assert!(RelayInformation::parse(r#"{"supported_nips":"50"}"#, 100).is_err());
    assert_eq!(
        metadata::information_request("wss://relay.example/path?x=1").unwrap(),
        (
            "https://relay.example/path?x=1".into(),
            "application/nostr+json"
        )
    );
}
#[test]
fn expiration_boundary_warning_and_malformed_tags() {
    let e = unsigned(
        1,
        vec![tag(&["expiration", "100"]), tag(&["content-warning"])],
        "",
    );
    assert!(!metadata::is_expired(&e, 99).unwrap());
    assert!(metadata::is_expired(&e, 100).unwrap());
    assert!(metadata::is_expired(&e, 101).unwrap());
    assert_eq!(metadata::content_warning(&e), Some(""));
    assert_eq!(
        metadata::content_warning(&unsigned(
            1,
            vec![tag(&["content-warning", "spoilers"])],
            ""
        )),
        Some("spoilers")
    );
    assert_eq!(metadata::content_warning(&unsigned(1, vec![], "")), None);
    for value in ["-1", "+1", " 1", "1.0", "", "18446744073709551616"] {
        assert!(metadata::expiration(&unsigned(1, vec![tag(&["expiration", value])], "")).is_err());
    }
    assert!(
        metadata::expiration(&unsigned(
            1,
            vec![tag(&["expiration", "1"]), tag(&["expiration", "2"])],
            ""
        ))
        .is_err()
    );
}
#[test]
fn coordinates_preserve_colons_and_validate_replaceable_ranges() {
    let address = format!("30023:{}:article:part1", "ab".repeat(32));
    assert_eq!(Coordinate::parse(&address).unwrap().to_string(), address);
    assert!(Coordinate::parse(&format!("1:{}:", "ab".repeat(32))).is_err());
    assert!(Coordinate::parse(&format!("0:{}:nonempty", "ab".repeat(32))).is_err());
    assert!(Coordinate::parse("30023:bad:d").is_err());
}
