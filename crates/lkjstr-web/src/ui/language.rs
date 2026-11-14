//! Browser language preference and formatting through the shared string table.
use super::Ui;
use leptos::prelude::*;
use lkjstr_core::appearance::Language;

impl Ui {
    pub fn language(&self) -> Language {
        self.settings.with(|s| s.language).unwrap_or_else(|| {
            let languages = web_sys::window()
                .map(|w| {
                    w.navigator()
                        .languages()
                        .iter()
                        .filter_map(|v| v.as_string())
                        .collect::<Vec<_>>()
                })
                .unwrap_or_default();
            lkjstr_core::appearance::language(&languages)
        })
    }

    pub fn tr(&self, source: &str) -> String {
        if let Some(number) = source
            .strip_prefix("Workspace ")
            .filter(|n| n.parse::<u8>().is_ok_and(|n| (1..=9).contains(&n)))
        {
            return format!(
                "{} {number}",
                lkjstr_core::words::text(self.language(), "Workspace")
            );
        }
        let translated = lkjstr_core::words::text(self.language(), source);
        if translated != source {
            return translated.to_owned();
        }
        if let Some((label, shortcut)) = source.rsplit_once(" (") {
            return format!(
                "{} ({shortcut}",
                lkjstr_core::words::text(self.language(), label)
            );
        }
        lkjstr_core::words::text(self.language(), source).to_owned()
    }

    pub fn fmt(&self, source: &str, values: &[&str]) -> String {
        lkjstr_core::words::format(self.language(), source, values)
    }
}
