use leptos::prelude::{Callable, Callback};
use lkjstr_domain::{UploadProvider, UploadSettings, default_upload_settings};

#[derive(Clone)]
pub struct UploadSettingsResult {
    pub settings: UploadSettings,
    pub status: String,
}

#[derive(Clone)]
pub struct UploadSettingsComplete {
    complete: Callback<UploadSettingsResult>,
}

#[derive(Clone)]
pub enum UploadSettingsCommand {
    Load(UploadSettingsComplete),
    SaveProvider(UploadProviderCommand),
    SaveCustom(UploadTextCommand),
    SaveNoTransform(UploadBoolCommand),
    Discover(UploadDiscoverCommand),
}

#[derive(Clone)]
pub struct UploadProviderCommand {
    pub provider: UploadProvider,
    pub complete: UploadSettingsComplete,
}

#[derive(Clone)]
pub struct UploadTextCommand {
    pub text: String,
    pub complete: UploadSettingsComplete,
}

#[derive(Clone)]
pub struct UploadBoolCommand {
    pub value: bool,
    pub complete: UploadSettingsComplete,
}

#[derive(Clone)]
pub struct UploadDiscoverCommand {
    pub settings: UploadSettings,
    pub server: String,
    pub complete: UploadSettingsComplete,
}

#[derive(Clone)]
pub struct UploadSettingsProvider {
    run: Callback<UploadSettingsCommand>,
}

impl UploadSettingsComplete {
    pub fn complete(&self, result: UploadSettingsResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl UploadSettingsResult {
    #[must_use]
    pub fn new(settings: UploadSettings, status: impl Into<String>) -> Self {
        Self {
            settings,
            status: status.into(),
        }
    }
}

impl UploadSettingsProvider {
    #[must_use]
    pub fn new(run: impl Fn(UploadSettingsCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn unavailable() -> Self {
        Self::new(|command| {
            complete_command(command).complete(UploadSettingsResult::new(
                default_upload_settings(),
                "Upload settings storage unavailable in this host",
            ));
        })
    }

    pub fn load(&self, complete: Callback<UploadSettingsResult>) {
        self.run
            .run(UploadSettingsCommand::Load(UploadSettingsComplete {
                complete,
            }));
    }

    pub fn save_provider(
        &self,
        provider: UploadProvider,
        complete: Callback<UploadSettingsResult>,
    ) {
        self.run
            .run(UploadSettingsCommand::SaveProvider(UploadProviderCommand {
                provider,
                complete: UploadSettingsComplete { complete },
            }));
    }

    pub fn save_custom(&self, text: String, complete: Callback<UploadSettingsResult>) {
        self.run
            .run(UploadSettingsCommand::SaveCustom(UploadTextCommand {
                text,
                complete: UploadSettingsComplete { complete },
            }));
    }

    pub fn save_no_transform(&self, value: bool, complete: Callback<UploadSettingsResult>) {
        self.run
            .run(UploadSettingsCommand::SaveNoTransform(UploadBoolCommand {
                value,
                complete: UploadSettingsComplete { complete },
            }));
    }

    pub fn discover(
        &self,
        settings: UploadSettings,
        server: String,
        complete: Callback<UploadSettingsResult>,
    ) {
        self.run
            .run(UploadSettingsCommand::Discover(UploadDiscoverCommand {
                settings,
                server,
                complete: UploadSettingsComplete { complete },
            }));
    }
}

fn complete_command(command: UploadSettingsCommand) -> UploadSettingsComplete {
    match command {
        UploadSettingsCommand::Load(complete) => complete,
        UploadSettingsCommand::SaveProvider(command) => command.complete,
        UploadSettingsCommand::SaveCustom(command) => command.complete,
        UploadSettingsCommand::SaveNoTransform(command) => command.complete,
        UploadSettingsCommand::Discover(command) => command.complete,
    }
}
