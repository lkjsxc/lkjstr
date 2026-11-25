use super::{Lease, OrderKey};
use std::{borrow::Borrow, cmp::Ordering};

/// A one-pointer index key whose order is always event time and actual ID.
/// The lease prevents dangling index entries without reusable numeric slots.
#[derive(Debug, Clone)]
pub struct OrderedEvent(pub Lease);
impl Borrow<OrderKey> for OrderedEvent {
    fn borrow(&self) -> &OrderKey {
        &self.0.order
    }
}
impl PartialEq for OrderedEvent {
    fn eq(&self, other: &Self) -> bool {
        self.0.order == other.0.order
    }
}
impl Eq for OrderedEvent {}
impl PartialOrd for OrderedEvent {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}
impl Ord for OrderedEvent {
    fn cmp(&self, other: &Self) -> Ordering {
        self.0.order.cmp(&other.0.order)
    }
}
