use leptos::prelude::*;
use lkjstr_domain::PaneNode;

use crate::app::RuntimeSignal;
use crate::workspace::state::{self, TabSequence};
use crate::workspace::tab_body::TabBody;

#[component]
pub fn PaneView(runtime: RuntimeSignal, sequence: TabSequence, pane: PaneNode) -> impl IntoView {
    let pane_id = pane.id.clone();
    let pane_attr = pane.id.clone();
    let tabs_pane_id = pane.id.clone();
    let body_pane_id = pane.id;
    let title = move || state::active_title(runtime, &pane_id);

    view! {
        <article class="lkjstr-pane" data-pane-id=pane_attr>
            <div class="lkjstr-pane-head">
                <span class="lkjstr-pane-title">{title}</span>
                <button type="button" aria-label="Pane menu">"..."</button>
            </div>
            <nav class="lkjstr-tab-strip" aria-label="Tabs">
                {move || {
                    let pane_id = tabs_pane_id.clone();
                    state::pane_tabs(runtime, &pane_id).into_iter().map(move |tab| {
                        let selected_tab_id = tab.id.clone();
                        let focus_tab_id = tab.id.clone();
                        let focus_pane_id = pane_id.clone();
                        let selected = move || state::is_focused(runtime, &selected_tab_id);
                        let focus = move |_| {
                            state::focus(runtime, focus_pane_id.clone(), focus_tab_id.clone(), 1);
                        };
                        view! {
                            <button type="button" class:active=selected on:click=focus>
                                {tab.title}
                            </button>
                        }
                    }).collect_view()
                }}
            </nav>
            <section class="lkjstr-pane-body">
                {move || {
                    let pane_id = body_pane_id.clone();
                    state::active_tab(runtime, &pane_id).into_iter().map(move |tab| {
                        view! {
                            <TabBody
                                runtime=runtime
                                sequence=sequence
                                pane_id=pane_id.clone()
                                tab=tab
                            />
                        }
                    }).collect_view()
                }}
            </section>
        </article>
    }
}
