#![doc = "Protected account availability for account-scoped feeds."]

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProtectedAccountAvailability {
    Selected {
        pubkey: String,
    },
    NoAccounts,
    NoSelectedAccount,
    SelectorUnavailable {
        reason: String,
        retry_available: bool,
    },
    StorageBusy {
        reason: String,
        retry_available: bool,
    },
    StorageBlocked {
        reason: String,
        retry_available: bool,
    },
    StorageUnsupported {
        reason: String,
    },
    Loading,
}

impl ProtectedAccountAvailability {
    #[must_use]
    pub fn selected(pubkey: impl Into<String>) -> Self {
        Self::Selected {
            pubkey: pubkey.into(),
        }
    }

    #[must_use]
    pub fn initial(active_pubkey: Option<String>) -> Self {
        active_pubkey.map_or(Self::Loading, Self::selected)
    }

    #[must_use]
    pub fn active_pubkey(&self) -> Option<&str> {
        match self {
            Self::Selected { pubkey } => Some(pubkey),
            Self::NoAccounts
            | Self::NoSelectedAccount
            | Self::SelectorUnavailable { .. }
            | Self::StorageBusy { .. }
            | Self::StorageBlocked { .. }
            | Self::StorageUnsupported { .. }
            | Self::Loading => None,
        }
    }
}
