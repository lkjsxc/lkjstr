#![allow(clippy::unwrap_used)]
mod common;
use lkjstr_nips::{
    entity::Entity, event::Event, invoice::Invoice, metadata::RelayInformation, thread,
};

#[test]
fn generated_malformed_inputs_are_bounded_and_mentions_keep_valid_byte_spans() {
    let mut state = 7u64;
    let alphabet = ['a', '1', ':', '/', '?', '\0', '\n', '"', '雪', '🔥', 'é'];
    for length in 0..256 {
        let mut input = String::new();
        for _ in 0..length {
            state = state.wrapping_mul(6364136223846793005).wrapping_add(1);
            input.push(alphabet[(state as usize) % alphabet.len()]);
        }
        let _ = Entity::decode(&input);
        let _ = Entity::from_uri(&input);
        let _ = Event::parse(&input, 1024);
        let _ = Invoice::parse(&input);
        let _ = RelayInformation::parse(&input, 1024);
        let valid = Entity::Note([1; 32]).to_uri().unwrap();
        let text = format!("{input} ({valid}), nostr:bad {input}");
        for mention in thread::mentions(&text) {
            assert!(mention.start < mention.end && mention.end <= text.len());
            assert!(text.is_char_boundary(mention.start) && text.is_char_boundary(mention.end));
            assert!(Entity::from_uri(&text[mention.start..mention.end]).is_ok());
        }
    }
}
#[test]
fn unsupported_profile_tlvs_are_ignored_but_event_metadata_is_strict() {
    use bech32::{Bech32, Hrp};
    let mut data = vec![0, 32];
    data.extend([1; 32]);
    data.extend([2, 1, 9, 3, 0]);
    let profile = bech32::encode::<Bech32>(Hrp::parse("nprofile").unwrap(), &data).unwrap();
    assert!(Entity::decode(&profile).is_ok());
    assert!(Entity::decode(&profile.to_uppercase()).is_ok());
    let event = bech32::encode::<Bech32>(Hrp::parse("nevent").unwrap(), &data).unwrap();
    assert!(Entity::decode(&event).is_err());
}
