//! Fresh identities for replacement layouts; old draft/recovery keys stay owned.
use crate::{Workspace, layout::Node};

impl Workspace {
    pub(crate) fn fresh_ids(&mut self, base: u32) {
        fn shift(node: &mut Node, base: u32) {
            match node {
                Node::Pane(pane) => {
                    pane.id += base;
                    pane.active += base;
                    for tab in &mut pane.tabs {
                        *tab += base;
                    }
                }
                Node::Split(split) => {
                    split.id += base;
                    for child in &mut split.children {
                        shift(child, base);
                    }
                }
            }
        }
        shift(&mut self.root, base);
        self.tabs = std::mem::take(&mut self.tabs)
            .into_iter()
            .map(|(id, view)| (id + base, view))
            .collect();
        self.focus += base;
        self.next_id += base;
    }
}
