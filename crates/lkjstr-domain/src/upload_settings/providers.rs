use lkjstr_protocol::valid_https_url;

use crate::upload_settings::types::UploadProvider;

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct UploadProviderConfig {
    pub id: UploadProvider,
    pub key: &'static str,
    pub label: &'static str,
    pub server: &'static str,
}

const PROVIDERS: &[UploadProviderConfig] = &[
    UploadProviderConfig {
        id: UploadProvider::Disabled,
        key: "disabled",
        label: "Disabled",
        server: "",
    },
    UploadProviderConfig {
        id: UploadProvider::NostrBuild,
        key: "nostr-build",
        label: "nostr.build",
        server: "https://nostr.build",
    },
    UploadProviderConfig {
        id: UploadProvider::Nostrcheck,
        key: "nostrcheck",
        label: "Nostrcheck",
        server: "https://nostrcheck.me",
    },
    UploadProviderConfig {
        id: UploadProvider::VoidCat,
        key: "void-cat",
        label: "void.cat",
        server: "https://void.cat",
    },
    UploadProviderConfig {
        id: UploadProvider::Custom,
        key: "custom",
        label: "Custom",
        server: "",
    },
];

#[must_use]
pub fn upload_provider_configs() -> &'static [UploadProviderConfig] {
    PROVIDERS
}

#[must_use]
pub fn upload_provider_from_key(value: &str) -> Option<UploadProvider> {
    PROVIDERS
        .iter()
        .find(|provider| provider.key == value)
        .map(|provider| provider.id)
}

#[must_use]
pub fn upload_provider_key(provider: UploadProvider) -> &'static str {
    provider_config(provider).key
}

#[must_use]
pub fn upload_provider_label(provider: UploadProvider) -> &'static str {
    provider_config(provider).label
}

#[must_use]
pub fn valid_custom_upload_server(value: &str) -> bool {
    let value = value.trim();
    value.is_empty() || valid_https_url(value).is_some()
}

fn provider_config(provider: UploadProvider) -> &'static UploadProviderConfig {
    PROVIDERS
        .iter()
        .find(|config| config.id == provider)
        .unwrap_or(&PROVIDERS[1])
}
