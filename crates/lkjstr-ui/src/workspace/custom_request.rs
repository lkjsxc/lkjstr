use leptos::prelude::*;
use lkjstr_app::{CustomRequestMode, CustomRequestRunPlan, CustomRequestRunStatus};

use crate::workspace::custom_request_provider::{CustomRequestLease, CustomRequestProvider};
use crate::workspace::custom_request_snapshot::CustomRequestSnapshotHandle;

const DEFAULT_INPUT: &str = r#"{"kinds":[1],"limit":30}"#;
const PROVIDER_GAP: &str = "Rust Custom Request provider execution is not wired yet.";

#[component]
pub fn CustomRequestTab(
    owner: String,
    provider: Option<CustomRequestProvider>,
    snapshot: CustomRequestSnapshotHandle,
) -> impl IntoView {
    let input = RwSignal::new(snapshot.restored_input(DEFAULT_INPUT));
    let ran = RwSignal::new(snapshot.restored_ran());
    let pending = RwSignal::new(false);
    let provider_gap = RwSignal::new(false);
    let plan = RwSignal::new(None::<CustomRequestRunPlan>);
    let active_lease = RwSignal::new(None::<CustomRequestLease>);
    let input_snapshot = snapshot.clone();
    let input_change = move |event| {
        let value = event_target_value(&event);
        input.set(value.clone());
        input_snapshot.save(value, ran.get_untracked());
    };
    let submit_provider = provider.clone();
    let submit_owner = owner.clone();
    let submit_snapshot = snapshot.clone();
    let submit = move |event: leptos::ev::SubmitEvent| {
        event.prevent_default();
        release_current(active_lease);
        let raw = input.get_untracked();
        ran.set(true);
        submit_snapshot.save(raw.clone(), true);
        plan.set(None);
        provider_gap.set(false);
        pending.set(false);
        let Some(provider) = submit_provider.clone() else {
            provider_gap.set(true);
            return;
        };
        pending.set(true);
        let lease = provider.run(
            submit_owner.clone(),
            raw,
            Callback::new(move |next| {
                pending.set(false);
                plan.set(Some(next));
            }),
        );
        active_lease.set(Some(lease));
    };
    on_cleanup(move || release_current(active_lease));

    view! {
        <section class="lkjstr-custom-request" aria-label="Custom Request">
            <form class="lkjstr-custom-request-controls" on:submit=submit>
                <textarea
                    aria-label="Custom request JSON"
                    prop:value=move || input.get()
                    on:input=input_change
                ></textarea>
                <button type="submit" prop:disabled=move || {
                    pending.get() || input.get().trim().is_empty()
                }>
                    "Run"
                </button>
            </form>
            <p class="lkjstr-feed-status" role=move || alert_role(plan.get())>
                {move || status_text(pending.get(), provider_gap.get(), ran.get(), plan.get())}
            </p>
        </section>
    }
}

fn release_current(active_lease: RwSignal<Option<CustomRequestLease>>) {
    if let Some(lease) = active_lease.get_untracked() {
        lease.release();
    }
    active_lease.set(None);
}

fn alert_role(plan: Option<CustomRequestRunPlan>) -> &'static str {
    match plan.map(|plan| plan.status) {
        Some(CustomRequestRunStatus::Invalid | CustomRequestRunStatus::NoRelay) => "alert",
        _ => "status",
    }
}

fn status_text(
    pending: bool,
    provider_gap: bool,
    ran: bool,
    plan: Option<CustomRequestRunPlan>,
) -> String {
    if pending {
        return "Planning Custom Request".to_owned();
    }
    if provider_gap {
        return PROVIDER_GAP.to_owned();
    }
    let Some(plan) = plan else {
        return if ran {
            "Run the restored request again.".to_owned()
        } else {
            "Enter request JSON.".to_owned()
        };
    };
    match plan.status {
        CustomRequestRunStatus::Ready => ready_text(&plan),
        CustomRequestRunStatus::Invalid => invalid_text(&plan),
        CustomRequestRunStatus::NoRelay => {
            "No enabled relay is available for this request.".to_owned()
        }
    }
}

fn ready_text(plan: &CustomRequestRunPlan) -> String {
    format!(
        "Ready for relay read: {} relay target{}, {} mode.",
        plan.relays.len(),
        if plan.relays.len() == 1 { "" } else { "s" },
        mode_text(plan.mode)
    )
}

fn invalid_text(plan: &CustomRequestRunPlan) -> String {
    match &plan.error {
        Some(error) => format!("Invalid request: {:?}.", error.kind),
        None => "Invalid request.".to_owned(),
    }
}

fn mode_text(mode: Option<CustomRequestMode>) -> &'static str {
    match mode {
        Some(CustomRequestMode::Exact) => "exact",
        Some(CustomRequestMode::AdaptiveFeed) => "adaptive-feed",
        None => "unknown",
    }
}
