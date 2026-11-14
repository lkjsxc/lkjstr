//! Unit-square geometry of panes, used for directional keyboard focus.

use super::{Dir, Node, NodeId, Zone};

#[derive(Clone, Copy, Debug, PartialEq)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub w: f64,
    pub h: f64,
}

impl Rect {
    fn center(&self) -> (f64, f64) {
        (self.x + self.w / 2.0, self.y + self.h / 2.0)
    }
}

pub fn pane_rects(root: &Node) -> Vec<(NodeId, Rect)> {
    let mut out = Vec::new();
    walk(
        root,
        Rect {
            x: 0.0,
            y: 0.0,
            w: 1.0,
            h: 1.0,
        },
        &mut out,
    );
    out
}

fn walk(node: &Node, rect: Rect, out: &mut Vec<(NodeId, Rect)>) {
    match node {
        Node::Pane(pane) => out.push((pane.id, rect)),
        Node::Split(split) => {
            let mut offset = 0.0;
            for (child, size) in split.children.iter().zip(&split.sizes) {
                let cell = match split.dir {
                    Dir::Row => Rect {
                        x: rect.x + offset * rect.w,
                        w: size * rect.w,
                        ..rect
                    },
                    Dir::Col => Rect {
                        y: rect.y + offset * rect.h,
                        h: size * rect.h,
                        ..rect
                    },
                };
                offset += size;
                walk(child, cell, out);
            }
        }
    }
}

const EPS: f64 = 1e-6;

/// The pane next to `from` in direction `zone` (not `Center`): it must lie
/// beyond the edge and overlap on the other axis; the closest wins, ties go to
/// the one whose centre is nearest.
pub fn neighbor(root: &Node, from: NodeId, zone: Zone) -> Option<NodeId> {
    let rects = pane_rects(root);
    let (_, origin) = rects.iter().find(|(id, _)| *id == from)?;
    let (ox, oy) = origin.center();
    rects
        .iter()
        .filter(|(id, _)| *id != from)
        .filter_map(|(id, rect)| {
            let overlap_x = rect.x < origin.x + origin.w - EPS && rect.x + rect.w > origin.x + EPS;
            let overlap_y = rect.y < origin.y + origin.h - EPS && rect.y + rect.h > origin.y + EPS;
            let gap = match zone {
                Zone::Left if overlap_y && rect.x + rect.w <= origin.x + EPS => {
                    origin.x - (rect.x + rect.w)
                }
                Zone::Right if overlap_y && rect.x >= origin.x + origin.w - EPS => {
                    rect.x - (origin.x + origin.w)
                }
                Zone::Top if overlap_x && rect.y + rect.h <= origin.y + EPS => {
                    origin.y - (rect.y + rect.h)
                }
                Zone::Bottom if overlap_x && rect.y >= origin.y + origin.h - EPS => {
                    rect.y - (origin.y + origin.h)
                }
                _ => return None,
            };
            let (cx, cy) = rect.center();
            let off_axis = match zone {
                Zone::Left | Zone::Right => (cy - oy).abs(),
                _ => (cx - ox).abs(),
            };
            Some((*id, gap, off_axis))
        })
        .min_by(|a, b| {
            (a.1, a.2)
                .partial_cmp(&(b.1, b.2))
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|(id, _, _)| id)
}
