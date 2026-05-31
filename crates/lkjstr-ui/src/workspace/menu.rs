use leptos::prelude::*;
use lkjstr_domain::new_tab_options_for_account;

use crate::app::RuntimeSignal;
use crate::workspace::state::{self, TabSequence};

#[component]
pub fn NewTabMenu(
    runtime: RuntimeSignal,
    sequence: TabSequence,
    pane_id: String,
    tab_id: Option<String>,
) -> impl IntoView {
    let options = new_tab_options_for_account(None);
    view! {
        <div class="lkjstr-new-tab-menu">
            {options.into_iter().map(|option| {
                let label = option.label;
                let description = option.description;
                let key = state::tab_kind_key(option.kind);
                let test_id = format!("new-tab-open-{key}");
                let option_for_click = option.clone();
                let pane_for_click = pane_id.clone();
                let tab_for_click = tab_id.clone();
                let open = move |_| {
                    if let Some(current_tab_id) = tab_for_click.clone() {
                        state::convert_option(
                            runtime,
                            pane_for_click.clone(),
                            current_tab_id,
                            option_for_click.clone(),
                            1,
                        );
                    } else {
                        state::open_option(
                            runtime,
                            sequence,
                            Some(pane_for_click.clone()),
                            option_for_click.clone(),
                            1,
                        );
                    }
                };
                view! {
                    <button
                        type="button"
                        data-testid=test_id
                        data-tab-kind=key
                        on:click=open
                    >
                        <span>{label}</span>
                        <small>{description}</small>
                    </button>
                }
            }).collect_view()}
        </div>
    }
}
