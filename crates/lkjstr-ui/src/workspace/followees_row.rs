use leptos::{
    ev::{KeyboardEvent, MouseEvent},
    prelude::*,
};
use lkjstr_app::{FolloweesDiagnostic, FolloweesRow};

use crate::workspace::followees_actions::FolloweesActions;

pub(crate) fn followee_row(row: FolloweesRow, actions: FolloweesActions) -> impl IntoView {
    let pubkey = row.pubkey.clone();
    let label = row
        .petname
        .as_deref()
        .filter(|item| !item.trim().is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| compact_pubkey(&pubkey));
    let petname = row
        .petname
        .filter(|item| !item.trim().is_empty())
        .unwrap_or_else(|| "No petname".to_owned());
    let relay = row.relay.unwrap_or_else(|| "No relay hint".to_owned());
    let row_click = row_profile_click(pubkey.clone(), actions.open_profile);
    let row_key = row_profile_keydown(pubkey.clone(), actions.open_profile);
    view! {
        <article
            class="lkjstr-feed-row profile"
            data-row-id=row.row_id
            data-testid="followees-open-profile"
            role="button"
            tabindex="0"
            on:click=row_click
            on:keydown=row_key
        >
            <strong>{label}</strong>
            <p>{petname}</p>
            <small>{relay}</small>
            {followee_actions(pubkey, actions)}
        </article>
    }
}

pub(crate) fn diagnostic_row(row: FolloweesDiagnostic) -> impl IntoView {
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

fn followee_actions(pubkey: String, actions: FolloweesActions) -> impl IntoView {
    if !followee_overflow_available(&actions) {
        return ().into_any();
    }
    let stop_details_click = |event: MouseEvent| event.stop_propagation();
    let stop_summary_click = |event: MouseEvent| event.stop_propagation();
    view! {
        <details class="lkjstr-feed-actions event-action-zone" on:click=stop_details_click>
            <summary
                aria-label="Followee actions"
                title="Followee actions"
                on:click=stop_summary_click
            >
                "..."
            </summary>
            <div class="lkjstr-feed-actions__items">
                {action_button(
                    pubkey.clone(),
                    actions.open_user_timeline,
                    "followees-open-user-timeline",
                    "Timeline",
                )}
                {action_button(pubkey, actions.copy_npub, "followees-copy-npub", "Copy npub")}
            </div>
        </details>
    }
    .into_any()
}

fn action_button(
    pubkey: String,
    action: Option<Callback<String>>,
    test_id: &'static str,
    label: &'static str,
) -> impl IntoView {
    action.map(|action| {
        let run = move |event: MouseEvent| {
            event.stop_propagation();
            action.run(pubkey.clone());
        };
        view! {
            <button type="button" data-testid=test_id on:click=run>
                {label}
            </button>
        }
    })
}

fn row_profile_click(
    pubkey: String,
    action: Option<Callback<String>>,
) -> impl Fn(MouseEvent) + 'static {
    move |_event| {
        if let Some(action) = action {
            action.run(pubkey.clone());
        }
    }
}

fn row_profile_keydown(
    pubkey: String,
    action: Option<Callback<String>>,
) -> impl Fn(KeyboardEvent) + 'static {
    move |event| {
        if event.key() != "Enter" {
            return;
        }
        if let Some(action) = action {
            action.run(pubkey.clone());
        }
    }
}

fn followee_overflow_available(actions: &FolloweesActions) -> bool {
    actions.open_user_timeline.is_some() || actions.copy_npub.is_some()
}

fn compact_pubkey(pubkey: &str) -> String {
    let chars = pubkey.chars().collect::<Vec<_>>();
    if chars.len() <= 16 {
        return pubkey.to_owned();
    }
    let prefix = chars.iter().take(8).collect::<String>();
    let suffix = chars
        .iter()
        .skip(chars.len().saturating_sub(8))
        .collect::<String>();
    format!("{prefix}...{suffix}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compact_pubkey_keeps_both_ends() {
        assert_eq!(compact_pubkey(&"a".repeat(64)), "aaaaaaaa...aaaaaaaa");
    }

    #[test]
    fn followee_overflow_excludes_primary_profile_action() {
        let actions = FolloweesActions {
            open_profile: Some(Callback::new(|_: String| {})),
            open_user_timeline: None,
            copy_npub: None,
        };

        assert!(!followee_overflow_available(&actions));
    }

    #[test]
    fn followee_overflow_keeps_secondary_actions() {
        let actions = FolloweesActions {
            open_profile: None,
            open_user_timeline: Some(Callback::new(|_: String| {})),
            copy_npub: Some(Callback::new(|_: String| {})),
        };

        assert!(followee_overflow_available(&actions));
    }
}
