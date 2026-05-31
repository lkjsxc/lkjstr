use leptos::prelude::{Callable, Callback};
use lkjstr_storage::{SettingRecord, default_setting_records};
use serde_json::Value;

#[derive(Clone)]
pub struct SettingsResult {
    pub records: Vec<SettingRecord>,
    pub status: String,
}

#[derive(Clone)]
pub struct SettingsComplete {
    complete: Callback<SettingsResult>,
}

#[derive(Clone)]
pub enum SettingsCommand {
    Load(SettingsComplete),
    Save(SettingsValueCommand),
    Reset(SettingsKeyCommand),
    Import(SettingsImportCommand),
}

#[derive(Clone)]
pub struct SettingsValueCommand {
    pub key: String,
    pub value: Value,
    pub complete: SettingsComplete,
}

#[derive(Clone)]
pub struct SettingsKeyCommand {
    pub key: String,
    pub complete: SettingsComplete,
}

#[derive(Clone)]
pub struct SettingsImportCommand {
    pub raw: String,
    pub complete: SettingsComplete,
}

#[derive(Clone)]
pub struct SettingsProvider {
    run: Callback<SettingsCommand>,
}

impl SettingsComplete {
    pub fn complete(&self, result: SettingsResult) {
        self.complete.run(result);
    }
}

impl SettingsResult {
    #[must_use]
    pub fn new(records: Vec<SettingRecord>, status: impl Into<String>) -> Self {
        Self {
            records,
            status: status.into(),
        }
    }
}

impl SettingsProvider {
    #[must_use]
    pub fn new(run: impl Fn(SettingsCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn schema_only() -> Self {
        Self::new(|command| {
            let records = default_setting_records(0);
            let status = "Settings storage unavailable in this host";
            complete_command(command).complete(SettingsResult::new(records, status));
        })
    }

    pub fn load(&self, complete: Callback<SettingsResult>) {
        self.run
            .run(SettingsCommand::Load(SettingsComplete { complete }));
    }

    pub fn save(&self, key: String, value: Value, complete: Callback<SettingsResult>) {
        self.run.run(SettingsCommand::Save(SettingsValueCommand {
            key,
            value,
            complete: SettingsComplete { complete },
        }));
    }

    pub fn reset(&self, key: String, complete: Callback<SettingsResult>) {
        self.run.run(SettingsCommand::Reset(SettingsKeyCommand {
            key,
            complete: SettingsComplete { complete },
        }));
    }

    pub fn import_json(&self, raw: String, complete: Callback<SettingsResult>) {
        self.run.run(SettingsCommand::Import(SettingsImportCommand {
            raw,
            complete: SettingsComplete { complete },
        }));
    }
}

fn complete_command(command: SettingsCommand) -> SettingsComplete {
    match command {
        SettingsCommand::Load(complete) => complete,
        SettingsCommand::Save(command) => command.complete,
        SettingsCommand::Reset(command) => command.complete,
        SettingsCommand::Import(command) => command.complete,
    }
}
