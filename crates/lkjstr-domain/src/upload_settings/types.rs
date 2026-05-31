use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UploadSettings {
    pub provider: UploadProvider,
    pub custom_server: String,
    pub server: String,
    pub no_transform: bool,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum UploadProvider {
    Disabled,
    NostrBuild,
    Nostrcheck,
    VoidCat,
    Custom,
}

#[must_use]
pub fn upload_settings(
    provider: UploadProvider,
    custom_server: impl Into<String>,
    no_transform: bool,
) -> UploadSettings {
    let custom_server = custom_server.into();
    let server = provider_server(provider, &custom_server);
    UploadSettings {
        provider,
        custom_server,
        server,
        no_transform,
    }
}

#[must_use]
pub fn default_upload_settings() -> UploadSettings {
    upload_settings(UploadProvider::NostrBuild, "", true)
}

#[must_use]
pub fn provider_server(provider: UploadProvider, custom_server: &str) -> String {
    match provider {
        UploadProvider::Disabled => String::new(),
        UploadProvider::Custom => custom_server.trim().to_owned(),
        UploadProvider::NostrBuild => "https://nostr.build".to_owned(),
        UploadProvider::Nostrcheck => "https://nostrcheck.me".to_owned(),
        UploadProvider::VoidCat => "https://void.cat".to_owned(),
    }
}
