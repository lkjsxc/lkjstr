//! Recursive tiling renderer. Nodes are keyed by id, so tab bodies survive
//! unrelated layout edits; resizing only touches flex sizes.

use leptos::prelude::*;
use lkjstr_core::layout::{Dir, Node, NodeId};

use super::{Ui, drag, pane::PaneView};

fn find(root: &Node, id: NodeId) -> Option<&Node> {
    if root.id() == id {
        return Some(root);
    }
    match root {
        Node::Pane(_) => None,
        Node::Split(split) => split.children.iter().find_map(|child| find(child, id)),
    }
}

#[component]
pub fn Desk() -> impl IntoView {
    let ui = Ui::get();
    let root = Memo::new(move |_| ui.ws.with(|ws| ws.root.id()));
    view! { <div class="tiles">{move || render(root.get())}</div> }
}

fn render(id: NodeId) -> AnyView {
    let ui = Ui::get();
    let is_pane = ui
        .ws
        .with_untracked(|ws| matches!(find(&ws.root, id), Some(Node::Pane(_))));
    if is_pane {
        view! { <PaneView id=id/> }.into_any()
    } else {
        view! { <SplitView id=id/> }.into_any()
    }
}

#[component]
fn SplitView(id: NodeId) -> impl IntoView {
    let ui = Ui::get();
    let shape = Memo::new(move |_| {
        ui.ws.with(|ws| match find(&ws.root, id) {
            Some(Node::Split(split)) => (
                split.dir,
                split.children.iter().map(Node::id).collect::<Vec<_>>(),
                split.sizes.clone(),
            ),
            _ => (Dir::Row, Vec::new(), Vec::new()),
        })
    });
    let dir = Memo::new(move |_| shape.with(|s| s.0));
    let children = Memo::new(move |_| shape.with(|s| s.1.clone()));
    view! {
        <div class="split" class:row=move || dir.get() == Dir::Row class:col=move || dir.get() == Dir::Col>
            <For each=move || children.get() key=|child| *child let:child>
                {
                    let index = Memo::new(move |_| {
                        children.with(|list| list.iter().position(|c| *c == child).unwrap_or(0))
                    });
                    let grow = move || {
                        let size = shape.with(|s| s.2.get(index.get()).copied().unwrap_or(1.0));
                        format!("flex: {size} 1 0px")
                    };
                    let label = move || {
                        if dir.get() == Dir::Row { "Resize columns" } else { "Resize rows" }
                    };
                    view! {
                        <div class="cell" style=grow>
                            <Show when=move || { index.get() > 0 }>
                                <div
                                    class="handle"
                                    role="separator"
                                    aria-label=label
                                    on:pointerdown=move |ev| drag::start_resize(ev, ui, id, dir.get_untracked())
                                ></div>
                            </Show>
                            {render(child)}
                        </div>
                    }
                }
            </For>
        </div>
    }
}
