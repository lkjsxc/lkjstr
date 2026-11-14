//! Structural edits: add, move, close and resize.

use super::{
    Dir, Node, NodeId, Pane, Split, TabId, Zone, activate, find_pane, map_panes, norm_sizes,
    normalize, pane_of_tab, remove_tab,
};

fn zone_dir(zone: Zone) -> Dir {
    match zone {
        Zone::Left | Zone::Right => Dir::Row,
        _ => Dir::Col,
    }
}

fn zone_after(zone: Zone) -> bool {
    matches!(zone, Zone::Right | Zone::Bottom)
}

/// A joining child takes 1/n, given up by siblings at least that large.
fn insert_equal(mut split: Split, at: usize, fresh: Node) -> Split {
    let share = 1.0 / (split.children.len() + 1) as f64;
    let donors: f64 = split.sizes.iter().filter(|size| **size >= share).sum();
    let mut sizes: Vec<f64> = split
        .sizes
        .iter()
        .map(|size| {
            if *size >= share && donors > 0.0 {
                size - share * size / donors
            } else {
                *size
            }
        })
        .collect();
    let at = at.min(split.children.len());
    sizes.insert(at, share);
    split.children.insert(at, fresh);
    split.sizes = sizes;
    split
}

fn split_pane(node: Node, target: NodeId, fresh: Pane, zone: Zone, split_id: NodeId) -> Node {
    let dir = zone_dir(zone);
    let after = zone_after(zone);
    match node {
        Node::Pane(pane) if pane.id == target => {
            let children = if after {
                vec![Node::Pane(pane), Node::Pane(fresh)]
            } else {
                vec![Node::Pane(fresh), Node::Pane(pane)]
            };
            Node::Split(Split {
                id: split_id,
                dir,
                children,
                sizes: vec![0.5, 0.5],
            })
        }
        Node::Pane(pane) => Node::Pane(pane),
        Node::Split(split) => {
            let index = split
                .children
                .iter()
                .position(|child| matches!(child, Node::Pane(pane) if pane.id == target));
            match index {
                Some(index) if split.dir == dir => Node::Split(insert_equal(
                    split,
                    index + usize::from(after),
                    Node::Pane(fresh),
                )),
                _ => Node::Split(Split {
                    children: split
                        .children
                        .into_iter()
                        .map(|child| split_pane(child, target, fresh.clone(), zone, split_id))
                        .collect(),
                    ..split
                }),
            }
        }
    }
}

/// Adds `tab` to pane `target`: in its stack (`Center`) or as a new pane on
/// one side. `ids` supplies fresh node ids. Returns the new tree and the pane
/// that holds the tab.
pub fn add_tab(
    root: Node,
    target: NodeId,
    tab: TabId,
    zone: Zone,
    ids: &mut impl FnMut() -> NodeId,
) -> (Node, NodeId) {
    if zone == Zone::Center {
        let fallback = root.clone();
        let next = map_panes(root, &mut |mut pane| {
            if pane.id == target {
                pane.tabs.push(tab);
                pane.active = tab;
            }
            Some(pane)
        });
        return (next.unwrap_or(fallback), target);
    }
    let fresh = Pane {
        id: ids(),
        tabs: vec![tab],
        active: tab,
    };
    let fresh_id = fresh.id;
    let split_id = ids();
    let next = split_pane(root.clone(), target, fresh, zone, split_id);
    (normalize(next).unwrap_or(root), fresh_id)
}

/// Moves a tab. With `Center` and an index, inserts at that position of the
/// target strip (reorder). Returns the tree and the pane now holding the tab.
pub fn move_tab(
    root: Node,
    tab: TabId,
    target: NodeId,
    zone: Zone,
    index: Option<usize>,
    ids: &mut impl FnMut() -> NodeId,
) -> (Node, NodeId) {
    let Some(source) = pane_of_tab(&root, tab).cloned() else {
        return (root, target);
    };
    if find_pane(&root, target).is_none() {
        return (root, source.id);
    }
    if let (Zone::Center, Some(index)) = (zone, index) {
        return (reorder(root, tab, target, index), target);
    }
    if source.id == target && (zone == Zone::Center || source.tabs.len() == 1) {
        return (activate(root, tab), target);
    }
    let fallback = root.clone();
    let Some(removed) = remove_tab(root, tab) else {
        return (fallback, source.id);
    };
    if find_pane(&removed, target).is_none() {
        return (fallback, source.id);
    }
    add_tab(removed, target, tab, zone, ids)
}

fn reorder(root: Node, tab: TabId, target: NodeId, index: usize) -> Node {
    let from = find_pane(&root, target).and_then(|pane| pane.tabs.iter().position(|t| *t == tab));
    let at = match from {
        Some(from) if from < index => index - 1,
        _ => index,
    };
    let fallback = root.clone();
    map_panes(root, &mut |mut pane| {
        pane.tabs.retain(|item| *item != tab);
        if pane.id == target {
            let at = at.min(pane.tabs.len());
            pane.tabs.insert(at, tab);
            pane.active = tab;
        }
        Some(pane)
    })
    .unwrap_or(fallback)
}

pub fn resize(root: Node, split_id: NodeId, sizes: &[f64]) -> Node {
    match root {
        Node::Pane(pane) => Node::Pane(pane),
        Node::Split(split) if split.id == split_id && sizes.len() == split.children.len() => {
            Node::Split(Split {
                sizes: norm_sizes(sizes),
                ..split
            })
        }
        Node::Split(split) => Node::Split(Split {
            children: split
                .children
                .into_iter()
                .map(|child| resize(child, split_id, sizes))
                .collect(),
            ..split
        }),
    }
}

pub fn close_pane(root: Node, pane_id: NodeId) -> Option<Node> {
    map_panes(root, &mut |pane| (pane.id != pane_id).then_some(pane))
}
