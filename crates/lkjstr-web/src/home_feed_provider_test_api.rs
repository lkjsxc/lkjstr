#![cfg(all(target_arch = "wasm32", debug_assertions))]

pub fn provider_with_page_account(
    db_name: String,
    worker_url: String,
    active_pubkey: String,
) -> lkjstr_ui::HomeFeedProvider {
    crate::home_feed_host::home_feed_provider_with_page_account(
        db_name,
        worker_url,
        Some(active_pubkey),
    )
}
