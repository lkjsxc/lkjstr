//! Keyboard-sized workspace commands: focus, move, split, cycle.

use super::Workspace;
use crate::layout::{self, NodeId, TabId, Zone};
use crate::view::View;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Command {
    Focus(Zone),
    /// Move the focused tab to the neighbouring pane, or split that way.
    MoveTab(Zone),
    /// Split the focused pane: its tab moves over, or a new tab opens.
    Split(Zone),
    Cycle(i32),
    Select(usize),
    CloseTab,
    NewTab,
    /// Grow (positive) or shrink the focused pane along its parent split.
    Grow(i32),
}

impl Workspace {
    pub fn apply(&mut self, command: Command) {
        match command {
            Command::Focus(zone) => {
                if let Some(next) = layout::neighbor(&self.root, self.focus, zone) {
                    self.focus = next;
                }
            }
            Command::MoveTab(zone) => self.move_focused(zone),
            Command::Split(zone) => self.split_focused(zone),
            Command::Cycle(delta) => self.cycle(delta),
            Command::Select(index) => {
                let tab = self
                    .focused_pane()
                    .and_then(|pane| pane.tabs.get(index).copied());
                if let Some(tab) = tab {
                    self.activate(tab);
                }
            }
            Command::CloseTab => {
                if let Some(tab) = self.focused_tab() {
                    self.close_tab(tab);
                }
            }
            Command::NewTab => self.new_tab(),
            Command::Grow(steps) => self.grow(steps),
        }
    }

    /// Drag and drop: `zone` of pane `target`, or a strip position.
    pub fn drop_tab(&mut self, tab: TabId, target: NodeId, zone: Zone, index: Option<usize>) {
        let mut next = self.next_id.max(layout::max_id(&self.root) + 1);
        let mut ids = || {
            next += 1;
            next - 1
        };
        let (root, holder) =
            layout::move_tab(self.root.clone(), tab, target, zone, index, &mut ids);
        self.next_id = next;
        self.root = root;
        self.focus = holder;
    }

    fn move_focused(&mut self, zone: Zone) {
        let Some(tab) = self.focused_tab() else {
            return;
        };
        match layout::neighbor(&self.root, self.focus, zone) {
            Some(target) => self.drop_tab(tab, target, Zone::Center, None),
            None => self.drop_tab(tab, self.focus, zone, None),
        }
    }

    fn split_focused(&mut self, zone: Zone) {
        let Some(pane) = self.focused_pane().cloned() else {
            return;
        };
        if pane.tabs.len() > 1 {
            self.drop_tab(pane.active, pane.id, zone, None);
            return;
        }
        let tab = self.next_id.max(layout::max_id(&self.root) + 1);
        self.next_id = tab + 1;
        self.tabs.insert(tab, View::Launcher);
        let mut next = self.next_id;
        let mut ids = || {
            next += 1;
            next - 1
        };
        let (root, holder) = layout::add_tab(self.root.clone(), pane.id, tab, zone, &mut ids);
        self.next_id = next;
        self.root = root;
        self.focus = holder;
    }

    fn cycle(&mut self, delta: i32) {
        let Some(pane) = self.focused_pane() else {
            return;
        };
        let count = pane.tabs.len() as i32;
        let at = pane
            .tabs
            .iter()
            .position(|t| *t == pane.active)
            .unwrap_or(0) as i32;
        let next = pane.tabs[((at + delta).rem_euclid(count)) as usize];
        self.activate(next);
    }

    fn new_tab(&mut self) {
        let existing = self.focused_pane().and_then(|pane| {
            pane.tabs
                .iter()
                .copied()
                .find(|tab| self.tabs.get(tab) == Some(&View::Launcher))
        });
        match existing {
            Some(tab) => self.activate(tab),
            None => {
                let tab = self.next_id.max(layout::max_id(&self.root) + 1);
                self.next_id = tab + 1;
                self.tabs.insert(tab, View::Launcher);
                let mut ids = || 0;
                let (root, _) =
                    layout::add_tab(self.root.clone(), self.focus, tab, Zone::Center, &mut ids);
                self.root = root;
            }
        }
    }

    fn grow(&mut self, steps: i32) {
        let Some((split, index)) = parent_of(&self.root, self.focus) else {
            return;
        };
        let mut sizes = split.sizes.clone();
        let delta = 0.05 * f64::from(steps);
        let count = sizes.len() as f64;
        let floor = 0.08;
        let grown = (sizes[index] + delta).clamp(floor, 1.0 - floor * (count - 1.0));
        let change = grown - sizes[index];
        let others: f64 = sizes.iter().sum::<f64>() - sizes[index];
        for (at, size) in sizes.iter_mut().enumerate() {
            if at == index {
                *size = grown;
            } else if others > 0.0 {
                *size = (*size - change * *size / others).max(floor / 2.0);
            }
        }
        let id = split.id;
        self.resize(id, &sizes);
    }
}

fn parent_of(root: &layout::Node, pane: NodeId) -> Option<(&layout::Split, usize)> {
    let layout::Node::Split(split) = root else {
        return None;
    };
    for (index, child) in split.children.iter().enumerate() {
        if matches!(child, layout::Node::Pane(p) if p.id == pane) {
            return Some((split, index));
        }
        if let Some(found) = parent_of(child, pane) {
            return Some(found);
        }
    }
    None
}
