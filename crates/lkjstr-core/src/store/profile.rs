//! Kind 0 metadata, parsed leniently: unknown or malformed fields are empty.

use serde_json::Value;

/// Longest field kept; profile JSON is untrusted and sometimes enormous.
const MAX_FIELD: usize = 2000;

#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct Profile {
    pub name: String,
    pub display_name: String,
    pub about: String,
    pub picture: String,
    pub banner: String,
    pub nip05: String,
    pub lud16: String,
    pub website: String,
}

impl Profile {
    pub fn parse(content: &str) -> Profile {
        let Ok(Value::Object(map)) = serde_json::from_str::<Value>(content) else {
            return Profile::default();
        };
        let field = |names: &[&str]| -> String {
            names
                .iter()
                .find_map(|name| map.get(*name).and_then(Value::as_str))
                .map(|text| text.trim().chars().take(MAX_FIELD).collect())
                .unwrap_or_default()
        };
        let url = |names: &[&str]| -> String {
            let value = field(names);
            if value.starts_with("https://") || value.starts_with("http://") {
                value
            } else {
                String::new()
            }
        };
        Profile {
            name: field(&["name", "username"]),
            display_name: field(&["display_name", "displayName"]),
            about: field(&["about"]),
            picture: url(&["picture", "image"]),
            banner: url(&["banner"]),
            nip05: field(&["nip05"]),
            lud16: field(&["lud16"]),
            website: url(&["website"]),
        }
    }

    /// Best human label, if the profile has one.
    pub fn label(&self) -> Option<&str> {
        [&self.display_name, &self.name]
            .into_iter()
            .map(String::as_str)
            .find(|text| !text.is_empty())
    }
}
