//! Tab policies share the same model for pointer, menu and keyboard actions.
use crate::{
    Open, Workspace,
    layout::{self, TabId},
};

impl Workspace {
    pub(crate) fn next_after_close(&self, tab: TabId) -> Option<TabId> {
        let pane = layout::pane_of_tab(&self.root, tab)?;
        if pane.active != tab {
            return None;
        }
        self.navigation
            .recent
            .iter()
            .copied()
            .find(|id| *id != tab && pane.tabs.contains(id))
            .or_else(|| {
                let at = pane.tabs.iter().position(|id| *id == tab)?;
                pane.tabs
                    .get(at + 1)
                    .or_else(|| at.checked_sub(1).and_then(|i| pane.tabs.get(i)))
                    .copied()
            })
    }

    pub fn pin(&mut self, tab: TabId) {
        self.checkpoint();
        self.keep(tab);
        if !self.navigation.pinned.remove(&tab) {
            self.navigation.pinned.insert(tab);
        }
        let pinned = self.navigation.pinned.clone();
        if let Some(root) = layout::map_panes(self.root.clone(), &mut |mut pane| {
            pane.tabs.sort_by_key(|id| !pinned.contains(id));
            Some(pane)
        }) {
            self.root = root;
        }
    }

    pub fn close_others(&mut self, tab: TabId, right_only: bool) {
        let Some(pane) = layout::pane_of_tab(&self.root, tab) else {
            return;
        };
        let at = pane.tabs.iter().position(|id| *id == tab).unwrap_or(0);
        let doomed: Vec<_> = pane
            .tabs
            .iter()
            .enumerate()
            .filter(|(i, id)| {
                **id != tab && (!right_only || *i > at) && !self.navigation.pinned.contains(id)
            })
            .map(|(_, id)| *id)
            .collect();
        for id in doomed {
            self.close_tab(id);
        }
    }

    /// View and history duplicate; drafts have distinct per-tab storage keys.
    pub fn duplicate(&mut self, tab: TabId) -> Option<TabId> {
        let view = self.tabs.get(&tab)?.clone();
        let history = self.navigation.histories.get(&tab).cloned();
        self.activate(tab);
        let copy = self.open(view, Open::Here);
        if let Some(history) = history {
            self.navigation.histories.insert(copy, history);
        }
        Some(copy)
    }
}
