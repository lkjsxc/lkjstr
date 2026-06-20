use leptos::prelude::*;
use lkjstr_app::{FolloweesStatus, FolloweesView, default_followees_view};

#[path = "followees_read.rs"]
mod followees_read;

use self::followees_read::FolloweesReadController;
use crate::workspace::followees_actions::FolloweesActions;
use crate::workspace::followees_header::followees_header;
use crate::workspace::followees_provider::FolloweesProvider;
use crate::workspace::followees_row::{diagnostic_row, followee_row};

#[component]
pub fn FolloweesTab(
    owner: String,
    target_pubkey: Option<String>,
    model: FolloweesView,
    provider: Option<FolloweesProvider>,
    actions: FolloweesActions,
    copy_status: Option<RwSignal<Option<String>>>,
) -> impl IntoView {
    let model = RwSignal::new(model);
    let read_controller = FolloweesReadController::new();
    read_controller.read(
        provider.clone(),
        owner.clone(),
        target_pubkey.clone(),
        Callback::new(move |next| model.set(next)),
    );
    let cleanup_controller = read_controller.clone();
    on_cleanup(move || cleanup_controller.release());
    view! {
        <section class="followees-tab feed-tab" aria-label="Following">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner event-list__viewport" data-scroll-owner="">
                    {move || followees_header(model.get())}
                    <p class="lkjstr-feed-status">{move || model.get().message}</p>
                    {copy_status_line(copy_status)}
                    {move || retry_button(
                        model.get().status,
                        provider.clone(),
                        owner.clone(),
                        target_pubkey.clone(),
                        model,
                        read_controller.clone(),
                    )}
                    <div class="lkjstr-feed-rows">
                        {move || model.get().diagnostics.into_iter().map(diagnostic_row).collect_view()}
                        {move || {
                            let actions = actions.clone();
                            model
                                .get()
                                .rows
                                .into_iter()
                                .map(move |row| followee_row(row, actions.clone()))
                                .collect_view()
                        }}
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
    actions: FolloweesActions,
    copy_status: Option<RwSignal<Option<String>>>,
) -> impl IntoView {
    let model = default_followees_view(&tab_id, target_pubkey.clone());
    view! {
        <FolloweesTab
            owner=tab_id
            target_pubkey=target_pubkey
            model=model
            provider=provider
            actions=actions
            copy_status=copy_status
        />
    }
}

fn copy_status_line(status: Option<RwSignal<Option<String>>>) -> AnyView {
    let Some(status) = status else {
        return ().into_any();
    };
    view! {
        {move || status.get().map(|text| view! {
            <p class="lkjstr-feed-status" role="status">{text}</p>
        })}
    }
    .into_any()
}

fn retry_button(
    status: FolloweesStatus,
    provider: Option<FolloweesProvider>,
    owner: String,
    target_pubkey: Option<String>,
    model: RwSignal<FolloweesView>,
    read_controller: FolloweesReadController,
) -> AnyView {
    if !matches!(
        status,
        FolloweesStatus::PartialFailure | FolloweesStatus::Failed
    ) || provider.is_none()
    {
        return ().into_any();
    }
    let retry = move |_| {
        read_controller.read(
            provider.clone(),
            owner.clone(),
            target_pubkey.clone(),
            Callback::new(move |next| model.set(next)),
        );
    };
    view! {
        <button type="button" data-testid="followees-retry" on:click=retry>
            "Retry"
        </button>
    }
    .into_any()
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
