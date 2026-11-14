//! The tiled workspace: a layout tree plus the view of every tab and the
//! focused pane. Every command is a total function on plain data.

use std::collections::{BTreeMap, BTreeSet};

use serde::{Deserialize, Serialize};

use crate::layout::{self, Dir, Node, NodeId, Pane, Split, TabId, Zone};
use crate::view::View;

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Workspace {
    pub root: Node,
    pub tabs: BTreeMap<TabId, View>,
    pub focus: NodeId,
    #[serde(default)]
    pub next_id: u32,
    #[serde(default)]
    pub navigation: crate::navigation::Navigation,
}

/// How `open` places a view.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Open {
    /// In the focused pane's stack.
    Here,
    /// Explicit new split to the right, even when there is a neighbour.
    Split,
    /// In the pane right of the focused one, splitting if there is none.
    Beside,
}

fn pane(id: NodeId, tabs: Vec<TabId>) -> Node {
    Node::Pane(Pane {
        id,
        active: tabs.first().copied().unwrap_or_default(),
        tabs,
    })
}

impl Workspace {
    /// Default three-column desk: reading, activity, writing.
    pub fn preset(signed_in: bool) -> Workspace {
        let views = [
            View::Home,
            View::Global,
            View::Settings,
            View::Notifications,
            View::Search {
                query: String::new(),
            },
            View::Compose { reply_to: None },
            View::Relays,
            View::Accounts,
        ];
        let tabs: BTreeMap<TabId, View> = (1..).zip(views).collect();
        let first = if signed_in {
            vec![1, 2, 3]
        } else {
            vec![2, 3, 1]
        };
        let root = Node::Split(Split {
            id: 20,
            dir: Dir::Row,
            sizes: vec![0.4, 0.3, 0.3],
            children: vec![
                pane(10, first),
                pane(11, vec![4, 5]),
                Node::Split(Split {
                    id: 21,
                    dir: Dir::Col,
                    sizes: vec![0.45, 0.55],
                    children: vec![pane(12, vec![6]), pane(13, vec![7, 8])],
                }),
            ],
        });
        Workspace {
            root,
            tabs,
            focus: 10,
            next_id: 30,
            navigation: crate::navigation::Navigation::default(),
        }
    }

    /// Repairs a stored workspace: drops unknown tabs, fixes focus and ids.
    pub fn repaired(mut self, signed_in: bool) -> Workspace {
        let known: Vec<TabId> = self.tabs.keys().copied().collect();
        let mut seen = Vec::new();
        let root = layout::map_panes(self.root, &mut |mut pane| {
            pane.tabs.retain(|tab| {
                known.contains(tab) && !seen.contains(tab) && {
                    seen.push(*tab);
                    true
                }
            });
            Some(pane)
        });
        let Some(root) = root else {
            return Workspace::preset(signed_in);
        };
        self.tabs.retain(|tab, _| seen.contains(tab));
        self.navigation
            .histories
            .retain(|tab, _| seen.contains(tab));
        self.navigation.previews.retain(|tab| seen.contains(tab));
        self.navigation.pinned.retain(|tab| seen.contains(tab));
        let mut recent = BTreeSet::new();
        self.navigation
            .recent
            .retain(|tab| seen.contains(tab) && recent.insert(*tab));
        self.root = root;
        if layout::find_pane(&self.root, self.focus).is_none() {
            self.focus = layout::panes(&self.root)[0].id;
        }
        self.next_id = self.next_id.max(layout::max_id(&self.root) + 1);
        self
    }

    fn alloc(&mut self) -> u32 {
        self.next_id = self.next_id.max(layout::max_id(&self.root) + 1);
        let id = self.next_id;
        self.next_id += 1;
        id
    }

    pub fn focused_pane(&self) -> Option<&Pane> {
        layout::find_pane(&self.root, self.focus)
    }

    pub fn focused_tab(&self) -> Option<TabId> {
        self.focused_pane().map(|pane| pane.active)
    }

    /// Always opens an independent tab, including identical views.
    pub fn open(&mut self, view: View, how: Open) -> TabId {
        let view = crate::addresses::public_view(view);
        self.checkpoint();
        let tab = self.alloc();
        self.tabs.insert(tab, view);
        let (target, zone) = match how {
            Open::Here => (self.focus, Zone::Center),
            Open::Split => (self.focus, Zone::Right),
            Open::Beside => match layout::neighbor(&self.root, self.focus, Zone::Right) {
                Some(right) => (right, Zone::Center),
                None => (self.focus, Zone::Right),
            },
        };
        let mut next = self.next_id;
        let mut ids = || {
            next += 1;
            next - 1
        };
        let (root, holder) = layout::add_tab(self.root.clone(), target, tab, zone, &mut ids);
        self.next_id = next;
        self.root = root;
        self.focus = holder;
        self.activate(tab);
        tab
    }

    pub fn activate(&mut self, tab: TabId) {
        if let Some(holder) = layout::pane_of_tab(&self.root, tab).map(|pane| pane.id) {
            self.navigation.recent.retain(|id| *id != tab);
            self.navigation.recent.insert(0, tab);
            self.root = layout::activate(self.root.clone(), tab);
            self.focus = holder;
        }
    }

    /// The `+` page (or any tab) becomes another view in place.
    pub fn replace_view(&mut self, tab: TabId, view: View) {
        self.navigate(tab, view);
        self.keep(tab);
    }

    pub fn close_tab(&mut self, tab: TabId) {
        if !self.tabs.contains_key(&tab) {
            return;
        }
        let before = serde_json::to_string(self).unwrap_or_default();
        self.checkpoint();
        self.remove_tab(tab);
        self.remember_closed(before, vec![tab]);
    }

    /// Mutate without recording: a pane closure is one recovery/undo action.
    pub(crate) fn remove_tab(&mut self, tab: TabId) {
        let holder = layout::pane_of_tab(&self.root, tab).map(|pane| pane.id);
        let next = self.next_after_close(tab);
        self.tabs.remove(&tab);
        self.navigation.recent.retain(|id| *id != tab);
        self.navigation.pinned.remove(&tab);
        self.navigation.histories.remove(&tab);
        self.navigation.previews.remove(&tab);
        match layout::remove_tab(self.root.clone(), tab) {
            Some(root) => self.root = root,
            None => self.reset_to_launcher(),
        }
        if let Some(next) = next {
            self.root = layout::activate(self.root.clone(), next);
        }
        if holder == Some(self.focus) && layout::find_pane(&self.root, self.focus).is_none() {
            self.focus = layout::panes(&self.root)[0].id;
        }
    }

    pub fn close_pane(&mut self, pane_id: NodeId) {
        let doomed: Vec<TabId> = layout::find_pane(&self.root, pane_id)
            .map(|pane| pane.tabs.clone())
            .unwrap_or_default();
        if doomed.is_empty() {
            return;
        }
        let before = serde_json::to_string(self).unwrap_or_default();
        self.checkpoint();
        for tab in &doomed {
            self.remove_tab(*tab);
        }
        self.remember_closed(before, doomed);
    }

    fn reset_to_launcher(&mut self) {
        let tab = self.alloc();
        let id = self.alloc();
        self.tabs.insert(tab, View::Launcher);
        self.root = pane(id, vec![tab]);
        self.focus = id;
    }

    pub fn resize(&mut self, split: NodeId, sizes: &[f64]) {
        self.checkpoint();
        self.root = layout::resize(self.root.clone(), split, sizes);
    }
}

#[path = "workspace_keys.rs"]
mod keys;
pub use keys::Command;
pub(crate) use keys::parent_of;
