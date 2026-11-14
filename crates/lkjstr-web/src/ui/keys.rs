//! Keyboard-first control. Workspace chords use Alt (matched by physical key
//! so layouts and macOS Option characters do not matter); reading keys are
//! single letters outside text fields. `SHORTCUTS` feeds the help overlay.

use leptos::prelude::*;
use lkjstr_core::layout::Zone;
use lkjstr_core::{Command, Open, View};
use wasm_bindgen::JsCast;
use web_sys::{HtmlElement, KeyboardEvent};

use super::Ui;
use crate::host::{after, focus_selector};

pub const SHORTCUTS: [(&str, &str); 16] = [
    (
        "Alt + H J K L / arrows",
        "Focus the tile left, below, above, right",
    ),
    (
        "Alt + Shift + H J K L",
        "Move the tab to that tile (splits at the edge)",
    ),
    ("Alt + \\  /  Alt + -", "Split right / split down"),
    ("Alt + T  /  Alt + W", "New tab / close tab"),
    ("Alt + [  /  Alt + ]", "Previous / next tab in the tile"),
    ("Alt + 1 … 9", "Go to tab by position"),
    ("Alt + .  /  Alt + ,", "Widen / narrow the tile"),
    ("j  /  k", "Next / previous note"),
    ("Enter  or  o", "Open the note's thread beside"),
    ("p", "Open the author's profile beside"),
    ("r", "Reply to the focused note"),
    ("l", "Like the focused note"),
    ("n", "Compose a note"),
    ("/", "Search"),
    ("?", "Show or hide this help"),
    ("Esc", "Close menus and help"),
];

fn typing(ev: &KeyboardEvent) -> bool {
    ev.target()
        .and_then(|t| t.dyn_into::<HtmlElement>().ok())
        .is_some_and(|el| {
            let tag = el.tag_name();
            tag == "INPUT" || tag == "TEXTAREA" || tag == "SELECT" || el.is_content_editable()
        })
}

fn chord(code: &str, shift: bool) -> Option<Command> {
    let direction = match code {
        "KeyH" | "ArrowLeft" => Some(Zone::Left),
        "KeyL" | "ArrowRight" => Some(Zone::Right),
        "KeyK" | "ArrowUp" => Some(Zone::Top),
        "KeyJ" | "ArrowDown" => Some(Zone::Bottom),
        _ => None,
    };
    if let Some(zone) = direction {
        return Some(if shift {
            Command::MoveTab(zone)
        } else {
            Command::Focus(zone)
        });
    }
    Some(match code {
        "Backslash" => Command::Split(Zone::Right),
        "Minus" => Command::Split(Zone::Bottom),
        "KeyT" => Command::NewTab,
        "KeyW" => Command::CloseTab,
        "BracketLeft" => Command::Cycle(-1),
        "BracketRight" => Command::Cycle(1),
        "Period" => Command::Grow(1),
        "Comma" => Command::Grow(-1),
        digit if digit.starts_with("Digit") => {
            let n: usize = digit[5..].parse().ok()?;
            Command::Select(n.checked_sub(1)?)
        }
        _ => return None,
    })
}

pub fn handle(ui: Ui, ev: &KeyboardEvent) {
    if ev.alt_key() && !ev.ctrl_key() && !ev.meta_key() {
        if let Some(command) = chord(&ev.code(), ev.shift_key()) {
            ev.prevent_default();
            ui.ws.update(|ws| ws.apply(command));
            after(0, || focus_selector(".pane.focused .tab.active"));
        }
        return;
    }
    if ev.key() == "Escape" {
        ui.help.set(false);
        return;
    }
    if typing(ev) || ev.ctrl_key() || ev.meta_key() || ev.alt_key() {
        return;
    }
    match ev.key().as_str() {
        "?" => ui.help.update(|h| *h = !*h),
        "j" => step_note(1),
        "k" => step_note(-1),
        "n" => {
            ui.open(View::Compose { reply_to: None }, Open::Beside);
            after(30, || focus_selector(".pane.focused .body.shown textarea"));
        }
        "/" => {
            ev.prevent_default();
            ui.open(
                View::Search {
                    query: String::new(),
                },
                Open::Beside,
            );
            after(30, || {
                focus_selector(".pane.focused .body.shown input[type=search]")
            });
        }
        _ => (),
    }
}

/// Moves keyboard focus between notes of the focused tile.
fn step_note(delta: i32) {
    let Some(document) = web_sys::window().and_then(|w| w.document()) else {
        return;
    };
    let Ok(list) = document.query_selector_all(".pane.focused .body.shown .note") else {
        return;
    };
    let notes: Vec<HtmlElement> = (0..list.length())
        .filter_map(|i| list.item(i)?.dyn_into::<HtmlElement>().ok())
        .collect();
    let current = document.active_element();
    let at = notes
        .iter()
        .position(|n| current.as_ref().is_some_and(|c| n.is_same_node(Some(c))));
    let next = match at {
        Some(at) => (at as i32 + delta).clamp(0, notes.len() as i32 - 1) as usize,
        None => 0,
    };
    if let Some(note) = notes.get(next) {
        let _ = note.focus();
    }
}

#[component]
pub fn Help() -> impl IntoView {
    let ui = Ui::get();
    view! {
        <div class="overlay" on:click=move |_| ui.help.set(false)>
            <div class="sheet" role="dialog" aria-label="Keyboard shortcuts" on:click=|ev| ev.stop_propagation()>
                <h2>"Keyboard shortcuts"</h2>
                <table class="keys">
                    {SHORTCUTS
                        .iter()
                        .map(|(keys, what)| view! { <tr><td><kbd>{*keys}</kbd></td><td>{*what}</td></tr> })
                        .collect_view()}
                </table>
                <p class="muted">"Drag a tab onto a tile's edge to split, onto its body to stack, or along a tab strip to reorder. Drag the gaps between tiles to resize."</p>
                <button on:click=move |_| ui.help.set(false)>"Close"</button>
            </div>
        </div>
    }
}
