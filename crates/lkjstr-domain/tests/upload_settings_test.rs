use lkjstr_domain::{
    UploadProvider, default_upload_settings, upload_provider_from_key, upload_provider_key,
    upload_settings, valid_custom_upload_server,
};

#[test]
fn resolves_provider_servers() {
    assert_eq!(default_upload_settings().server, "https://nostr.build");
    assert_eq!(
        upload_settings(UploadProvider::Custom, " https://media.example ", true).server,
        "https://media.example"
    );
    assert_eq!(
        upload_settings(UploadProvider::Disabled, "https://media.example", true).server,
        ""
    );
}

#[test]
fn parses_provider_keys() {
    assert_eq!(
        upload_provider_from_key("void-cat"),
        Some(UploadProvider::VoidCat)
    );
    assert_eq!(
        upload_provider_key(UploadProvider::Nostrcheck),
        "nostrcheck"
    );
    assert_eq!(upload_provider_from_key("legacy"), None);
}

#[test]
fn validates_custom_server() {
    assert!(valid_custom_upload_server(""));
    assert!(valid_custom_upload_server("https://media.example"));
    assert!(!valid_custom_upload_server("http://media.example"));
    assert!(!valid_custom_upload_server("not a url"));
}
