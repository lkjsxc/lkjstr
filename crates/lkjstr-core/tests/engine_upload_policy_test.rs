use lkjstr_core::engine::Engine;
#[test]
fn default_media_destinations_match_the_browser_verified_choices() {
    let mut engine = Engine::new();
    assert_eq!(
        engine.upload_servers(&"a".repeat(64)),
        vec![
            "https://blossom.band",
            "https://blossom.primal.net",
            "https://nostr.build",
            "https://nostrcheck.me",
        ]
    );
    assert!(!engine.upload_is_nip96("https://blossom.band"));
    assert!(engine.upload_is_nip96("https://nostr.build"));
    assert!(engine.upload_is_nip96("https://nostr.build/"));
    engine
        .servers
        .insert("https://custom.test".into(), ("nip96".into(), true));
    assert!(engine.upload_is_nip96("https://custom.test"));
}
