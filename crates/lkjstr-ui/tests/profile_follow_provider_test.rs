use std::sync::{Arc, Mutex};

use leptos::prelude::Callback;
use lkjstr_ui::{
    ProfileFollowCommand, ProfileFollowProvider, ProfileFollowResult, ProfileFollowToggleCommand,
};

#[test]
fn profile_follow_provider_forwards_load_and_toggle_commands() -> Result<(), String> {
    let commands = Arc::new(Mutex::new(Vec::<String>::new()));
    let commands_capture = commands.clone();
    let provider = ProfileFollowProvider::new(move |command| match command {
        ProfileFollowCommand::Load(command) => {
            push(&commands_capture, format!("load:{}", command.target_pubkey));
            command
                .complete
                .complete(ProfileFollowResult::new(true, ""));
        }
        ProfileFollowCommand::Toggle(command) => {
            push_toggle(&commands_capture, &command);
            command
                .complete
                .complete(ProfileFollowResult::new(command.follow, ""));
        }
    });
    let result = Arc::new(Mutex::new(None::<ProfileFollowResult>));
    let result_capture = result.clone();

    provider.load(
        "a".repeat(64),
        "b".repeat(64),
        Callback::new(move |next| replace(&result_capture, next)),
    );
    provider.toggle(
        "a".repeat(64),
        "b".repeat(64),
        false,
        true,
        Callback::new(|_| {}),
    );

    assert_eq!(
        snapshot(&commands),
        vec![
            format!("load:{}", "b".repeat(64)),
            "toggle:false".to_owned()
        ]
    );
    assert_eq!(
        snapshot_result(&result),
        Some(ProfileFollowResult::new(true, ""))
    );
    Ok(())
}

#[test]
fn unavailable_profile_follow_provider_keeps_current_state() {
    let result = Arc::new(Mutex::new(None::<ProfileFollowResult>));
    let result_capture = result.clone();

    ProfileFollowProvider::unavailable().toggle(
        "a".repeat(64),
        "b".repeat(64),
        false,
        true,
        Callback::new(move |next| replace(&result_capture, next)),
    );

    assert_eq!(
        snapshot_result(&result),
        Some(ProfileFollowResult::new(
            true,
            "Profile follow publishing is not available in this host.",
        ))
    );
}

fn push_toggle(commands: &Arc<Mutex<Vec<String>>>, command: &ProfileFollowToggleCommand) {
    push(commands, format!("toggle:{}", command.follow));
}

fn push(commands: &Arc<Mutex<Vec<String>>>, value: String) {
    match commands.lock() {
        Ok(mut commands) => commands.push(value),
        Err(poisoned) => poisoned.into_inner().push(value),
    }
}

fn replace(slot: &Arc<Mutex<Option<ProfileFollowResult>>>, value: ProfileFollowResult) {
    match slot.lock() {
        Ok(mut slot) => {
            slot.replace(value);
        }
        Err(poisoned) => {
            poisoned.into_inner().replace(value);
        }
    }
}

fn snapshot(commands: &Arc<Mutex<Vec<String>>>) -> Vec<String> {
    match commands.lock() {
        Ok(commands) => commands.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}

fn snapshot_result(
    result: &Arc<Mutex<Option<ProfileFollowResult>>>,
) -> Option<ProfileFollowResult> {
    match result.lock() {
        Ok(result) => result.clone(),
        Err(poisoned) => poisoned.into_inner().clone(),
    }
}
