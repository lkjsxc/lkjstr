//! Kind 0 metadata, parsed leniently: unknown or malformed fields are empty.

use serde_json::{
    Map, Value,
    value::{RawValue, to_raw_value},
};
use std::collections::BTreeMap;

/// Longest field kept; profile JSON is untrusted and sometimes enormous.
const MAX_FIELD: usize = 2000;
const MAX_CONTENT_BYTES: usize = 65_536;
const NAME_KEYS: [&str; 2] = ["name", "username"];
const DISPLAY_NAME_KEYS: [&str; 2] = ["display_name", "displayName"];
const PICTURE_KEYS: [&str; 2] = ["picture", "image"];
const EDIT_OPTIONAL: [&str; 5] = ["picture", "banner", "nip05", "website", "lud16"];

// Retain extension values verbatim, including JSON numbers beyond f64 precision.
type Metadata<'a> = BTreeMap<String, &'a RawValue>;

fn text_field(map: &Metadata<'_>, names: &[&str]) -> Option<String> {
    names
        .iter()
        .filter_map(|name| map.get(*name))
        .find_map(|value| serde_json::from_str(value.get()).ok())
}

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
        let Ok(map) = serde_json::from_str::<Metadata<'_>>(content) else {
            return Profile::default();
        };
        let field = |names: &[&str]| -> String {
            text_field(&map, names)
                .as_deref()
                .unwrap_or_default()
                .trim()
                .chars()
                .take(MAX_FIELD)
                .collect()
        };
        let url = |names: &[&str]| -> String {
            let value = field(names);
            if value.starts_with("https://") || value.starts_with("http://") {
                value
            } else {
                String::new()
            }
        };
        let image = |names: &[&str]| {
            let value = field(names);
            if Self::is_inline_image(&value) {
                value
            } else {
                url(names)
            }
        };
        Profile {
            name: field(&NAME_KEYS),
            display_name: field(&DISPLAY_NAME_KEYS),
            about: field(&["about"]),
            picture: image(&PICTURE_KEYS),
            banner: image(&["banner"]),
            nip05: field(&["nip05"]),
            lud16: field(&["lud16"]),
            website: url(&["website"]),
        }
    }

    /// Inline formats accepted as profile pictures; these use the browser's original-image route.
    pub(crate) fn is_inline_image(value: &str) -> bool {
        [
            "data:image/png;base64,",
            "data:image/jpeg;base64,",
            "data:image/webp;base64,",
            "data:image/svg+xml,",
        ]
        .iter()
        .any(|prefix| value.starts_with(prefix))
    }

    /// Best human label, if the profile has one.
    pub fn label(&self) -> Option<&str> {
        [&self.display_name, &self.name]
            .into_iter()
            .map(String::as_str)
            .find(|text| !text.is_empty())
    }

    pub(crate) fn edit_fields(content: Option<&str>) -> Value {
        let metadata = content
            .and_then(|content| serde_json::from_str::<Metadata<'_>>(content).ok())
            .unwrap_or_default();
        // The form edits the visible name. Take its unabridged value so a save
        // can preserve both the display alias and the separate Nostr handle.
        let name = text_field(&metadata, &DISPLAY_NAME_KEYS)
            .filter(|name| !name.trim().is_empty())
            .or_else(|| text_field(&metadata, &NAME_KEYS))
            .unwrap_or_default();
        let about = text_field(&metadata, &["about"]).unwrap_or_default();
        let mut fields = Map::from_iter([
            ("name".into(), Value::String(name)),
            ("about".into(), Value::String(about)),
        ]);
        for key in EDIT_OPTIONAL {
            let value = if key == "picture" {
                text_field(&metadata, &PICTURE_KEYS)
            } else {
                text_field(&metadata, &[key])
            };
            if let Some(value) = value {
                fields.insert(key.into(), Value::String(value));
            }
        }
        Value::Object(fields)
    }

    pub(crate) fn edit_content(
        previous: Option<&str>,
        edits: &str,
    ) -> Result<String, &'static str> {
        if edits.len() > MAX_CONTENT_BYTES {
            return Err("event-too-large");
        }
        let mut edits: Metadata<'_> = serde_json::from_str(edits).map_err(|_| "invalid-profile")?;
        let empty = to_raw_value("").map_err(|_| "serialization")?;
        let mut profile: Metadata<'_> = previous
            .and_then(|content| serde_json::from_str(content).ok())
            .unwrap_or_default();
        for key in ["name", "about"].into_iter().chain(EDIT_OPTIONAL) {
            let raw = edits.remove(key);
            let value = match raw {
                Some(raw) => serde_json::from_str::<Option<String>>(raw.get())
                    .map_err(|_| "invalid-profile")?
                    .unwrap_or_default(),
                None if matches!(key, "name" | "about") => continue,
                None => String::new(),
            };
            let clear = value.trim().is_empty();
            if key == "name" {
                // Keep the handle when either editor projection leaves the label unchanged.
                if !clear
                    && text_field(&profile, &DISPLAY_NAME_KEYS).is_some_and(|name| {
                        name.trim() == value.trim()
                            || name.trim().chars().take(MAX_FIELD).eq(value.trim().chars())
                    })
                {
                    continue;
                }
                for alias in DISPLAY_NAME_KEYS {
                    profile.remove(alias);
                }
            }
            let keys: &[&str] = match key {
                "name" => &NAME_KEYS,
                "picture" => &PICTURE_KEYS,
                _ => &[key],
            };
            if !value.is_empty() && text_field(&profile, keys).as_deref() == Some(value.as_str()) {
                continue;
            }
            if clear
                && keys
                    .get(1)
                    .is_some_and(|alias| profile.contains_key(*alias))
            {
                // An empty canonical value masks a retained legacy alias.
                profile.insert(key.into(), &empty);
            } else if clear {
                profile.remove(key);
            } else if let Some(raw) = raw {
                profile.insert(key.into(), raw);
            }
        }
        let content = serde_json::to_string(&profile).map_err(|_| "serialization")?;
        if content.len() > MAX_CONTENT_BYTES {
            return Err("event-too-large");
        }
        Ok(content)
    }
}

impl super::Store {
    /// The retained signed metadata index; iteration allocates no whole-directory snapshot.
    pub(crate) fn profile_entries(&self) -> impl Iterator<Item = (&str, &Profile)> {
        self.profiles
            .iter()
            .map(|(key, profile)| (key.as_str(), profile.as_ref()))
    }
}

#[cfg(test)]
mod tests {
    use super::Profile;

    #[test]
    fn extension_numbers_are_preserved_without_affecting_the_profile_label() {
        let previous = r#"{"name":"old","extension":1e9999}"#;
        let updated = Profile::edit_content(Some(previous), r#"{"name":"new"}"#);
        assert_eq!(
            updated.as_deref(),
            Ok(r#"{"extension":1e9999,"name":"new"}"#)
        );
        assert_eq!(
            Profile::parse(updated.as_deref().unwrap_or_default()).label(),
            Some("new")
        );
    }
}
