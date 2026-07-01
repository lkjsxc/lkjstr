use lkjstr_app::{
    ProtectedAccountAvailability,
    read_availability::{EffectiveReadRelays, SessionDefaultReadPolicy},
};

use crate::{
    effective_public_relays::effective_read_relays, host_status::browser_now_ms,
    notifications_feed_host::NotificationsFeedHost,
    protected_account_availability::resolve_protected_account,
    protected_account_page_fallback::page_active_account_fallback,
};

pub(crate) async fn active_account(
    host: &NotificationsFeedHost,
) -> (ProtectedAccountAvailability, Option<String>) {
    let account = page_active_account_fallback(
        resolve_protected_account(&host.db_name, &host.worker_url).await,
        host.page_active_pubkey.as_deref(),
    );
    (account.availability, account.diagnostic)
}

pub(crate) async fn selected_relays(host: &NotificationsFeedHost) -> EffectiveReadRelays {
    effective_read_relays(
        &host.db_name,
        &host.worker_url,
        browser_now_ms(),
        SessionDefaultReadPolicy::Allowed,
    )
    .await
}
