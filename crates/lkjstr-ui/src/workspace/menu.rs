use leptos::prelude::*;
use lkjstr_domain::{
    NewTabOption, NewTabOptionGroup, filter_new_tab_options, new_tab_options_for_account,
};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};

#[component]
pub fn NewTabMenu(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: Option<String>,
    active_account_pubkey: Option<String>,
    persistence: Option<WorkspacePersistence>,
) -> impl IntoView {
    let query = RwSignal::new(String::new());
    let active_pubkey = active_account_pubkey;
    let base_options = new_tab_options_for_account(active_pubkey.as_deref());
    let action = MenuActionInput {
        runtime,
        sequence,
        pane_id,
        tab_id,
        persistence,
    };
    let input = move |event| query.set(event_target_value(&event));
    let clear = move |_| query.set(String::new());
    let clear_on_escape = move |event: leptos::ev::KeyboardEvent| {
        if event.key() == "Escape" {
            query.set(String::new());
        }
    };
    let filtered_options = Memo::new(move |_| filter_new_tab_options(&base_options, &query.get()));
    let primary_action = action.clone();
    let secondary_action = action;

    view! {
        <div class="lkjstr-new-tab-menu">
            <label for="lkjstr-new-tab-filter">"Filter New Tab choices"</label>
            <div class="lkjstr-new-tab-filter">
                <input
                    id="lkjstr-new-tab-filter"
                    data-testid="new-tab-filter"
                    type="search"
                    aria-label="Filter New Tab choices"
                    prop:value=move || query.get()
                    on:input=input
                    on:keydown=clear_on_escape
                />
                <Show when=move || !query.get().trim().is_empty()>
                    <button type="button" on:click=clear>"Clear"</button>
                </Show>
            </div>
            <p role="status">{move || result_count(filtered_options.get().len())}</p>
            {move || option_group(
                "Primary",
                NewTabOptionGroup::Primary,
                filtered_options.get(),
                primary_action.clone(),
            )}
            {move || option_group(
                "Secondary",
                NewTabOptionGroup::Secondary,
                filtered_options.get(),
                secondary_action.clone(),
            )}
            <Show when=move || filtered_options.get().is_empty()>
                <p role="status">"No New Tab choices match this filter."</p>
            </Show>
        </div>
    }
}

#[derive(Clone)]
struct MenuActionInput {
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: Option<String>,
    persistence: Option<WorkspacePersistence>,
}

fn option_group(
    title: &'static str,
    group: NewTabOptionGroup,
    options: Vec<NewTabOption>,
    action: MenuActionInput,
) -> AnyView {
    let group_options = options
        .into_iter()
        .filter(|option| option.group == group)
        .collect::<Vec<_>>();
    if group_options.is_empty() {
        return ().into_any();
    }
    view! {
        <section class="lkjstr-new-tab-option-group">
            <h2>{title}</h2>
            <div class="lkjstr-new-tab-options" aria-label=format!("{title} options")>
                {group_options.into_iter().map(|option| option_button(option, action.clone()))
                    .collect_view()}
            </div>
        </section>
    }
    .into_any()
}

fn option_button(option: NewTabOption, action: MenuActionInput) -> impl IntoView {
    let label = option.label;
    let description = option.description;
    let key = state::tab_kind_key(option.kind);
    let test_id = format!("new-tab-open-{key}");
    let open = move |_| {
        if let Some(current_tab_id) = action.tab_id.clone() {
            state::convert_option(
                action.runtime,
                action.pane_id.clone(),
                current_tab_id,
                option.clone(),
                action.persistence.clone(),
                1,
            );
        } else {
            state::open_option(
                action.runtime,
                action.sequence,
                Some(action.pane_id.clone()),
                option.clone(),
                action.persistence.clone(),
                1,
            );
        }
    };
    view! {
        <button type="button" data-testid=test_id data-tab-kind=key on:click=open>
            <span>{label}</span>
            <small>{description}</small>
        </button>
    }
}

fn result_count(count: usize) -> String {
    if count == 1 {
        "1 choice".to_owned()
    } else {
        format!("{count} choices")
    }
}
