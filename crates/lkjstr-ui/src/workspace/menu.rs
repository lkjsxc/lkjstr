use leptos::prelude::*;
use lkjstr_domain::{NewTabOption, new_tab_options_for_account};

use crate::app::RuntimeSignal;
use crate::workspace::persistence::WorkspacePersistence;
use crate::workspace::state::{self, TabSequence};

#[component]
pub fn NewTabMenu(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: Option<String>,
    #[prop(default = None)] active_account_pubkey: Option<String>,
    persistence: Option<WorkspacePersistence>,
) -> impl IntoView {
    let base_options = new_tab_options_for_account(active_account_pubkey.as_deref());
    let action = MenuActionInput {
        runtime,
        sequence,
        pane_id,
        tab_id,
        persistence,
    };

    view! {
        <div class="lkjstr-new-tab-menu form-tab new-tab">
            <div class="option-grid lkjstr-new-tab-options" aria-label="New Tab options">
                {base_options.into_iter().map(|option| option_button(option, action.clone()))
                    .collect_view()}
            </div>
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

fn option_button(option: NewTabOption, action: MenuActionInput) -> impl IntoView {
    let label = option.label;
    let description = option.description;
    let key = state::tab_kind_key(option.kind);
    let test_id = format!("new-tab-option-{key}");
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
        <button type="button" class="option-card" data-testid=test_id data-tab-kind=key on:click=open>
            <strong>{label}</strong>
            <span>{description}</span>
        </button>
    }
}
