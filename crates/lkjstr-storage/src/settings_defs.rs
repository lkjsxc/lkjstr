#![doc = "Flat settings definition rows."]

use crate::settings_schema::SettingValueType;

#[derive(Clone, Copy)]
pub(super) struct SettingDefinition {
    pub key: &'static str,
    pub label: &'static str,
    pub value_type: SettingValueType,
    pub default_raw: &'static str,
    pub description: &'static str,
    pub options: &'static [&'static str],
    pub number: NumberConstraint,
}

#[derive(Clone, Copy, Default)]
pub(super) struct NumberConstraint {
    pub min: Option<f64>,
    pub max: Option<f64>,
    pub step: Option<f64>,
    pub integer: bool,
}

const NONE: &[&str] = &[];
const THEME: &[&str] = &["dark"];
const DEFAULT_TAB: &[&str] = &["timeline", "new-tab"];
const PUBLISH_MODE: &[&str] = &["selected-relays"];
const UPLOAD_PROVIDER: &[&str] = &[
    "disabled",
    "blossom",
    "nostr-build",
    "nostrcheck",
    "void-cat",
    "custom",
];
const ACCOUNT_MODE: &[&str] = &["read-only", "nip07"];

#[rustfmt::skip]
pub(super) const SETTINGS: &[SettingDefinition] = &[
    setting("appearance.theme", "Theme", SettingValueType::Enum, "dark", "Visual theme.", THEME),
    number("appearance.cornerRadius", "Corner radius", "2", "Global corner radius.", 0.0, 16.0, 1.0),
    setting("appearance.showAvatars", "Show avatars", SettingValueType::Boolean, "true", "Render avatars.", NONE),
    setting("workspace.recoverLastTile", "Recover last tile", SettingValueType::Boolean, "true", "Recover one tile when none remain.", NONE),
    setting("workspace.defaultTabKind", "Default tab", SettingValueType::Enum, "timeline", "Recovery tab kind.", DEFAULT_TAB),
    setting("tabs.closeLastTabClosesTile", "Close empty tile", SettingValueType::Boolean, "true", "Close tile after final tab.", NONE),
    setting("tabs.newTabChooserEnabled", "New Tab chooser", SettingValueType::Boolean, "true", "Use per-tile tab chooser.", NONE),
    number("tabs.inactiveRetentionSeconds", "Inactive tab retention", "300", "Seconds to retain inactive tab runtimes.", 0.0, 3600.0, 1.0),
    number("timeline.initialLimit", "Timeline limit", "50", "Initial timeline event limit.", 10.0, 180.0, 1.0),
    setting("timeline.showRelayProvenance", "Relay provenance", SettingValueType::Boolean, "true", "Show event relay source.", NONE),
    number("cache.maxBytes", "Site storage budget", "67108864", "Target site storage bytes.", 1048576.0, 10737418240.0, 1048576.0),
    number("relays.connectTimeoutMs", "Connect timeout", "5000", "Relay connect timeout.", 500.0, 30000.0, 100.0),
    setting("profiles.fetchMetadata", "Fetch metadata", SettingValueType::Boolean, "true", "Fetch profile metadata from relays.", NONE),
    setting("profiles.showNip05", "Show NIP-05", SettingValueType::Boolean, "true", "Show NIP-05 identifiers.", NONE),
    setting("notifications.enabled", "Notifications", SettingValueType::Boolean, "true", "Enable notifications.", NONE),
    setting("notifications.defaultCategories", "Categories", SettingValueType::Json, r#"["mentions"]"#, "Notification categories.", NONE),
    setting("content.hideSensitiveEvents", "Hide sensitive events", SettingValueType::Boolean, "true", "Hide NIP-36 content until revealed.", NONE),
    setting("tweet.defaultPublishMode", "Publish mode", SettingValueType::Enum, "selected-relays", "Tweet publish target.", PUBLISH_MODE),
    setting("tweet.mediaUploadProvider", "Media upload provider", SettingValueType::Enum, "blossom", "Media upload provider.", UPLOAD_PROVIDER),
    setting("tweet.mediaUploadCustomServer", "Custom upload server", SettingValueType::String, "", "Optional HTTPS media upload server.", NONE),
    setting("tweet.mediaUploadNoTransform", "No transform upload", SettingValueType::Boolean, "true", "Request original media upload.", NONE),
    setting("accounts.defaultMode", "Account mode", SettingValueType::Enum, "read-only", "Default account mode.", ACCOUNT_MODE),
    setting("security.allowLocalNsecImport", "Local nsec", SettingValueType::Boolean, "false", "Allow local nsec import.", NONE),
    setting("security.logSensitiveValues", "Sensitive logs", SettingValueType::Boolean, "false", "Log sensitive values.", NONE),
    setting("debug.showRuntimeCounters", "Runtime counters", SettingValueType::Boolean, "false", "Show runtime counters.", NONE),
    setting("debug.showRawEventActions", "Raw event actions", SettingValueType::Boolean, "false", "Show raw event actions.", NONE),
];

const fn setting(
    key: &'static str,
    label: &'static str,
    value_type: SettingValueType,
    default_raw: &'static str,
    description: &'static str,
    options: &'static [&'static str],
) -> SettingDefinition {
    SettingDefinition {
        key,
        label,
        value_type,
        default_raw,
        description,
        options,
        number: NumberConstraint {
            min: None,
            max: None,
            step: None,
            integer: false,
        },
    }
}

const fn number(
    key: &'static str,
    label: &'static str,
    default_raw: &'static str,
    description: &'static str,
    min: f64,
    max: f64,
    step: f64,
) -> SettingDefinition {
    SettingDefinition {
        number: NumberConstraint {
            min: Some(min),
            max: Some(max),
            step: Some(step),
            integer: true,
        },
        ..setting(
            key,
            label,
            SettingValueType::Number,
            default_raw,
            description,
            NONE,
        )
    }
}
