#![doc = "Typed effective read-relay availability for feed surfaces."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum SessionDefaultReadPolicy {
    Allowed,
    Forbidden,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ReadRelaySource {
    DurableSettings,
    DurableEmpty,
    SessionDefaultPublicRead { reason: String },
    SettingsUnavailable { reason: String },
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct EffectiveReadRelays {
    pub relays: Vec<String>,
    pub source: ReadRelaySource,
    pub diagnostic: Option<String>,
    pub write_allowed: bool,
}

impl EffectiveReadRelays {
    #[must_use]
    pub fn from_durable_settings(relays: Vec<String>) -> Self {
        let source = if relays.is_empty() {
            ReadRelaySource::DurableEmpty
        } else {
            ReadRelaySource::DurableSettings
        };
        Self {
            relays,
            source,
            diagnostic: None,
            write_allowed: true,
        }
    }

    #[must_use]
    pub fn from_unavailable(
        reason: impl Into<String>,
        policy: SessionDefaultReadPolicy,
        session_default_relays: Vec<String>,
    ) -> Self {
        let reason = reason.into();
        match policy {
            SessionDefaultReadPolicy::Allowed => Self {
                relays: session_default_relays,
                source: ReadRelaySource::SessionDefaultPublicRead {
                    reason: reason.clone(),
                },
                diagnostic: Some(format!(
                    "Relay settings unavailable: {reason}; using session default public read relays."
                )),
                write_allowed: false,
            },
            SessionDefaultReadPolicy::Forbidden => Self {
                relays: Vec::new(),
                source: ReadRelaySource::SettingsUnavailable {
                    reason: reason.clone(),
                },
                diagnostic: Some(format!("Relay settings unavailable: {reason}.")),
                write_allowed: false,
            },
        }
    }

    #[must_use]
    pub fn has_read_relays(&self) -> bool {
        !self.relays.is_empty()
    }
}
