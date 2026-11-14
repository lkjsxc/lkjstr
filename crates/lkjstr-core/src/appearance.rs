//! Deterministic presentation decisions, independent of the browser.
use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub enum Language {
    #[default]
    English,
    Japanese,
}

pub fn language(languages: &[String]) -> Language {
    for lang in languages {
        match lang.split('-').next().unwrap_or("") {
            "ja" => return Language::Japanese,
            "en" => return Language::English,
            _ => (),
        }
    }
    Language::English
}

pub fn avatar_hue(pubkey: &str) -> u32 {
    pubkey.bytes().fold(0u32, |acc, b| {
        acc.wrapping_mul(31).wrapping_add(u32::from(b))
    }) % 360
}

/// Date separators use the same UTC day boundaries as timestamp tooltips.
pub fn day_label(at: u64, now: u64) -> &'static str {
    match (now / 86_400).saturating_sub(at / 86_400) {
        0 => "Today",
        1 => "Yesterday",
        _ => "",
    }
}
