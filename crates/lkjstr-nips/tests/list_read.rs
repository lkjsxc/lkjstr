//! NIP-51 input bounds and cipher selection never fall back between algorithms.
use base64::{Engine, engine::general_purpose::STANDARD};
use lkjstr_nips::{
    Error,
    keys::SecretKey,
    list_crypto,
    list_read::{self, Format},
    nip44,
};
type Result = std::result::Result<(), Box<dyn std::error::Error>>;
#[test]
fn current_self_encrypted_tags_select_only_nip44() -> Result {
    let key = SecretKey::from_bytes([9; 32])?;
    let tags = vec![
        vec!["word".into(), "private fixture".into()],
        vec!["p".into(), key.public_key()],
    ];
    let content = list_crypto::encrypt(&tags, &key, &[7; 32])?;
    assert_eq!(list_read::format(&content)?, Some(Format::Nip44));
    assert_eq!(Format::Nip44.operation(), "nip44.decrypt");
    assert_eq!(
        list_read::entries(&serde_json::to_string(&tags)?)?.tags,
        tags
    );
    assert_eq!(list_read::format("")?, None);
    Ok(())
}
#[test]
fn historical_envelope_is_structural_and_has_no_write_operation() -> Result {
    let payload = format!(
        "{}?iv={}",
        STANDARD.encode([0; 16]),
        STANDARD.encode([1; 16])
    );
    assert_eq!(list_read::format(&payload)?, Some(Format::Nip04));
    assert_eq!(Format::Nip04.operation(), "nip04.decrypt");
    for payload in ["?iv=", "a?iv=b", "AAAA?iv=AAAA", "plain text", "Ag=="] {
        assert!(list_read::format(payload).is_err());
    }
    assert_eq!(list_read::format("#future"), Err(Error::Version));
    let mut unknown = vec![0; 99];
    unknown[0] = 3;
    assert_eq!(
        list_read::format(&STANDARD.encode(unknown)),
        Err(Error::Version)
    );
    assert_eq!(
        list_read::format(&"a".repeat(nip44::MAX_PAYLOAD + 1)),
        Err(Error::Size)
    );
    Ok(())
}
#[test]
fn tags_preserve_order_and_unknown_fields_with_real_allocation_accounting() -> Result {
    let text = r#"[["p","abc","wss://relay.invalid/","label"],["word","私的"],["custom","value"]]"#;
    let entries = list_read::entries(text)?;
    assert_eq!(serde_json::to_string(&entries.tags)?, text);
    assert!(entries.allocated >= text.len());
    for text in ["{}", "[[]]", "[[1]]", "[[\"p\"]] true", "null"] {
        assert!(list_read::entries(text).is_err());
    }
    Ok(())
}
#[test]
fn tag_and_field_caps_reject_excess_instead_of_truncating() -> Result {
    let tags = vec![vec!["x"]; list_read::MAX_TAGS];
    assert_eq!(
        list_read::entries(&serde_json::to_string(&tags)?)?
            .tags
            .len(),
        tags.len()
    );
    let tags = vec![vec!["x"]; list_read::MAX_TAGS + 1];
    assert!(matches!(
        list_read::entries(&serde_json::to_string(&tags)?),
        Err(Error::Size)
    ));
    let fields = vec!["x"; list_read::MAX_FIELDS + 1];
    assert!(matches!(
        list_read::entries(&serde_json::to_string(&vec![fields])?),
        Err(Error::Size)
    ));
    let tags = vec![
        vec!["x"; list_read::MAX_FIELDS];
        list_read::MAX_TOTAL_FIELDS / list_read::MAX_FIELDS + 1
    ];
    assert!(matches!(
        list_read::entries(&serde_json::to_string(&tags)?),
        Err(Error::Size)
    ));
    assert!(matches!(
        list_read::entries(&" ".repeat(nip44::MAX_PLAINTEXT + 1)),
        Err(Error::Size)
    ));
    Ok(())
}
