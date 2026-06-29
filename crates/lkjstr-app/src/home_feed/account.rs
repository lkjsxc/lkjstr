use crate::{FeedFooterState, FeedStateRow, ProtectedAccountAvailability, unavailable_state_row};

use super::{HomeFeedStatus, HomeFeedViewInput};

pub(super) struct HomeAccountBlock {
    pub(super) status: HomeFeedStatus,
    pub(super) footer: FeedFooterState,
}

pub(super) fn active_home_account(
    input: &HomeFeedViewInput,
    state_rows: &mut Vec<FeedStateRow>,
) -> Result<String, HomeAccountBlock> {
    match &input.account {
        ProtectedAccountAvailability::Selected { pubkey } => Ok(pubkey.clone()),
        ProtectedAccountAvailability::NoAccounts => block(
            state_rows,
            "no-accounts",
            "Home needs an account before it can read followed notes.",
            false,
            HomeFeedStatus::NoActiveAccount,
            FeedFooterState::AuthRequired,
        ),
        ProtectedAccountAvailability::NoSelectedAccount => block(
            state_rows,
            "no-active-account",
            "Home needs a selected account before it can read followed notes.",
            false,
            HomeFeedStatus::NoActiveAccount,
            FeedFooterState::AuthRequired,
        ),
        ProtectedAccountAvailability::SelectorUnavailable {
            reason,
            retry_available,
        } => block(
            state_rows,
            "account-selector-unavailable",
            reason,
            *retry_available,
            HomeFeedStatus::AccountSelectorUnavailable,
            FeedFooterState::RetryableFailure,
        ),
        ProtectedAccountAvailability::StorageBusy {
            reason,
            retry_available,
        } => block(
            state_rows,
            "account-storage-busy",
            reason,
            *retry_available,
            HomeFeedStatus::AccountStorageBusy,
            FeedFooterState::RetryableFailure,
        ),
        ProtectedAccountAvailability::StorageBlocked {
            reason,
            retry_available,
        } => block(
            state_rows,
            "account-storage-blocked",
            reason,
            *retry_available,
            HomeFeedStatus::AccountStorageUnavailable,
            FeedFooterState::ConfigurationUnavailable,
        ),
        ProtectedAccountAvailability::StorageUnsupported { reason } => block(
            state_rows,
            "account-storage-unsupported",
            reason,
            false,
            HomeFeedStatus::AccountStorageUnavailable,
            FeedFooterState::ConfigurationUnavailable,
        ),
        ProtectedAccountAvailability::Loading => block(
            state_rows,
            "account-loading",
            "Home is waiting for account storage before reading followed notes.",
            false,
            HomeFeedStatus::LoadingAccount,
            FeedFooterState::Loading,
        ),
    }
}

fn block(
    state_rows: &mut Vec<FeedStateRow>,
    reason: &str,
    detail: &str,
    retry_available: bool,
    status: HomeFeedStatus,
    footer: FeedFooterState,
) -> Result<String, HomeAccountBlock> {
    state_rows.push(unavailable_state_row(
        reason,
        "home",
        detail,
        retry_available,
    ));
    Err(HomeAccountBlock { status, footer })
}
