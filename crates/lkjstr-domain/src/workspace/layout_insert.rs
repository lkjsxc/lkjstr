#![doc = "Layout insertion helpers for tab edge drops."]

use crate::workspace::layout::{LayoutNode, PaneNode, SplitDirection, SplitNode, equal_sizes};
use crate::workspace::move_tab::TabDropEdge;

#[must_use]
pub fn insert_pane_by_edge(
    layout: &LayoutNode,
    target_pane_id: &str,
    edge: TabDropEdge,
    new_pane: PaneNode,
    split_id: &str,
) -> LayoutNode {
    let direction = edge_direction(edge);
    let before = matches!(edge, TabDropEdge::Left | TabDropEdge::Top);
    insert_pane(
        layout,
        target_pane_id,
        direction,
        before,
        new_pane,
        split_id,
    )
}

fn insert_pane(
    node: &LayoutNode,
    target_pane_id: &str,
    direction: SplitDirection,
    before: bool,
    new_pane: PaneNode,
    split_id: &str,
) -> LayoutNode {
    match node {
        LayoutNode::Pane(pane) if pane.id == target_pane_id => split_leaf(
            node.clone(),
            direction,
            before,
            LayoutNode::Pane(new_pane),
            split_id,
        ),
        LayoutNode::Pane(_) => node.clone(),
        LayoutNode::Split(split) => {
            insert_into_split(split, target_pane_id, direction, before, new_pane, split_id)
        }
    }
}

fn insert_into_split(
    split: &SplitNode,
    target_pane_id: &str,
    direction: SplitDirection,
    before: bool,
    new_pane: PaneNode,
    split_id: &str,
) -> LayoutNode {
    let mut children = split.children.clone();
    for (index, child) in split.children.iter().enumerate() {
        if matches!(child, LayoutNode::Pane(pane) if pane.id == target_pane_id) {
            return insert_direct_child(
                split, children, index, direction, before, new_pane, split_id,
            );
        }
        if contains_pane(child, target_pane_id) {
            children[index] =
                insert_pane(child, target_pane_id, direction, before, new_pane, split_id);
            return LayoutNode::Split(SplitNode {
                children,
                ..split.clone()
            });
        }
    }
    LayoutNode::Split(split.clone())
}

fn insert_direct_child(
    split: &SplitNode,
    mut children: Vec<LayoutNode>,
    index: usize,
    direction: SplitDirection,
    before: bool,
    new_pane: PaneNode,
    split_id: &str,
) -> LayoutNode {
    let new_node = LayoutNode::Pane(new_pane);
    if split.direction == direction {
        children.insert(if before { index } else { index + 1 }, new_node);
        return LayoutNode::Split(SplitNode {
            sizes: equal_sizes(split.children.len() + 1),
            children,
            ..split.clone()
        });
    }
    children[index] = split_leaf(
        children[index].clone(),
        direction,
        before,
        new_node,
        split_id,
    );
    LayoutNode::Split(SplitNode {
        children,
        ..split.clone()
    })
}

fn split_leaf(
    target: LayoutNode,
    direction: SplitDirection,
    before: bool,
    new_node: LayoutNode,
    split_id: &str,
) -> LayoutNode {
    let children = if before {
        vec![new_node, target]
    } else {
        vec![target, new_node]
    };
    LayoutNode::Split(SplitNode {
        id: split_id.to_owned(),
        direction,
        sizes: equal_sizes(children.len()),
        children,
    })
}

fn contains_pane(node: &LayoutNode, pane_id: &str) -> bool {
    match node {
        LayoutNode::Pane(pane) => pane.id == pane_id,
        LayoutNode::Split(split) => split
            .children
            .iter()
            .any(|child| contains_pane(child, pane_id)),
    }
}

const fn edge_direction(edge: TabDropEdge) -> SplitDirection {
    match edge {
        TabDropEdge::Left | TabDropEdge::Right => SplitDirection::Horizontal,
        TabDropEdge::Top | TabDropEdge::Bottom => SplitDirection::Vertical,
    }
}
