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

pub const SHORTCUTS: [(&str, &str); 20] = [
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
    ("Alt + Left / Right", "Back / forward in this tab"),
    ("Ctrl/Cmd + Shift + T", "Reopen the closed tab or tile"),
    ("Alt + Z", "Undo the layout change"),
    ("Ctrl/Cmd + K", "Search or open a view"),
];

pub(super) fn typing(ev: &KeyboardEvent) -> bool {
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
    if (ev.ctrl_key() || ev.meta_key()) && ev.shift_key() && ev.code() == "KeyT" {
        ev.prevent_default();
        ui.recover(true);
        return;
    }
    if ev.alt_key()
        && !ev.shift_key()
        && ["ArrowLeft", "ArrowRight", "KeyZ"].contains(&ev.code().as_str())
    {
        ev.prevent_default();
        if ev.code() == "KeyZ" {
            ui.recover(false);
        } else {
            ui.ws.update(|ws| {
                ws.travel(if ev.code() == "ArrowLeft" { -1 } else { 1 });
            });
        }
        return;
    }
    if (ev.ctrl_key() || ev.meta_key()) && ev.code() == "KeyK" {
        ev.prevent_default();
        ui.palette.update(|p| *p = !*p);
        return;
    }
    if ev.alt_key() && ev.code() == "Enter" {
        ev.prevent_default();
        let pane = ui.ws.with_untracked(|ws| ws.focus);
        ui.zoom
            .update(|z| *z = if *z == Some(pane) { None } else { Some(pane) });
        return;
    }
    if ev.alt_key() && ev.shift_key() && ev.code().starts_with("Digit") {
        if let Ok(index) = ev.code()[5..].parse::<usize>()
            && (1..=9).contains(&index)
        {
            ev.prevent_default();
            if ev.ctrl_key() || ev.meta_key() {
                if let Some(tab) = ui.ws.with_untracked(|ws| ws.focused_tab()) {
                    super::spaces::move_tab(ui, tab, index - 1);
                }
            } else {
                super::spaces::select(ui, index - 1);
            }
        }
        return;
    }
    if ev.alt_key() && !ev.ctrl_key() && !ev.meta_key() {
        if let Some(command) = chord(&ev.code(), ev.shift_key()) {
            ev.prevent_default();
            ui.command(command);
            after(0, || focus_selector(".pane.focused .tab.active"));
        }
        return;
    }
    if ev.key() == "Escape" {
        ui.help.set(false);
        ui.palette.set(false);
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
        digit if digit.len() == 1 && ('1'..='9').contains(&digit.chars().next().unwrap_or('0')) => {
            launch(ui, digit.parse::<usize>().unwrap_or(1) - 1);
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

/// On a New tab page, a digit picks that launcher entry.
fn launch(ui: Ui, index: usize) {
    let target = ui.ws.with_untracked(|ws| {
        let tab = ws.focused_tab()?;
        (ws.tabs.get(&tab) == Some(&View::Launcher)).then_some(tab)
    });
    let choice = lkjstr_core::launcher_choices().into_iter().nth(index);
    if let (Some(tab), Some(choice)) = (target, choice) {
        ui.ws.update(|ws| ws.replace_view(tab, choice.view));
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
    super::focus::return_on_close();
    view! {
        <div class="overlay" on:click=move |_| ui.help.set(false)>
            <div class="sheet" role="dialog" aria-label=move || ui.tr("Keyboard shortcuts") on:click=|ev| ev.stop_propagation()>
                <h2>{move || ui.tr("Keyboard shortcuts")}</h2>
                <table class="keys">
                    {SHORTCUTS
                        .iter()
                        .map(|(keys, what)| view! { <tr><td><kbd>{*keys}</kbd></td><td>{move || ui.tr(what)}</td></tr> })
                        .collect_view()}
                </table>
                <p class="muted">{move || ui.tr("Drag a tab onto a tile's edge to split, onto its body to stack, or along a tab strip to reorder. Drag the gaps between tiles to resize.")}</p>
                <button on:click=move |_| ui.help.set(false)>{move || ui.tr("Close")}</button>
            </div>
        </div>
    }
}
