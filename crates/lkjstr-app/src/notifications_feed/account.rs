use crate::{FeedFooterState, FeedStateRow, ProtectedAccountAvailability, unavailable_state_row};

use super::{NotificationsFeedStatus, NotificationsFeedViewInput};

pub(super) struct NotificationsAccountBlock {
    pub(super) status: NotificationsFeedStatus,
    pub(super) footer: FeedFooterState,
}

pub(super) fn active_notifications_account(
    input: &NotificationsFeedViewInput,
    state_rows: &mut Vec<FeedStateRow>,
) -> Result<String, NotificationsAccountBlock> {
    match &input.account {
        ProtectedAccountAvailability::Selected { pubkey } => Ok(pubkey.clone()),
        ProtectedAccountAvailability::NoAccounts => block(
            state_rows,
            "no-accounts",
            "Notifications need an account before reading account activity.",
            false,
            NotificationsFeedStatus::NoActiveAccount,
            FeedFooterState::AuthRequired,
        ),
        ProtectedAccountAvailability::NoSelectedAccount => block(
            state_rows,
            "no-active-account",
            "Notifications need a selected account before reading account activity.",
            false,
            NotificationsFeedStatus::NoActiveAccount,
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
            NotificationsFeedStatus::AccountSelectorUnavailable,
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
            NotificationsFeedStatus::AccountStorageBusy,
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
            NotificationsFeedStatus::AccountStorageUnavailable,
            FeedFooterState::ConfigurationUnavailable,
        ),
        ProtectedAccountAvailability::StorageUnsupported { reason } => block(
            state_rows,
            "account-storage-unsupported",
            reason,
            false,
            NotificationsFeedStatus::AccountStorageUnavailable,
            FeedFooterState::ConfigurationUnavailable,
        ),
        ProtectedAccountAvailability::Loading => block(
            state_rows,
            "account-loading",
            "Notifications are waiting for account storage before reading activity.",
            false,
            NotificationsFeedStatus::Loading,
            FeedFooterState::Loading,
        ),
    }
}

fn block(
    state_rows: &mut Vec<FeedStateRow>,
    reason: &str,
    detail: &str,
    retry_available: bool,
    status: NotificationsFeedStatus,
    footer: FeedFooterState,
) -> Result<String, NotificationsAccountBlock> {
    state_rows.push(unavailable_state_row(
        reason,
        "notifications",
        detail,
        retry_available,
    ));
    Err(NotificationsAccountBlock { status, footer })
}
