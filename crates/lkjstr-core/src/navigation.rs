//! Per-tab navigation and bounded layout recovery. No browser effects.
use crate::{
    Open, View, Workspace,
    layout::{self, TabId, Zone},
};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, BTreeSet};

const HISTORY_CAP: usize = 64;
const RECOVERY_CAP: usize = 32;

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct History {
    pub back: Vec<View>,
    pub forward: Vec<View>,
}

#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct Navigation {
    pub histories: BTreeMap<TabId, History>,
    pub previews: BTreeSet<TabId>,
    #[serde(default)]
    pub pinned: BTreeSet<TabId>,
    /// Most recently activated first, bounded by the number of live tabs.
    #[serde(default)]
    pub recent: Vec<TabId>,
    /// At most 32 serialized layouts. Recovery is local to this page lifetime.
    #[serde(skip)]
    pub undo: Vec<String>,
    #[serde(skip)]
    pub closed: Vec<(String, String, Vec<TabId>)>,
}

impl Workspace {
    pub fn reset_to_preset(&mut self, signed_in: bool) {
        self.checkpoint();
        let mut preset = Self::preset(signed_in);
        preset.fresh_ids(self.next_id.max(layout::max_id(&self.root) + 1));
        preset.navigation.undo = std::mem::take(&mut self.navigation.undo);
        preset.navigation.closed = std::mem::take(&mut self.navigation.closed);
        *self = preset;
    }

    pub fn checkpoint(&mut self) {
        let Ok(snapshot) = serde_json::to_string(self) else {
            return;
        };
        if self.navigation.undo.last() != Some(&snapshot) {
            self.navigation.undo.push(snapshot);
            if self.navigation.undo.len() > RECOVERY_CAP {
                self.navigation.undo.remove(0);
            }
        }
    }

    pub fn undo_layout(&mut self) {
        while let Some(snapshot) = self.navigation.undo.pop() {
            if serde_json::to_string(self).ok().as_ref() == Some(&snapshot) {
                continue;
            }
            if let Ok(mut ws) = serde_json::from_str::<Workspace>(&snapshot) {
                ws.next_id = ws.next_id.max(self.next_id);
                ws.navigation.undo = std::mem::take(&mut self.navigation.undo);
                ws.navigation.closed = std::mem::take(&mut self.navigation.closed);
                *self = ws;
                break;
            }
        }
    }

    pub fn remember_closed(&mut self, before: String, tabs: Vec<TabId>) {
        let Ok(after) = serde_json::to_string(self) else {
            return;
        };
        self.navigation.closed.push((before, after, tabs));
        if self.navigation.closed.len() > RECOVERY_CAP {
            self.navigation.closed.remove(0);
        }
    }

    pub fn reopen(&mut self) {
        let Some((before, after, tabs)) = self.navigation.closed.pop() else {
            return;
        };
        let Ok(mut old) = serde_json::from_str::<Workspace>(&before) else {
            return;
        };
        self.checkpoint();
        if serde_json::to_string(self).ok().as_ref() == Some(&after) {
            old.next_id = old.next_id.max(self.next_id);
            old.navigation.undo = std::mem::take(&mut self.navigation.undo);
            old.navigation.closed = std::mem::take(&mut self.navigation.closed);
            *self = old;
            return;
        }
        // Later edits survive reopening: recover each absent tab near its old tile.
        for tab in tabs {
            if self.tabs.contains_key(&tab) {
                continue;
            }
            let Some(view) = old.tabs.get(&tab).cloned() else {
                continue;
            };
            let target = layout::pane_of_tab(&old.root, tab).map(|p| p.id);
            let here = target.filter(|p| layout::find_pane(&self.root, *p).is_some());
            if let Some(pane) = here {
                self.focus = pane;
            }
            self.tabs.insert(tab, view);
            let mut next = self.next_id.max(old.next_id);
            let mut ids = || {
                let id = next;
                next += 1;
                id
            };
            let (root, holder) = layout::add_tab(
                self.root.clone(),
                self.focus,
                tab,
                if here.is_some() {
                    Zone::Center
                } else {
                    Zone::Right
                },
                &mut ids,
            );
            self.root = root;
            self.focus = holder;
            self.next_id = next;
            if let Some(history) = old.navigation.histories.remove(&tab) {
                self.navigation.histories.insert(tab, history);
            }
        }
    }

    pub fn keep(&mut self, tab: TabId) {
        self.navigation.previews.remove(&tab);
    }

    /// Apply the full distance, clamping at the bounded history's endpoint.
    pub fn travel(&mut self, distance: i32) -> bool {
        let Some(tab) = self.focused_tab() else {
            return false;
        };
        let Some(mut current) = self.tabs.get(&tab).cloned() else {
            return false;
        };
        let history = self.navigation.histories.entry(tab).or_default();
        let (from, to) = if distance < 0 {
            (&mut history.back, &mut history.forward)
        } else {
            (&mut history.forward, &mut history.back)
        };
        let count = (distance.unsigned_abs() as usize).min(from.len());
        for _ in 0..count {
            if let Some(view) = from.pop() {
                to.push(current);
                current = view;
            }
        }
        self.tabs.insert(tab, current);
        count > 0
    }

    pub fn navigate(&mut self, tab: TabId, view: View) {
        let view = crate::addresses::public_view(view);
        let Some(current) = self.tabs.get(&tab).cloned() else {
            return;
        };
        if current == view {
            self.activate(tab);
            return;
        }
        let history = self.navigation.histories.entry(tab).or_default();
        history.back.push(current);
        if history.back.len() > HISTORY_CAP {
            history.back.remove(0);
        }
        history.forward.clear();
        self.tabs.insert(tab, view);
        self.activate(tab);
    }

    /// Detail placement: a neighbour, a sufficiently wide split, or this tile.
    pub fn open_detail(&mut self, view: View, width: f64, kept: bool, split: bool) -> TabId {
        let right = layout::neighbor(&self.root, self.focus, Zone::Right);
        let pane_width = layout::pane_rects(&self.root)
            .iter()
            .find(|(id, _)| *id == self.focus)
            .map_or(width, |(_, r)| r.w * width);
        let how = if width < 760.0 {
            Open::Here
        } else if split && pane_width >= 720.0 {
            Open::Split
        } else if right.is_some() || pane_width >= 720.0 {
            Open::Beside
        } else {
            Open::Here
        };
        let target = if how == Open::Beside {
            right
        } else if how == Open::Here {
            Some(self.focus)
        } else {
            None
        };
        if !kept
            && let Some(preview) = target
                .and_then(|pane| layout::find_pane(&self.root, pane))
                .and_then(|p| {
                    p.tabs
                        .iter()
                        .find(|tab| self.navigation.previews.contains(tab))
                })
                .copied()
        {
            if self.tabs.get(&preview) == Some(&view) {
                self.keep(preview);
            } else {
                self.navigate(preview, view);
                return preview;
            }
        }
        let tab = self.open(view, how);
        if !kept {
            self.navigation.previews.insert(tab);
        }
        tab
    }
}
