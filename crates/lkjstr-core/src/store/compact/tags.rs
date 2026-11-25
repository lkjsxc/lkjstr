use super::{AtomRef, Id, Pool};
use std::{borrow::Cow, mem::size_of};

/// Flat fields and explicit boundaries preserve empty tags and duplicate fields.
/// usize offsets are native-addressable and four bytes in the WASM product.
#[derive(Debug)]
pub struct Tags {
    fields: Box<[AtomRef]>,
    offsets: Box<[usize]>,
}
impl Tags {
    pub(super) fn pack(tags: Vec<Vec<String>>, pool: &mut Pool) -> Self {
        // No tags need no boundaries; an actual empty tag still has two offsets.
        if tags.is_empty() {
            return Self {
                fields: Box::default(),
                offsets: Box::default(),
            };
        }
        let fields = tags.iter().map(Vec::len).sum();
        let mut values = Vec::with_capacity(fields);
        let mut offsets = Vec::with_capacity(tags.len() + 1);
        offsets.push(0);
        for tag in tags {
            values.extend(tag.into_iter().map(|value| pool.field(value)));
            offsets.push(values.len());
        }
        Self {
            fields: values.into_boxed_slice(),
            offsets: offsets.into_boxed_slice(),
        }
    }
    pub fn iter(&self) -> impl ExactSizeIterator<Item = &[AtomRef]> {
        self.offsets
            .windows(2)
            .map(|range| &self.fields[range[0]..range[1]])
    }
    pub fn values<'a>(&'a self, name: &'a str) -> impl Iterator<Item = Cow<'a, str>> {
        self.iter()
            .filter(move |tag| tag.first().is_some_and(|field| field.matches(name)))
            .filter_map(|tag| tag.get(1))
            .filter(|field| !field.matches(""))
            .map(|field| field.text())
    }
    /// Valid binary tag identities without hexadecimal materialization.
    pub fn ids<'a>(&'a self, name: &'a str) -> impl Iterator<Item = &'a Id> {
        self.iter()
            .filter(move |tag| tag.first().is_some_and(|field| field.matches(name)))
            .filter_map(|tag| tag.get(1).and_then(|field| field.key()))
    }
    pub fn to_vec(&self) -> Vec<Vec<String>> {
        self.iter()
            .map(|tag| tag.iter().map(|field| field.text().into_owned()).collect())
            .collect()
    }
    pub fn matches(&self, tags: &[Vec<String>]) -> bool {
        self.iter().len() == tags.len()
            && self.iter().zip(tags).all(|(left, right)| {
                left.len() == right.len() && left.iter().zip(right).all(|(a, b)| a.matches(b))
            })
    }
    pub(super) fn owned_bytes(&self) -> usize {
        self.fields.len() * size_of::<AtomRef>() + self.offsets.len() * size_of::<usize>()
    }
    pub(super) fn symbols_bytes(&self) -> usize {
        self.fields.iter().map(|field| field.managed_bytes()).sum()
    }
}
