use leptos::prelude::*;
use lkjstr_app::{
    CustomRequestFeedStatus, CustomRequestFeedView, canceled_custom_request_feed_view,
    default_custom_request_feed_view, planning_custom_request_feed_view,
    unavailable_custom_request_feed_view,
};

use crate::workspace::custom_request_provider::CustomRequestProvider;
use crate::workspace::custom_request_render::{custom_request_row, custom_request_status_text};
use crate::workspace::custom_request_run::CustomRequestRunController;
use crate::workspace::custom_request_snapshot::CustomRequestSnapshotHandle;
use crate::workspace::feed_event_actions::FeedEventActions;

const DEFAULT_INPUT: &str = r#"{"kinds":[1],"limit":30}"#;
const PROVIDER_UNAVAILABLE: &str = "Custom Request provider is unavailable.";

#[component]
pub fn CustomRequestTab(
    owner: String,
    provider: Option<CustomRequestProvider>,
    snapshot: CustomRequestSnapshotHandle,
    #[prop(optional)] actions: FeedEventActions,
) -> impl IntoView {
    let input = RwSignal::new(snapshot.restored_input(DEFAULT_INPUT));
    let ran = RwSignal::new(snapshot.restored_ran());
    let model = RwSignal::new(default_custom_request_feed_view(&owner));
    let run_controller = CustomRequestRunController::new();
    let input_snapshot = snapshot.clone();
    let input_change = move |event| {
        let value = event_target_value(&event);
        input.set(value.clone());
        input_snapshot.save(value, ran.get_untracked());
    };
    let submit_provider = provider.clone();
    let submit_owner = owner.clone();
    let submit_snapshot = snapshot.clone();
    let submit_controller = run_controller.clone();
    let submit = move |event: leptos::ev::SubmitEvent| {
        event.prevent_default();
        let raw = input.get_untracked();
        ran.set(true);
        submit_snapshot.save(raw.clone(), true);
        model.set(planning_custom_request_feed_view(&submit_owner));
        let started = submit_controller.run(
            submit_provider.clone(),
            submit_owner.clone(),
            raw,
            Callback::new(move |next| {
                model.set(next);
            }),
        );
        if !started {
            model.set(unavailable_custom_request_feed_view(
                &submit_owner,
                PROVIDER_UNAVAILABLE,
                false,
            ));
        }
    };
    let cancel_owner = owner.clone();
    let cancel_controller = run_controller.clone();
    let cancel = move |_| {
        if !can_cancel(&model.get_untracked()) {
            return;
        }
        cancel_controller.release();
        model.set(canceled_custom_request_feed_view(&cancel_owner));
    };
    on_cleanup(move || run_controller.release());

    view! {
        <section class="feed-tab lkjstr-custom-request" aria-label="Custom Request">
            <div class="tab-scroll-track event-list__scroller">
                <div class="tab-scroll-owner custom-request-list-scroll" data-scroll-owner="">
                    <form class="lkjstr-custom-request-controls" on:submit=submit>
                        <textarea
                            aria-label="Custom request JSON"
                            prop:value=move || input.get()
                            on:input=input_change
                        ></textarea>
                        <button type="submit" prop:disabled=move || {
                            can_cancel(&model.get()) || input.get().trim().is_empty()
                        }>
                            "Run"
                        </button>
                        <button
                            type="button"
                            prop:hidden=move || !can_cancel(&model.get())
                            on:click=cancel
                        >
                            "Cancel"
                        </button>
                    </form>
                    <p class="lkjstr-feed-status" role=move || alert_role(model.get().status)>
                        {move || custom_request_status_text(&model.get(), ran.get())}
                    </p>
                    <div class="lkjstr-feed-rows">
                        {move || {
                            let actions = actions.clone();
                            model
                                .get()
                                .view_model
                                .rows
                                .into_iter()
                                .map(move |row| custom_request_row(row, actions.clone()))
                                .collect_view()
                        }}
                    </div>
                </div>
            </div>
        </section>
    }
}

fn alert_role(status: CustomRequestFeedStatus) -> &'static str {
    match status {
        CustomRequestFeedStatus::Invalid
        | CustomRequestFeedStatus::NoRelay
        | CustomRequestFeedStatus::Unavailable => "alert",
        _ => "status",
    }
}

fn can_cancel(model: &CustomRequestFeedView) -> bool {
    model.status == CustomRequestFeedStatus::Planning
        || (model.status == CustomRequestFeedStatus::Ready
            && !model.window.terminal
            && !model.relays.is_empty())
}

#[cfg(test)]
#[path = "custom_request_tests.rs"]
mod custom_request_tests;
