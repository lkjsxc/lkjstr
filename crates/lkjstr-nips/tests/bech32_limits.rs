#![allow(clippy::unwrap_used)]
mod common;
use common::{bech32, event, key, tag};
use lkjstr_nips::{Error, entity::Entity, invoice::Invoice, zap::ZapRequest};

fn tlv(out: &mut Vec<u8>, kind: u8, bytes: &[u8]) {
    out.extend([kind, bytes.len() as u8]);
    out.extend(bytes);
}

fn address(relays: Vec<String>) -> (Entity, Vec<u8>) {
    let mut bytes = vec![0, 0];
    for relay in &relays {
        tlv(&mut bytes, 1, relay.as_bytes());
    }
    tlv(&mut bytes, 2, &[2; 32]);
    tlv(&mut bytes, 3, &30023_u32.to_be_bytes());
    (
        Entity::Address {
            identifier: String::new(),
            author: [2; 32],
            kind: 30023,
            relays,
        },
        bytes,
    )
}

#[test]
fn long_nip19_profiles_events_and_addresses_roundtrip() {
    let relay = format!("wss://relay.example/{}", "a".repeat(230));
    let relays = vec![relay; 4];
    let mut bytes = Vec::new();
    tlv(&mut bytes, 0, &[1; 32]);
    for relay in &relays {
        tlv(&mut bytes, 1, relay.as_bytes());
    }
    let (addr, addr_bytes) = address(relays.clone());
    for (entity, hrp, bytes) in [
        (
            Entity::Profile {
                pubkey: [1; 32],
                relays: relays.clone(),
            },
            "nprofile",
            bytes.clone(),
        ),
        (
            Entity::Event {
                id: [1; 32],
                relays,
                author: None,
                kind: None,
            },
            "nevent",
            bytes,
        ),
        (addr, "naddr", addr_bytes),
    ] {
        let encoded = bech32(hrp, &bytes);
        assert!((1024..=5000).contains(&encoded.len()));
        assert!(Entity::decode(&encoded).is_ok());
        assert!(Entity::decode(&encoded.to_ascii_uppercase()).is_ok());
        assert_eq!(entity.encode().unwrap(), encoded);
        assert_eq!(Entity::decode(&encoded).unwrap().encode().unwrap(), encoded);
        assert_eq!(
            Entity::from_uri(&format!("nostr:{encoded}"))
                .unwrap()
                .to_uri()
                .unwrap(),
            format!("nostr:{encoded}")
        );
        assert!(Entity::decode(&corrupt(&encoded)).is_err());
    }
}

#[test]
fn nip19_exact_limit_and_one_character_over() {
    for (last_length, expected_len) in [(246, 5000), (247, 5001)] {
        let mut relays = vec!["a".repeat(255); 11];
        relays.push("b".repeat(last_length));
        let (entity, bytes) = address(relays);
        let encoded = bech32("naddr", &bytes);
        assert_eq!(encoded.len(), expected_len);
        if expected_len == 5000 {
            assert_eq!(entity.encode().unwrap(), encoded);
            assert!(Entity::decode(&encoded).is_ok());
        } else {
            assert!(matches!(entity.encode(), Err(Error::Size)));
            assert!(matches!(Entity::decode(&encoded), Err(Error::Size)));
        }
    }
}

#[test]
fn long_route_hinted_invoices_keep_signature_checksum_and_size_checks() {
    for explicit_payee in [false, true] {
        for routes in [1, 19] {
            let encoded =
                common::invoices::invoice_with_routes("desc", "lnbc210n", explicit_payee, routes);
            assert!((1024..=16384).contains(&encoded.len()));
            let invoice = Invoice::parse(&encoded).unwrap();
            assert_eq!(invoice.amount_msat(), Some(21000));
            assert_eq!(
                Invoice::parse(&encoded.to_ascii_uppercase()).unwrap(),
                invoice
            );
            assert!(Invoice::parse(&corrupt(&encoded)).is_err());
            // Recompute a valid checksum after changing a signed payment hash.
            use bech32::Fe32;
            let (_, data) = encoded.rsplit_once('1').unwrap();
            let mut words: Vec<_> = data
                .bytes()
                .map(|c| Fe32::from_char(c as char).unwrap().to_u8())
                .collect();
            words.truncate(words.len() - 6);
            words[10] ^= 1;
            let tampered = common::invoices::encode_words("lnbc210n", &words);
            if explicit_payee {
                assert!(Invoice::parse(&tampered).is_err());
            } else {
                // Recovery can yield another valid key, but never the original payee.
                assert_ne!(Invoice::parse(&tampered).unwrap().payee(), invoice.payee());
            }
        }
    }
    let oversized = common::invoices::invoice_with_routes("desc", "lnbc210n", false, 20);
    assert!(oversized.len() > 16384);
    assert!(matches!(Invoice::parse(&oversized), Err(Error::Size)));
}

#[test]
fn long_lnurls_preserve_explicit_limit_and_checksum_checks() {
    for bytes_len in [1000, 3117, 3118] {
        let url = format!("https://pay.example/{}", "a".repeat(bytes_len - 20));
        assert_eq!(url.len(), bytes_len);
        let encoded = bech32("lnurl", url.as_bytes());
        let request = |lnurl: &str| {
            event(
                9734,
                vec![
                    tag(&["p", &key(2).public_key()]),
                    tag(&["relays", "wss://relay.example"]),
                    tag(&["lnurl", lnurl]),
                ],
                "",
            )
        };
        if encoded.len() <= 5000 {
            assert!(encoded.len() > 1023);
            assert!(ZapRequest::parse(&request(&encoded)).is_ok());
            assert!(ZapRequest::parse(&request(&encoded.to_ascii_uppercase())).is_ok());
            assert!(ZapRequest::parse(&request(&corrupt(&encoded))).is_err());
        } else {
            assert!(matches!(
                ZapRequest::parse(&request(&encoded)),
                Err(Error::Size)
            ));
        }
    }
}

fn corrupt(encoded: &str) -> String {
    let mut bytes = encoded.as_bytes().to_vec();
    let last = bytes.last_mut().unwrap();
    *last = if *last == b'q' { b'p' } else { b'q' };
    String::from_utf8(bytes).unwrap()
}
