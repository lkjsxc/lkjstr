//! The tiled workspace: a layout tree plus the view of every tab and the
//! focused pane. Every command is a total function on plain data.

use std::collections::BTreeMap;

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
}

/// How `open` places a view.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Open {
    /// In the focused pane's stack.
    Here,
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
            View::Welcome,
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
            vec![3, 2, 1]
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

    pub fn find_view(&self, view: &View) -> Option<TabId> {
        self.tabs
            .iter()
            .find(|(_, open)| *open == view)
            .map(|(tab, _)| *tab)
    }

    /// Opens `view`, focusing an existing tab when the same view is open.
    pub fn open(&mut self, view: View, how: Open) -> TabId {
        if let Some(tab) = self.find_view(&view) {
            self.activate(tab);
            return tab;
        }
        let tab = self.alloc();
        self.tabs.insert(tab, view);
        let (target, zone) = match how {
            Open::Here => (self.focus, Zone::Center),
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
        tab
    }

    pub fn activate(&mut self, tab: TabId) {
        if let Some(holder) = layout::pane_of_tab(&self.root, tab).map(|pane| pane.id) {
            self.root = layout::activate(self.root.clone(), tab);
            self.focus = holder;
        }
    }

    /// The `+` page (or any tab) becomes another view in place.
    pub fn replace_view(&mut self, tab: TabId, view: View) {
        if let Some(existing) = self.find_view(&view).filter(|existing| *existing != tab) {
            self.close_tab(tab);
            self.activate(existing);
            return;
        }
        if let Some(slot) = self.tabs.get_mut(&tab) {
            *slot = view;
            self.activate(tab);
        }
    }

    pub fn close_tab(&mut self, tab: TabId) {
        let holder = layout::pane_of_tab(&self.root, tab).map(|pane| pane.id);
        self.tabs.remove(&tab);
        match layout::remove_tab(self.root.clone(), tab) {
            Some(root) => self.root = root,
            None => self.reset_to_launcher(),
        }
        if holder == Some(self.focus) && layout::find_pane(&self.root, self.focus).is_none() {
            self.focus = layout::panes(&self.root)[0].id;
        }
    }

    pub fn close_pane(&mut self, pane_id: NodeId) {
        let doomed: Vec<TabId> = layout::find_pane(&self.root, pane_id)
            .map(|pane| pane.tabs.clone())
            .unwrap_or_default();
        for tab in doomed {
            self.close_tab(tab);
        }
    }

    fn reset_to_launcher(&mut self) {
        let tab = self.alloc();
        let id = self.alloc();
        self.tabs.insert(tab, View::Launcher);
        self.root = pane(id, vec![tab]);
        self.focus = id;
    }

    pub fn resize(&mut self, split: NodeId, sizes: &[f64]) {
        self.root = layout::resize(self.root.clone(), split, sizes);
    }
}

#[path = "workspace_keys.rs"]
mod keys;
pub use keys::Command;
