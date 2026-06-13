use leptos::prelude::*;
use lkjstr_app::{
    AuthorContextFeedStatus, AuthorContextFeedView, FeedFooterState, FeedViewRow,
    default_author_context_feed_view,
};

use crate::workspace::author_context_actions::AuthorContextActions;
use crate::workspace::author_context_event::event_row;
use crate::workspace::author_context_provider::AuthorContextFeedProvider;

#[component]
pub fn AuthorContextTab(
    owner: String,
    event_id: Option<String>,
    author_pubkey: Option<String>,
    model: AuthorContextFeedView,
    provider: Option<AuthorContextFeedProvider>,
    actions: AuthorContextActions,
) -> impl IntoView {
    let model = RwSignal::new(model);
    if let Some(provider) = provider {
        let lease = provider.read(
            owner,
            event_id,
            author_pubkey,
            Callback::new(move |next| model.set(next)),
        );
        on_cleanup(move || lease.release());
    }
    view! {
        <section class="lkjstr-author-context-feed" aria-label="Author Context">
            <p class="lkjstr-feed-status">{move || status_text(model.get().status)}</p>
            <div class="lkjstr-feed-rows">
                {move || {
                    let actions = actions.clone();
                    model
                        .get()
                        .view_model
                        .rows
                        .into_iter()
                        .map(move |row| context_row(row, actions.clone()))
                        .collect_view()
                }}
            </div>
        </section>
    }
}

pub fn author_context_tab_content(
    tab_id: String,
    event_id: Option<String>,
    author_pubkey: Option<String>,
    provider: Option<AuthorContextFeedProvider>,
    actions: AuthorContextActions,
) -> impl IntoView {
    let model = default_author_context_feed_view(&tab_id, event_id.clone(), author_pubkey.clone());
    view! {
        <AuthorContextTab
            owner=tab_id
            event_id=event_id
            author_pubkey=author_pubkey
            model=model
            provider=provider
            actions=actions
        />
    }
}

fn context_row(row: FeedViewRow, actions: AuthorContextActions) -> impl IntoView {
    match row {
        FeedViewRow::Event(row) => event_row(row, actions).into_any(),
        FeedViewRow::Unavailable(row) => view! {
            <article class="lkjstr-feed-row unavailable" data-row-id=row.row_id>
                <strong>{row.reason}</strong>
                <p>{row.detail}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Diagnostic(row) => view! {
            <article class="lkjstr-feed-row diagnostic" data-row-id=row.row_id>
                <strong>{format!("{:?}", row.severity)}</strong>
                <p>{row.message}</p>
            </article>
        }
        .into_any(),
        FeedViewRow::Footer(row) => view! {
            <footer class="lkjstr-feed-footer" data-row-id=row.row_id>
                {footer_state_text(row.state)}
            </footer>
        }
        .into_any(),
        FeedViewRow::Continuation(row) => view! {
            <article class="lkjstr-feed-row continuation" data-row-id=row.row_id>
                <strong>{format!("Continue thread ({})", row.hidden_count)}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Profile(row) => view! {
            <article class="lkjstr-feed-row profile" data-row-id=row.row_id>
                <strong>{row.display_name}</strong>
            </article>
        }
        .into_any(),
        FeedViewRow::Notification(row) => view! {
            <article class="lkjstr-feed-row notification" data-row-id=row.row_id>
                <strong>{row.notification_kind}</strong>
            </article>
        }
        .into_any(),
    }
}

fn status_text(status: AuthorContextFeedStatus) -> &'static str {
    match status {
        AuthorContextFeedStatus::MissingEvent => "Author Context event unavailable.",
        AuthorContextFeedStatus::MissingAuthor => "Author Context author unavailable.",
        AuthorContextFeedStatus::NoEnabledRelay => "Author Context needs a relay.",
        AuthorContextFeedStatus::Ready => "Author Context ready.",
        AuthorContextFeedStatus::Partial => "Author Context partial.",
    }
}

fn footer_state_text(state: FeedFooterState) -> &'static str {
    match state {
        FeedFooterState::Loading => "Loading",
        FeedFooterState::CacheHit => "Cached rows",
        FeedFooterState::ReadingRelays => "Reading relays",
        FeedFooterState::Partial => "Partial",
        FeedFooterState::AuthRequired => "Auth required",
        FeedFooterState::RetryableFailure => "Retry available",
        FeedFooterState::ConfigurationUnavailable => "Configuration unavailable",
        FeedFooterState::TerminalEmpty => "No rows",
        FeedFooterState::TerminalWithRows => "Rows loaded",
        FeedFooterState::OlderLoadReady => "Older rows available",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_text_names_explicit_states() {
        assert_eq!(
            status_text(AuthorContextFeedStatus::MissingEvent),
            "Author Context event unavailable."
        );
        assert_eq!(
            status_text(AuthorContextFeedStatus::Ready),
            "Author Context ready."
        );
    }
}
