#![doc = "Workspace pane and split layout."]

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case")]
pub enum SplitDirection {
    Horizontal,
    Vertical,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaneNode {
    pub id: String,
    pub tab_group_id: String,
    pub min_width: u16,
    pub min_height: u16,
    #[serde(default, skip_serializing_if = "is_false")]
    pub collapsed: bool,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
pub struct SplitNode {
    pub id: String,
    pub direction: SplitDirection,
    pub children: Vec<LayoutNode>,
    pub sizes: Vec<u16>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "kebab-case", tag = "type")]
pub enum LayoutNode {
    Pane(PaneNode),
    Split(SplitNode),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct NewPaneIds {
    pub pane_id: String,
    pub group_id: String,
    pub tab_id: String,
    pub split_id: String,
}

impl PaneNode {
    #[must_use]
    pub fn new(id: impl Into<String>, tab_group_id: impl Into<String>) -> Self {
        Self {
            id: id.into(),
            tab_group_id: tab_group_id.into(),
            min_width: 260,
            min_height: 180,
            collapsed: false,
        }
    }
}

impl LayoutNode {
    #[must_use]
    pub fn pane_ids(&self) -> Vec<String> {
        match self {
            Self::Pane(pane) => vec![pane.id.clone()],
            Self::Split(split) => split.children.iter().flat_map(Self::pane_ids).collect(),
        }
    }

    #[must_use]
    pub fn find_pane(&self, pane_id: &str) -> Option<&PaneNode> {
        match self {
            Self::Pane(pane) if pane.id == pane_id => Some(pane),
            Self::Pane(_) => None,
            Self::Split(split) => split
                .children
                .iter()
                .find_map(|child| child.find_pane(pane_id)),
        }
    }

    #[must_use]
    pub fn split_pane(
        &self,
        pane_id: &str,
        split_id: &str,
        direction: SplitDirection,
        new_pane: PaneNode,
    ) -> Self {
        match self {
            Self::Pane(pane) if pane.id == pane_id => Self::Split(SplitNode {
                id: split_id.to_owned(),
                direction,
                children: vec![self.clone(), Self::Pane(new_pane)],
                sizes: equal_sizes(2),
            }),
            Self::Pane(_) => self.clone(),
            Self::Split(split) => Self::Split(SplitNode {
                children: split
                    .children
                    .iter()
                    .map(|child| child.split_pane(pane_id, split_id, direction, new_pane.clone()))
                    .collect(),
                ..split.clone()
            }),
        }
    }

    #[must_use]
    pub fn remove_pane(&self, pane_id: &str) -> Option<Self> {
        match self {
            Self::Pane(pane) => (pane.id != pane_id).then(|| self.clone()),
            Self::Split(split) => compact_split(split, pane_id),
        }
    }
}

#[must_use]
pub fn equal_sizes(count: usize) -> Vec<u16> {
    if count == 0 {
        return Vec::new();
    }
    vec![(10_000 / count) as u16; count]
}

fn compact_split(split: &SplitNode, pane_id: &str) -> Option<LayoutNode> {
    let children: Vec<LayoutNode> = split
        .children
        .iter()
        .filter_map(|child| child.remove_pane(pane_id))
        .collect();
    match children.len() {
        0 => None,
        1 => children.first().cloned(),
        _ => Some(LayoutNode::Split(SplitNode {
            sizes: equal_sizes(children.len()),
            children,
            ..split.clone()
        })),
    }
}

fn is_false(value: &bool) -> bool {
    !value
}
