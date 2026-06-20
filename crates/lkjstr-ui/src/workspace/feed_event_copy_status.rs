use std::time::Duration;

use leptos::prelude::*;

use crate::workspace::profile_clipboard_provider::{ProfileCopyResult, ProfileCopyStatus};

const COPY_STATUS_RESET_MS: u64 = 1200;

#[derive(Clone, Copy)]
pub(super) struct FeedEventCopyStatus {
    status: RwSignal<Option<String>>,
    generation: RwSignal<u64>,
}

impl FeedEventCopyStatus {
    pub(super) fn new() -> Self {
        Self {
            status: RwSignal::new(None),
            generation: RwSignal::new(0),
        }
    }

    pub(super) fn signal(&self) -> RwSignal<Option<String>> {
        self.status
    }

    pub(super) fn show(&self, result: ProfileCopyResult) {
        let generation = next_copy_status_generation(self.generation.get_untracked());
        self.generation.set(generation);
        self.status.set(Some(copy_event_status_text(result)));
        install_reset(*self, generation);
    }

    fn clear_if_current(&self, generation: u64) {
        if self.generation.try_get_untracked() == Some(generation) {
            let _unused = self.status.try_set(None);
        }
    }
}

fn install_reset(status: FeedEventCopyStatus, generation: u64) {
    set_timeout(
        move || status.clear_if_current(generation),
        copy_status_reset_delay(),
    );
}

pub(super) fn copy_event_status_text(result: ProfileCopyResult) -> String {
    match result.status {
        ProfileCopyStatus::Copied => "Copied".to_owned(),
        ProfileCopyStatus::Failed(reason) => format!("Copy failed: {reason}"),
    }
}

fn copy_status_reset_delay() -> Duration {
    Duration::from_millis(copy_status_reset_delay_ms())
}

fn copy_status_reset_delay_ms() -> u64 {
    COPY_STATUS_RESET_MS
}

fn next_copy_status_generation(current: u64) -> u64 {
    current.wrapping_add(1)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn copy_event_status_text_names_success_and_failure() {
        assert_eq!(
            copy_event_status_text(ProfileCopyResult::copied("event id")),
            "Copied"
        );
        assert_eq!(
            copy_event_status_text(ProfileCopyResult::failed("event id", "denied")),
            "Copy failed: denied"
        );
    }

    #[test]
    fn copy_status_reset_delay_matches_retained_lifecycle() {
        assert_eq!(copy_status_reset_delay_ms(), 1200);
    }

    #[test]
    fn copy_status_generation_advances_for_stale_resets() {
        assert_eq!(next_copy_status_generation(0), 1);
        assert_eq!(next_copy_status_generation(u64::MAX), 0);
    }
}
