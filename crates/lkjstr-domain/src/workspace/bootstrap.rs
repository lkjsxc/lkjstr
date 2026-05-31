#![doc = "Clean startup workspace."]

use std::collections::BTreeMap;

use crate::workspace::group::TabGroup;
use crate::workspace::layout::{LayoutNode, PaneNode, SplitDirection, SplitNode};
use crate::workspace::model::Workspace;
use crate::workspace::tab::{TabKind, WorkspaceTab};

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BootstrapIds;

#[must_use]
pub fn bootstrap_workspace() -> Workspace {
    let welcome = WorkspaceTab::new("bootstrap-welcome-tab", TabKind::Welcome, 0);
    let startup = startup_tabs();
    let welcome_group = TabGroup::new("bootstrap-welcome-group", &welcome);
    let main_group = TabGroup {
        id: "bootstrap-main-group".to_owned(),
        tab_ids: startup.iter().map(|tab| tab.id.clone()).collect(),
        active_tab_id: Some("bootstrap-accounts-tab".to_owned()),
        pinned_tab_ids: Vec::new(),
        closed_tabs: Vec::new(),
    };
    let mut tabs = BTreeMap::from([(welcome.id.clone(), welcome.clone())]);
    for tab in startup {
        tabs.insert(tab.id.clone(), tab);
    }
    Workspace {
        id: "main".to_owned(),
        name: "Main workspace".to_owned(),
        layout: Some(LayoutNode::Split(SplitNode {
            id: "bootstrap-root-split".to_owned(),
            direction: SplitDirection::Vertical,
            children: vec![
                LayoutNode::Pane(PaneNode::new(
                    "bootstrap-welcome-pane",
                    welcome_group.id.clone(),
                )),
                LayoutNode::Pane(PaneNode::new("bootstrap-main-pane", main_group.id.clone())),
            ],
            sizes: vec![4000, 6000],
        })),
        tab_groups: BTreeMap::from([
            (welcome_group.id.clone(), welcome_group),
            (main_group.id.clone(), main_group),
        ]),
        tabs,
        focused_pane_id: Some("bootstrap-welcome-pane".to_owned()),
        focused_tab_id: Some(welcome.id),
        active_account_id: None,
        sidebar_visible: false,
        activity_bar_visible: false,
        updated_at: 0,
    }
}

fn startup_tabs() -> Vec<WorkspaceTab> {
    vec![
        WorkspaceTab::new("bootstrap-accounts-tab", TabKind::AccountManager, 0),
        WorkspaceTab::new("bootstrap-relays-tab", TabKind::RelaySettings, 0),
        WorkspaceTab::new("bootstrap-home-tab", TabKind::Timeline, 0),
        WorkspaceTab::new("bootstrap-notifications-tab", TabKind::Notifications, 0),
        WorkspaceTab::new("bootstrap-tweet-tab", TabKind::Tweet, 0),
    ]
}
