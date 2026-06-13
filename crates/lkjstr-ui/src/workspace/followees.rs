use leptos::prelude::*;
use lkjstr_app::{
    FolloweesDiagnostic, FolloweesRow, FolloweesStatus, FolloweesView, default_followees_view,
};

use crate::workspace::followees_provider::{FolloweesLease, FolloweesProvider};

#[component]
pub fn FolloweesTab(
    owner: String,
    target_pubkey: Option<String>,
    model: FolloweesView,
    provider: Option<FolloweesProvider>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let active_lease = RwSignal::new(None::<FolloweesLease>);
    if provider.is_some() {
        start_followees_read(
            provider.clone(),
            owner.clone(),
            target_pubkey.clone(),
            model,
            active_lease,
        );
        on_cleanup(move || release_active_followees(active_lease));
    }
    view! {
        <section class="followees-tab feed-tab" aria-label="Following">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner event-list__viewport" data-scroll-owner="">
                    {move || followees_header(model.get())}
                    <p class="lkjstr-feed-status">{move || model.get().message}</p>
                    {move || retry_button(
                        model.get().status,
                        provider.clone(),
                        owner.clone(),
                        target_pubkey.clone(),
                        model,
                        active_lease,
                    )}
                    <div class="lkjstr-feed-rows">
                        {move || model.get().diagnostics.into_iter().map(diagnostic_row).collect_view()}
                        {move || model.get().rows.into_iter().map(followee_row).collect_view()}
                    </div>
                </div>
            </div>
        </section>
    }
}

pub fn followees_tab_content(
    tab_id: String,
    target_pubkey: Option<String>,
    provider: Option<FolloweesProvider>,
) -> impl IntoView {
    let model = default_followees_view(&tab_id, target_pubkey.clone());
    view! {
        <FolloweesTab
            owner=tab_id
            target_pubkey=target_pubkey
            model=model
            provider=provider
        />
    }
}

fn followees_header(model: FolloweesView) -> impl IntoView {
    let label = if model.target_pubkey.is_some() {
        "Viewed profile"
    } else {
        "Unknown profile"
    };
    view! {
        <header class="profile-card" data-testid="rust-followees-header">
            <div class="profile-card__main">
                <div class="profile-card__identity">
                    <h2>"Following"</h2>
                    <p>{label}</p>
                    <small>{format!("{} entries", model.following_count)}</small>
                </div>
            </div>
        </header>
    }
}

fn followee_row(row: FolloweesRow) -> impl IntoView {
    let relay = row.relay.unwrap_or_else(|| "No relay hint".to_owned());
    let petname = row.petname.unwrap_or_else(|| "No petname".to_owned());
    view! {
        <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
            <strong>"Unknown"</strong>
            <p>{petname}</p>
            <small>{relay}</small>
        </article>
    }
}

fn diagnostic_row(row: FolloweesDiagnostic) -> impl IntoView {
    let relay = row.relay.unwrap_or_else(|| "selected relay".to_owned());
    let retry = if row.retry_available {
        "Retry available"
    } else {
        "Retry unavailable"
    };
    view! {
        <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
            <strong>{retry}</strong>
            <p>{row.message}</p>
            <small>{relay}</small>
        </article>
    }
}

fn retry_button(
    status: FolloweesStatus,
    provider: Option<FolloweesProvider>,
    owner: String,
    target_pubkey: Option<String>,
    model: RwSignal<FolloweesView>,
    active_lease: RwSignal<Option<FolloweesLease>>,
) -> AnyView {
    if !matches!(
        status,
        FolloweesStatus::PartialFailure | FolloweesStatus::Failed
    ) || provider.is_none()
    {
        return ().into_any();
    }
    let retry = move |_| {
        start_followees_read(
            provider.clone(),
            owner.clone(),
            target_pubkey.clone(),
            model,
            active_lease,
        );
    };
    view! {
        <button type="button" data-testid="followees-retry" on:click=retry>
            "Retry"
        </button>
    }
    .into_any()
}

fn start_followees_read(
    provider: Option<FolloweesProvider>,
    owner: String,
    target_pubkey: Option<String>,
    model: RwSignal<FolloweesView>,
    active_lease: RwSignal<Option<FolloweesLease>>,
) {
    release_active_followees(active_lease);
    let Some(provider) = provider else {
        return;
    };
    let lease = provider.read(
        owner,
        target_pubkey,
        Callback::new(move |next| model.set(next)),
    );
    active_lease.set(Some(lease));
}

fn release_active_followees(active_lease: RwSignal<Option<FolloweesLease>>) {
    if let Some(lease) = active_lease.get_untracked() {
        lease.release();
    }
    active_lease.set(None);
}

#[cfg(test)]
fn followees_status_text(status: FolloweesStatus) -> &'static str {
    lkjstr_app::followees_status_message(status)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn followees_status_text_names_explicit_states() {
        assert_eq!(
            followees_status_text(FolloweesStatus::MissingPubkey),
            "Followees target unavailable."
        );
        assert_eq!(
            followees_status_text(FolloweesStatus::Loading),
            "Loading following list..."
        );
    }
}
