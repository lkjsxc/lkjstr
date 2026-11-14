use bech32::{Bech32, Bech32m, ByteIterExt, Fe32, Fe32IterExt, Hrp};
use lkjstr_protocol::{AddressPointer, NostrEntity, ProfilePointer, decode_nip19, encode_nip19};

fn wire(hrp: &str, bytes: &[u8]) -> Result<String, String> {
    let hrp = Hrp::parse(hrp).map_err(|error| error.to_string())?;
    Ok(bytes
        .iter()
        .copied()
        .bytes_to_fes()
        .with_checksum::<Bech32>(&hrp)
        .chars()
        .collect())
}

fn profile() -> (NostrEntity, Vec<u8>) {
    let relays = vec![format!("wss://relay.example/{}", "a".repeat(230)); 4];
    let mut bytes = vec![0, 32];
    bytes.extend([1; 32]);
    for relay in &relays {
        bytes.extend([1, relay.len() as u8]);
        bytes.extend(relay.as_bytes());
    }
    (
        NostrEntity::Nprofile(ProfilePointer {
            pubkey: "01".repeat(32),
            relays: Some(relays),
        }),
        bytes,
    )
}

#[test]
fn encode_long_relay_hinted_profile() -> Result<(), String> {
    let (entity, bytes) = profile();
    let encoded = encode_nip19(&entity).map_err(|error| format!("{error:?}"))?;
    assert!(encoded.len() > 1023);
    assert_eq!(encoded, wire("nprofile", &bytes)?);
    Ok(())
}

#[test]
fn decode_long_relay_hinted_profile() -> Result<(), String> {
    let (entity, bytes) = profile();
    let encoded = wire("nprofile", &bytes)?;
    assert!(encoded.len() > 1023);
    assert_eq!(decode_nip19(&encoded), Some(entity.clone()));
    assert_eq!(decode_nip19(&encoded.to_ascii_uppercase()), Some(entity));
    Ok(())
}

#[test]
fn exact_limit_and_one_character_over() -> Result<(), String> {
    for (last, length) in [(246, 5000), (247, 5001)] {
        let mut relays = vec!["a".repeat(255); 11];
        relays.push("b".repeat(last));
        let mut bytes = vec![0, 0];
        for relay in &relays {
            bytes.extend([1, relay.len() as u8]);
            bytes.extend(relay.as_bytes());
        }
        bytes.extend([2, 32]);
        bytes.extend([2; 32]);
        bytes.extend([3, 4]);
        bytes.extend(30023_u32.to_be_bytes());
        let entity = NostrEntity::Naddr(AddressPointer {
            identifier: String::new(),
            pubkey: "02".repeat(32),
            kind: 30023,
            relays: Some(relays),
        });
        let encoded = wire("naddr", &bytes)?;
        assert_eq!(encoded.len(), length);
        if length == 5000 {
            assert_eq!(decode_nip19(&encoded), Some(entity.clone()));
            assert_eq!(
                encode_nip19(&entity).map_err(|error| format!("{error:?}"))?,
                encoded
            );
        } else {
            assert_eq!(decode_nip19(&encoded), None);
            assert!(encode_nip19(&entity).is_err());
        }
    }
    Ok(())
}

#[test]
fn long_inputs_preserve_original_checksum_case_and_padding_rules() -> Result<(), String> {
    let (_, bytes) = profile();
    let hrp = Hrp::parse("nprofile").map_err(|error| error.to_string())?;
    let encoded = wire("nprofile", &bytes)?;
    assert_eq!(decode_nip19(&format!("N{}", &encoded[1..])), None);
    let wrong_variant: String = bytes
        .iter()
        .copied()
        .bytes_to_fes()
        .with_checksum::<Bech32m>(&hrp)
        .chars()
        .collect();
    assert_eq!(decode_nip19(&wrong_variant), None);
    let mut words: Vec<_> = bytes.iter().copied().bytes_to_fes().collect();
    let last = words.last_mut().ok_or("empty payload")?;
    *last = Fe32::try_from(last.to_u8() | 1).map_err(|error| error.to_string())?;
    let wrong_padding: String = words
        .into_iter()
        .with_checksum::<Bech32>(&hrp)
        .chars()
        .collect();
    assert_eq!(decode_nip19(&wrong_padding), None);
    Ok(())
}
