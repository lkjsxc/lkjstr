use lkjstr_app::read_availability::{
    EffectiveReadRelays, ReadRelaySource, SessionDefaultReadPolicy,
};

#[test]
fn durable_empty_is_not_settings_unavailable() {
    let plan = EffectiveReadRelays::from_durable_settings(Vec::new());

    assert_eq!(plan.source, ReadRelaySource::DurableEmpty);
    assert!(plan.relays.is_empty());
    assert_eq!(plan.diagnostic, None);
    assert!(plan.write_allowed);
}

#[test]
fn unavailable_with_allowed_fallback_uses_read_only_defaults() {
    let plan = EffectiveReadRelays::from_unavailable(
        "opfs-owner-held",
        SessionDefaultReadPolicy::Allowed,
        vec!["wss://relay.example".to_owned()],
    );

    assert_eq!(plan.relays, vec!["wss://relay.example"]);
    assert_eq!(
        plan.source,
        ReadRelaySource::SessionDefaultPublicRead {
            reason: "opfs-owner-held".to_owned(),
        }
    );
    assert_eq!(
        plan.diagnostic.as_deref(),
        Some(
            "Relay settings unavailable: opfs-owner-held; using session default public read relays."
        )
    );
    assert!(!plan.write_allowed);
}

#[test]
fn unavailable_with_forbidden_fallback_stays_unavailable() {
    let plan = EffectiveReadRelays::from_unavailable(
        "web-lock-unavailable",
        SessionDefaultReadPolicy::Forbidden,
        vec!["wss://relay.example".to_owned()],
    );

    assert!(plan.relays.is_empty());
    assert_eq!(
        plan.source,
        ReadRelaySource::SettingsUnavailable {
            reason: "web-lock-unavailable".to_owned(),
        }
    );
    assert_eq!(
        plan.diagnostic.as_deref(),
        Some("Relay settings unavailable: web-lock-unavailable.")
    );
    assert!(!plan.write_allowed);
}
