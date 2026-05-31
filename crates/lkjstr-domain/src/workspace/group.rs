#![doc = "Workspace tab groups."]

use crate::workspace::tab::WorkspaceTab;
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TabGroup {
    pub id: String,
    pub tab_ids: Vec<String>,
    pub active_tab_id: Option<String>,
    pub pinned_tab_ids: Vec<String>,
    pub closed_tabs: Vec<WorkspaceTab>,
}

impl TabGroup {
    #[must_use]
    pub fn new(id: impl Into<String>, tab: &WorkspaceTab) -> Self {
        Self {
            id: id.into(),
            tab_ids: vec![tab.id.clone()],
            active_tab_id: Some(tab.id.clone()),
            pinned_tab_ids: Vec::new(),
            closed_tabs: Vec::new(),
        }
    }

    #[must_use]
    pub fn add_tab(&self, tab_id: &str) -> Self {
        if self.tab_ids.iter().any(|id| id == tab_id) {
            return self.activate(tab_id);
        }
        let mut tab_ids = self.tab_ids.clone();
        tab_ids.push(tab_id.to_owned());
        Self {
            tab_ids,
            active_tab_id: Some(tab_id.to_owned()),
            ..self.clone()
        }
    }

    #[must_use]
    pub fn activate(&self, tab_id: &str) -> Self {
        if !self.tab_ids.iter().any(|id| id == tab_id) {
            return self.clone();
        }
        Self {
            active_tab_id: Some(tab_id.to_owned()),
            ..self.clone()
        }
    }

    #[must_use]
    pub fn close_tab(&self, tab: &WorkspaceTab) -> Self {
        let tab_ids: Vec<String> = self
            .tab_ids
            .iter()
            .filter(|id| *id != &tab.id)
            .cloned()
            .collect();
        let active_tab_id = if self.active_tab_id.as_deref() == Some(tab.id.as_str()) {
            tab_ids.last().cloned()
        } else {
            self.active_tab_id.clone()
        };
        let mut closed_tabs = vec![tab.clone()];
        closed_tabs.extend(self.closed_tabs.iter().take(19).cloned());
        Self {
            tab_ids,
            active_tab_id,
            pinned_tab_ids: self
                .pinned_tab_ids
                .iter()
                .filter(|id| *id != &tab.id)
                .cloned()
                .collect(),
            closed_tabs,
            ..self.clone()
        }
    }
}
