use super::{Id, accounting::Charge, decode_id, encode_id};
use std::{borrow::Cow, hash::Hash, sync::Arc};

pub type AtomRef = Arc<Atom>;
#[derive(Debug, PartialEq, Eq, Hash)]
pub(super) enum Value {
    Key(Id),
    Text(Box<str>),
}
/// Borrowed dictionary probes hash and compare the same logical values as
/// owned atoms, without allocating a candidate string on a hit.
#[derive(PartialEq, Eq, Hash)]
pub(super) enum ValueRef<'a> {
    Key(&'a Id),
    Text(&'a str),
}
impl Value {
    pub(super) fn borrowed(&self) -> ValueRef<'_> {
        match self {
            Self::Key(key) => ValueRef::Key(key),
            Self::Text(text) => ValueRef::Text(text),
        }
    }
}
#[derive(Debug)]
pub struct Atom {
    pub(super) value: Value,
    pub(super) charge: Charge,
}
impl Atom {
    pub fn text(&self) -> Cow<'_, str> {
        match &self.value {
            Value::Key(key) => Cow::Owned(encode_id(key)),
            Value::Text(text) => Cow::Borrowed(text),
        }
    }
    pub fn as_str(&self) -> Option<&str> {
        match &self.value {
            Value::Text(text) => Some(text),
            Value::Key(_) => None,
        }
    }
    pub fn key(&self) -> Option<&Id> {
        match &self.value {
            Value::Key(key) => Some(key),
            Value::Text(_) => None,
        }
    }
    pub fn matches(&self, text: &str) -> bool {
        match &self.value {
            Value::Key(key) => decode_id(text).as_ref() == Some(key),
            Value::Text(value) => value.as_ref() == text,
        }
    }
    pub fn managed_bytes(&self) -> usize {
        self.charge.bytes()
    }
}
impl PartialEq for Atom {
    fn eq(&self, other: &Self) -> bool {
        self.value == other.value
    }
}
impl Eq for Atom {}
impl Hash for Atom {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        self.value.hash(state);
    }
}
