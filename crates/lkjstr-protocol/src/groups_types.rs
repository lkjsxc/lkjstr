use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupMetadata {
    pub group_id: String,
    pub name: Option<String>,
    pub about: Option<String>,
    pub picture: Option<String>,
    pub public: Option<bool>,
    pub open: Option<bool>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupAdmin {
    pub pubkey: String,
    pub roles: Vec<String>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupMember {
    pub pubkey: String,
    pub label: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupRole {
    pub role: String,
    pub description: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupReference {
    pub relay: Option<String>,
    pub group_id: String,
}

#[derive(Debug, Clone, Eq, PartialEq, Serialize, Deserialize)]
pub struct GroupPreviousRef {
    pub event_id: String,
    pub relay: Option<String>,
}

#[derive(Debug, Clone, Eq, PartialEq)]
pub enum GroupParseError {
    WrongKind,
    MissingGroupId,
    BadContent,
}
