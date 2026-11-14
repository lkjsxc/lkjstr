//! Nine independent desks. Runtime data is shared, layout and tab ids are not.
use crate::{
    Open, View, Workspace,
    layout::{self, Node, Pane, TabId},
};
use serde::{Deserialize, Serialize};

pub const COUNT: usize = 9;
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Spaces {
    pub active: usize,
    pub desks: Vec<Workspace>,
    pub names: Vec<String>,
    #[serde(default = "unseen_times")]
    pub seen: Vec<u64>,
}
fn unseen_times() -> Vec<u64> {
    vec![0; COUNT]
}
impl Default for Spaces {
    fn default() -> Self {
        let mut spaces = Self {
            active: 0,
            seen: unseen_times(),
            desks: (0..COUNT).map(Self::preset).collect(),
            names: (1..=COUNT).map(|n| format!("Workspace {n}")).collect(),
        };
        spaces.reserve_ids(0);
        spaces
    }
}
impl Spaces {
    pub fn parse(text: &str, signed_in: bool) -> Option<Self> {
        let mut spaces: Self = serde_json::from_str(text).ok()?;
        if spaces.active >= COUNT
            || spaces.desks.len() != COUNT
            || spaces.names.len() != COUNT
            || spaces.seen.len() != COUNT
        {
            return None;
        }
        spaces.desks = spaces
            .desks
            .into_iter()
            .map(|ws| ws.repaired(signed_in))
            .collect();
        for name in &mut spaces.names {
            *name = name.chars().take(32).collect();
        }
        let mut ids = std::collections::BTreeSet::new();
        if spaces
            .desks
            .iter()
            .any(|ws| ws.tabs.keys().any(|id| !ids.insert(*id)))
        {
            return None;
        }
        spaces.reserve_ids(0);
        Some(spaces)
    }
    pub fn preset(index: usize) -> Workspace {
        let mut ws = Workspace::preset(false);
        if index > 0 {
            let base = (index as u32 + 1) * 1_000_000;
            ws.root = Node::Pane(Pane {
                id: base,
                active: base + 1,
                tabs: vec![base + 1],
            });
            ws.tabs.clear();
            ws.tabs.insert(
                base + 1,
                if index == 1 {
                    View::Global
                } else if index == 2 {
                    View::Compose { reply_to: None }
                } else {
                    View::Launcher
                },
            );
            ws.focus = base;
            ws.next_id = base + 2;
            if index == 1 {
                ws.open(
                    View::Search {
                        query: String::new(),
                    },
                    Open::Beside,
                );
            }
            if index == 2 {
                ws.open(View::Notifications, Open::Beside);
            }
            ws.focus = base;
            ws.navigation = Default::default();
        }
        ws
    }
    /// Only the active desk allocates, except during a bank-owned move. Carry
    /// the high-water mark through every handoff, including deleted identities
    /// retained by recovery snapshots and draft storage.
    fn reserve_ids(&mut self, floor: u32) -> u32 {
        let next = self.desks.iter().fold(floor, |next, ws| {
            next.max(ws.next_id).max(layout::max_id(&ws.root) + 1)
        });
        for ws in &mut self.desks {
            ws.next_id = next;
        }
        next
    }
    /// Validate an imported layout and reserve identities across the whole bank.
    pub fn install(&mut self, index: usize, mut workspace: Workspace) -> bool {
        if index >= COUNT
            || self.desks.iter().enumerate().any(|(other, ws)| {
                other != index && ws.tabs.keys().any(|id| workspace.tabs.contains_key(id))
            })
        {
            return false;
        }
        workspace.next_id = self.reserve_ids(workspace.next_id);
        self.desks[index] = workspace;
        self.reserve_ids(0);
        true
    }
    pub fn switch(&mut self, current: &Workspace, to: usize) -> Option<Workspace> {
        if to >= COUNT || to == self.active {
            return None;
        }
        self.desks[self.active] = current.clone();
        self.reserve_ids(0);
        self.active = to;
        Some(self.desks[to].clone())
    }
    /// A local snapshot may predate a cross-desk move. Never restore a tab id
    /// that is now owned by another desk (its draft and scroll key travel too).
    pub fn recover(&self, current: &mut Workspace, reopen: bool) -> bool {
        let before = current.clone();
        if reopen {
            current.reopen();
        } else {
            current.undo_layout();
        }
        let collision = self
            .desks
            .iter()
            .enumerate()
            .filter(|(index, _)| *index != self.active)
            .any(|(_, ws)| ws.tabs.keys().any(|tab| current.tabs.contains_key(tab)));
        if collision {
            *current = before;
        }
        !collision
    }
    pub fn move_tab(&mut self, current: &mut Workspace, tab: TabId, to: usize) -> bool {
        if to >= COUNT || to == self.active || self.desks[to].tabs.contains_key(&tab) {
            return false;
        }
        let Some(view) = current.tabs.get(&tab).cloned() else {
            return false;
        };
        current.next_id = self.reserve_ids(current.next_id.max(layout::max_id(&current.root) + 1));
        let target = &mut self.desks[to];
        // Preserve the identity: draft, history and scroll keys travel with the tab.
        let fresh = target.open(view, Open::Here);
        let view = target.tabs.remove(&fresh).unwrap_or(View::Launcher);
        target.tabs.insert(tab, view);
        if let Some(root) = layout::map_panes(target.root.clone(), &mut |mut pane| {
            for id in &mut pane.tabs {
                if *id == fresh {
                    *id = tab;
                }
            }
            if pane.active == fresh {
                pane.active = tab;
            }
            Some(pane)
        }) {
            target.root = root;
        }
        for id in &mut target.navigation.recent {
            if *id == fresh {
                *id = tab;
            }
        }
        if let Some(history) = current.navigation.histories.get(&tab).cloned() {
            target.navigation.histories.insert(tab, history);
        }
        if current.navigation.pinned.contains(&tab) {
            target.pin(tab);
        }
        current.next_id = current.next_id.max(target.next_id);
        current.checkpoint();
        current.remove_tab(tab);
        true
    }
}
