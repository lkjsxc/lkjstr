#![allow(clippy::unwrap_used)]
mod common;
use bech32::{Bech32, Bech32m, ByteIterExt, Fe32, Fe32IterExt, Hrp};
use lkjstr_nips::{entity::Entity, zap::ZapRequest};

#[test]
fn extending_length_preserves_case_checksum_variant_and_padding_rejections() {
    let mut profile = vec![0, 32];
    profile.extend([1; 32]);
    for _ in 0..4 {
        profile.extend([1, 255]);
        profile.extend([b'a'; 255]);
    }
    let url = format!("https://pay.example/{}", "a".repeat(1001));
    for (hrp, bytes) in [("nprofile", profile.as_slice()), ("lnurl", url.as_bytes())] {
        let original = common::bech32(hrp, bytes);
        assert!(original.len() > 1023);
        let parse = |encoded: &str| {
            if hrp == "nprofile" {
                Entity::decode(encoded).is_ok()
            } else {
                ZapRequest::parse(&common::event(
                    9734,
                    vec![
                        common::tag(&["p", &common::key(2).public_key()]),
                        common::tag(&["relays", "wss://relay.example"]),
                        common::tag(&["lnurl", encoded]),
                    ],
                    "",
                ))
                .is_ok()
            }
        };
        assert!(parse(&original));
        assert!(!parse(&format!(
            "{}{}",
            hrp.to_ascii_uppercase(),
            &original[hrp.len()..]
        )));
        let hrp = Hrp::parse(hrp).unwrap();
        let wrong_variant: String = bytes
            .iter()
            .copied()
            .bytes_to_fes()
            .with_checksum::<Bech32m>(&hrp)
            .chars()
            .collect();
        assert!(!parse(&wrong_variant));
        assert!(!(bytes.len() * 8).is_multiple_of(5));
        let mut words: Vec<_> = bytes.iter().copied().bytes_to_fes().collect();
        let last = words.last_mut().unwrap();
        *last = Fe32::try_from(last.to_u8() | 1).unwrap();
        let wrong_padding: String = words
            .into_iter()
            .with_checksum::<Bech32>(&hrp)
            .chars()
            .collect();
        assert!(!parse(&wrong_padding));
    }
}
