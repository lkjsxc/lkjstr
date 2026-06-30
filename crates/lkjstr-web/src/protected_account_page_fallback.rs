use lkjstr_app::ProtectedAccountAvailability;

use crate::protected_account_availability::ProtectedAccountResolution;

pub(crate) fn page_active_account_fallback(
    resolution: ProtectedAccountResolution,
    page_active_pubkey: Option<&str>,
) -> ProtectedAccountResolution {
    let Some(pubkey) = page_active_pubkey.filter(|value| !value.is_empty()) else {
        return resolution;
    };
    if !can_use_page_active_account(&resolution.availability) {
        return resolution;
    }
    ProtectedAccountResolution {
        availability: ProtectedAccountAvailability::selected(pubkey.to_owned()),
        diagnostic: Some(page_account_diagnostic(resolution.diagnostic)),
    }
}

fn can_use_page_active_account(availability: &ProtectedAccountAvailability) -> bool {
    matches!(
        availability,
        ProtectedAccountAvailability::SelectorUnavailable { .. }
            | ProtectedAccountAvailability::StorageBusy { .. }
            | ProtectedAccountAvailability::StorageBlocked { .. }
            | ProtectedAccountAvailability::StorageUnsupported { .. }
    )
}

fn page_account_diagnostic(previous: Option<String>) -> String {
    match previous {
        Some(reason) => format!("{reason}. Active account supplied by page data."),
        None => "Active account supplied by page data.".to_owned(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn storage_unavailable_can_use_page_account_without_hiding_reason() {
        let resolution = page_active_account_fallback(
            ProtectedAccountResolution {
                availability: ProtectedAccountAvailability::StorageBlocked {
                    reason: "Accounts unavailable: broker-missing".to_owned(),
                    retry_available: false,
                },
                diagnostic: Some("Accounts unavailable: broker-missing".to_owned()),
            },
            Some("a"),
        );

        assert_eq!(
            resolution.availability,
            ProtectedAccountAvailability::selected("a")
        );
        assert_eq!(
            resolution.diagnostic,
            Some(
                "Accounts unavailable: broker-missing. Active account supplied by page data."
                    .to_owned()
            )
        );
    }
}
