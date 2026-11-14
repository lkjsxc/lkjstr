//! Pure tiling layout tree. Ported from ytenrich's `wm/layout.ts`, which itself
//! began as lkjstr's layout tree. Tabs are ids; each id appears at most once.

mod edit;
mod geometry;

pub use edit::{add_tab, close_pane, move_tab, resize};
pub use geometry::{Rect, neighbor, pane_rects};

use serde::{Deserialize, Serialize};

pub type NodeId = u32;
pub type TabId = u32;

#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Dir {
    Row,
    Col,
}

/// Where a tab lands relative to a target pane.
#[derive(Clone, Copy, Debug, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Zone {
    Center,
    Left,
    Right,
    Top,
    Bottom,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Pane {
    pub id: NodeId,
    pub tabs: Vec<TabId>,
    pub active: TabId,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct Split {
    pub id: NodeId,
    pub dir: Dir,
    pub children: Vec<Node>,
    pub sizes: Vec<f64>,
}

#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "lowercase")]
pub enum Node {
    Pane(Pane),
    Split(Split),
}

impl Node {
    pub fn id(&self) -> NodeId {
        match self {
            Node::Pane(pane) => pane.id,
            Node::Split(split) => split.id,
        }
    }
}

pub fn panes(root: &Node) -> Vec<&Pane> {
    match root {
        Node::Pane(pane) => vec![pane],
        Node::Split(split) => split.children.iter().flat_map(panes).collect(),
    }
}

pub fn tabs(root: &Node) -> Vec<TabId> {
    panes(root)
        .iter()
        .flat_map(|pane| pane.tabs.clone())
        .collect()
}

pub fn pane_of_tab(root: &Node, tab: TabId) -> Option<&Pane> {
    panes(root)
        .into_iter()
        .find(|pane| pane.tabs.contains(&tab))
}

pub fn find_pane(root: &Node, id: NodeId) -> Option<&Pane> {
    panes(root).into_iter().find(|pane| pane.id == id)
}

pub fn max_id(root: &Node) -> u32 {
    match root {
        Node::Pane(pane) => pane.tabs.iter().copied().fold(pane.id, u32::max),
        Node::Split(split) => split.children.iter().map(max_id).fold(split.id, u32::max),
    }
}

/// Applies `edit` to every pane; returning `None` removes the pane.
pub fn map_panes(root: Node, edit: &mut impl FnMut(Pane) -> Option<Pane>) -> Option<Node> {
    match root {
        Node::Pane(pane) => edit(pane).and_then(|pane| normalize(Node::Pane(pane))),
        Node::Split(split) => {
            let mut children = Vec::new();
            let mut sizes = Vec::new();
            for (child, size) in split.children.into_iter().zip(split.sizes.iter().copied()) {
                if let Some(child) = map_panes(child, edit) {
                    children.push(child);
                    sizes.push(size);
                }
            }
            normalize(Node::Split(Split {
                children,
                sizes,
                ..split
            }))
        }
    }
}

/// Removes empty panes and splits, flattens same-direction nesting, repairs
/// sizes and active tabs. `None` means nothing is left.
pub fn normalize(node: Node) -> Option<Node> {
    match node {
        Node::Pane(mut pane) => {
            let mut seen = Vec::new();
            pane.tabs.retain(|tab| {
                let fresh = !seen.contains(tab);
                seen.push(*tab);
                fresh
            });
            let first = *pane.tabs.first()?;
            if !pane.tabs.contains(&pane.active) {
                pane.active = first;
            }
            Some(Node::Pane(pane))
        }
        Node::Split(split) => normalize_split(split),
    }
}

fn normalize_split(split: Split) -> Option<Node> {
    let mut children = Vec::new();
    let mut sizes = Vec::new();
    let count = split.children.len();
    for (index, child) in split.children.into_iter().enumerate() {
        let size = split
            .sizes
            .get(index)
            .copied()
            .unwrap_or(1.0 / count as f64);
        match normalize(child) {
            Some(Node::Split(inner)) if inner.dir == split.dir => {
                for (grand, inner_size) in inner.children.into_iter().zip(inner.sizes) {
                    children.push(grand);
                    sizes.push(size * inner_size);
                }
            }
            Some(other) => {
                children.push(other);
                sizes.push(size);
            }
            None => {}
        }
    }
    match children.len() {
        0 => None,
        1 => children.pop(),
        _ => Some(Node::Split(Split {
            sizes: norm_sizes(&sizes),
            children,
            ..split
        })),
    }
}

pub fn norm_sizes(sizes: &[f64]) -> Vec<f64> {
    let valid: Vec<f64> = sizes
        .iter()
        .map(|size| {
            if size.is_finite() && *size > 0.0 {
                *size
            } else {
                0.0
            }
        })
        .collect();
    let sum: f64 = valid.iter().sum();
    if sum > 0.0 && valid.iter().all(|size| *size > 0.0) {
        valid.iter().map(|size| size / sum).collect()
    } else {
        valid
            .iter()
            .map(|_| 1.0 / valid.len().max(1) as f64)
            .collect()
    }
}

pub fn activate(root: Node, tab: TabId) -> Node {
    let fallback = root.clone();
    map_panes(root, &mut |mut pane| {
        if pane.tabs.contains(&tab) {
            pane.active = tab;
        }
        Some(pane)
    })
    .unwrap_or(fallback)
}

pub fn remove_tab(root: Node, tab: TabId) -> Option<Node> {
    map_panes(root, &mut |mut pane| {
        pane.tabs.retain(|item| *item != tab);
        Some(pane)
    })
}
