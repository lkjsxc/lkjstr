#![allow(clippy::unwrap_used)]
mod common;
use bech32::{Bech32, Bech32m, Hrp};
use common::{fixed, key};
use lkjstr_nips::{entity::Entity, hex, thread};

const PROFILE: &str = "nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p";
#[test]
fn official_nip19_public_private_and_profile_examples() {
    for (text, expected) in [
        (
            "npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6",
            "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d",
        ),
        (
            "npub10elfcs4fr0l0r8af98jlmgdh9c8tcxjvz9qkw038js35mp4dma8qzvjptg",
            "7e7e9c42a91bfef19fa929e5fda1b72e0ebc1a4c1141673e2794234d86addf4e",
        ),
        (
            "nsec1vl029mgpspedva04g90vltkh6fvh240zqtv9k0t9af8935ke9laqsnlfe5",
            "67dea2ed018072d675f5415ecfaed7d2597555e202d85b3d65ea4e58d2d92ffa",
        ),
    ] {
        let entity = Entity::decode(text).unwrap();
        let bytes = match &entity {
            Entity::Npub(p) => *p,
            Entity::Nsec(s) => *s.as_bytes(),
            _ => [0; 32],
        };
        assert!(bytes == fixed::<32>(expected));
        assert!(entity.encode().unwrap() == text);
        assert!(Entity::decode(&text.to_ascii_uppercase()).is_ok());
    }
    let profile = Entity::decode(PROFILE).unwrap();
    assert!(matches!(&profile, Entity::Profile { pubkey, relays }
        if hex(pubkey) == "3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d"
        && relays == &["wss://r.x.com", "wss://djbas.sadkb.com"]));
    assert_eq!(profile.encode().unwrap(), PROFILE);
}
#[test]
fn every_entity_roundtrips_with_optional_metadata_and_unicode_identifiers() {
    for i in 1..=32 {
        let entities = [
            Entity::Npub([i; 32]),
            Entity::Note([i; 32]),
            Entity::Nsec(key(i)),
            Entity::Profile {
                pubkey: [i; 32],
                relays: vec![],
            },
            Entity::Event {
                id: [i; 32],
                relays: vec!["wss://relay.example".into()],
                author: Some([3; 32]),
                kind: Some(u32::MAX),
            },
            Entity::Event {
                id: [i; 32],
                relays: vec![],
                author: None,
                kind: None,
            },
            Entity::Address {
                identifier: "雪:article".into(),
                author: [i; 32],
                kind: 30023,
                relays: vec![],
            },
            Entity::Address {
                identifier: "".into(),
                author: [i; 32],
                kind: 0,
                relays: vec![],
            },
        ];
        for entity in entities {
            let encoded = entity.encode().unwrap();
            assert!(Entity::decode(&encoded).unwrap().encode().unwrap() == encoded);
        }
    }
}
fn raw(prefix: &str, bytes: &[u8]) -> String {
    bech32::encode::<Bech32>(Hrp::parse(prefix).unwrap(), bytes).unwrap()
}
#[test]
fn malformed_tlv_required_fields_checksum_variants_and_bounds() {
    for data in [
        vec![],
        vec![0],
        vec![0, 32, 1],
        vec![0, 0],
        vec![2, 31],
        vec![3, 3, 0, 0, 1],
    ] {
        assert!(Entity::decode(&raw("nprofile", &data)).is_err());
    }
    let mut duplicate = vec![0, 32];
    duplicate.extend([1; 32]);
    duplicate.extend([0, 32]);
    duplicate.extend([2; 32]);
    assert!(Entity::decode(&raw("nprofile", &duplicate)).is_err());
    let mut unknown = vec![9, 2, 1, 2, 0, 32];
    unknown.extend([1; 32]);
    assert!(Entity::decode(&raw("nprofile", &unknown)).is_ok());
    assert!(Entity::decode(&raw("naddr", &[0, 0])).is_err());
    assert!(Entity::decode(&raw("npub", &[1; 31])).is_err());
    assert!(Entity::decode(&raw("nsec", &[0; 32])).is_err());
    assert!(Entity::decode(&raw("unknown", &[1; 32])).is_err());
    assert!(
        Entity::decode(&bech32::encode::<Bech32m>(Hrp::parse("npub").unwrap(), &[1; 32]).unwrap())
            .is_err()
    );
    assert!(Entity::decode(&"a".repeat(5001)).is_err());
    assert!(
        Entity::decode(&format!(
            "NPUB{}",
            &Entity::Npub([1; 32]).encode().unwrap()[4..]
        ))
        .is_err()
    );
    let bad = Entity::Profile {
        pubkey: [1; 32],
        relays: vec!["a".repeat(256)],
    };
    assert!(bad.encode().is_err());
}
#[test]
fn nip21_official_examples_and_secret_exclusion() {
    for uri in [
        "nostr:npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9",
        "nostr:nevent1qqstna2yrezu5wghjvswqqculvvwxsrcvu7uc0f78gan4xqhvz49d9spr3mhxue69uhkummnw3ez6un9d3shjtn4de6x2argwghx6egpr4mhxue69uhkummnw3ez6ur4vgh8wetvd3hhyer9wghxuet5nxnepm",
        "nostr:naddr1qqyrzwrxvc6ngvfkqyghwumn8ghj7enfv96x5ctx9e3k7mgzyqalp33lewf5vdq847t6te0wvnags0gs0mu72kz8938tn24wlfze6qcyqqq823cph95ag",
    ] {
        assert_eq!(Entity::from_uri(uri).unwrap().to_uri().unwrap(), uri);
    }
    let secret = Entity::Nsec(key(1));
    assert!(secret.to_uri().is_err());
    assert!(Entity::from_uri(&format!("nostr:{}", secret.encode().unwrap())).is_err());
    for invalid in [
        format!("https:{PROFILE}"),
        format!("nostr://{PROFILE}"),
        format!("nostr:{PROFILE}?x=1"),
    ] {
        assert!(Entity::from_uri(&invalid).is_err());
    }
}
#[test]
fn mentions_keep_utf8_byte_spans_skip_malformed_and_never_link_secrets() {
    let profile = format!("nostr:{PROFILE}");
    let note = Entity::Note([7; 32]).to_uri().unwrap();
    let secret = format!("nostr:{}", Entity::Nsec(key(1)).encode().unwrap());
    let content = format!("雪({profile}), broken nostr:npub1bad {secret} — {note}!");
    let mentions = thread::mentions(&content);
    assert_eq!(mentions.len(), 2);
    assert_eq!(&content[mentions[0].start..mentions[0].end], profile);
    assert_eq!(&content[mentions[1].start..mentions[1].end], note);
    assert_eq!(thread::mentions("nostr: 你好").len(), 0);
}
