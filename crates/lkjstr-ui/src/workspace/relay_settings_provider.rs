use leptos::prelude::{Callable, Callback, RwSignal, Set};
use lkjstr_domain::{RelayPatch, RelayPurpose, RelaySet};

#[derive(Clone)]
pub struct RelaySettingsResult {
    pub sets: Vec<RelaySet>,
    pub selected_default_id: String,
    pub status: String,
}

#[derive(Clone)]
pub struct RelaySettingsComplete {
    complete: Callback<RelaySettingsResult>,
}

#[derive(Clone)]
pub enum RelaySettingsCommand {
    Load(RelaySettingsComplete),
    Add(RelayInputCommand),
    Patch(RelayPatchCommand),
    Remove(RelayIdCommand),
    Restore(RelayPurposeCommand),
    MakeDefault(RelaySetIdCommand),
}

#[derive(Clone)]
pub struct RelayInputCommand {
    pub set_id: String,
    pub input: String,
    pub complete: RelaySettingsComplete,
}

#[derive(Clone)]
pub struct RelayPatchCommand {
    pub set_id: String,
    pub url: String,
    pub patch: RelayPatch,
    pub complete: RelaySettingsComplete,
}

#[derive(Clone)]
pub struct RelayIdCommand {
    pub set_id: String,
    pub url: String,
    pub complete: RelaySettingsComplete,
}

#[derive(Clone)]
pub struct RelayPurposeCommand {
    pub purpose: RelayPurpose,
    pub complete: RelaySettingsComplete,
}

#[derive(Clone)]
pub struct RelaySetIdCommand {
    pub set_id: String,
    pub complete: RelaySettingsComplete,
}

#[derive(Clone)]
pub struct RelaySettingsProvider {
    run: Callback<RelaySettingsCommand>,
}

impl RelaySettingsComplete {
    pub fn complete(&self, result: RelaySettingsResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl RelaySettingsResult {
    #[must_use]
    pub fn new(
        sets: Vec<RelaySet>,
        selected_default_id: String,
        status: impl Into<String>,
    ) -> Self {
        Self {
            sets,
            selected_default_id,
            status: status.into(),
        }
    }
}

impl RelaySettingsProvider {
    #[must_use]
    pub fn new(run: impl Fn(RelaySettingsCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn storage_unavailable() -> Self {
        Self::new(|command| {
            complete_command(command).complete(RelaySettingsResult::new(
                Vec::new(),
                "public-default".to_owned(),
                "Relay settings storage unavailable in this host",
            ));
        })
    }

    pub fn load(&self, complete: Callback<RelaySettingsResult>) {
        self.run
            .run(RelaySettingsCommand::Load(RelaySettingsComplete {
                complete,
            }));
    }

    pub fn add(&self, set_id: String, input: String, complete: Callback<RelaySettingsResult>) {
        self.run.run(RelaySettingsCommand::Add(RelayInputCommand {
            set_id,
            input,
            complete: RelaySettingsComplete { complete },
        }));
    }

    pub fn patch(
        &self,
        set_id: String,
        url: String,
        patch: RelayPatch,
        complete: Callback<RelaySettingsResult>,
    ) {
        self.run.run(RelaySettingsCommand::Patch(RelayPatchCommand {
            set_id,
            url,
            patch,
            complete: RelaySettingsComplete { complete },
        }));
    }

    pub fn remove(&self, set_id: String, url: String, complete: Callback<RelaySettingsResult>) {
        self.run.run(RelaySettingsCommand::Remove(RelayIdCommand {
            set_id,
            url,
            complete: RelaySettingsComplete { complete },
        }));
    }

    pub fn restore(&self, purpose: RelayPurpose, complete: Callback<RelaySettingsResult>) {
        self.run
            .run(RelaySettingsCommand::Restore(RelayPurposeCommand {
                purpose,
                complete: RelaySettingsComplete { complete },
            }));
    }

    pub fn make_default(&self, set_id: String, complete: Callback<RelaySettingsResult>) {
        self.run
            .run(RelaySettingsCommand::MakeDefault(RelaySetIdCommand {
                set_id,
                complete: RelaySettingsComplete { complete },
            }));
    }
}

fn complete_command(command: RelaySettingsCommand) -> RelaySettingsComplete {
    match command {
        RelaySettingsCommand::Load(complete) => complete,
        RelaySettingsCommand::Add(command) => command.complete,
        RelaySettingsCommand::Patch(command) => command.complete,
        RelaySettingsCommand::Remove(command) => command.complete,
        RelaySettingsCommand::Restore(command) => command.complete,
        RelaySettingsCommand::MakeDefault(command) => command.complete,
    }
}

pub fn run_relay_settings_result(
    sets: RwSignal<Vec<RelaySet>>,
    selected_default_id: RwSignal<String>,
    status: RwSignal<String>,
    run: impl FnOnce(Callback<RelaySettingsResult>) + 'static,
) {
    let complete = Callback::new(move |result: RelaySettingsResult| {
        let _unused = sets.try_set(result.sets);
        let _unused = selected_default_id.try_set(result.selected_default_id);
        let _unused = status.try_set(result.status);
    });
    run(complete);
}
