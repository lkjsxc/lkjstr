use leptos::prelude::{Callable, Callback};

#[derive(Clone)]
pub struct ProfileCopyProvider {
    run: Callback<ProfileCopyCommand>,
}

#[derive(Clone)]
pub struct ProfileCopyCommand {
    pub label: String,
    pub value: String,
    pub complete: ProfileCopyComplete,
}

#[derive(Clone)]
pub struct ProfileCopyComplete {
    complete: Callback<ProfileCopyResult>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct ProfileCopyResult {
    pub label: String,
    pub status: ProfileCopyStatus,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum ProfileCopyStatus {
    Copied,
    Failed(String),
}

impl ProfileCopyComplete {
    pub fn complete(&self, result: ProfileCopyResult) {
        let _unused = self.complete.try_run(result);
    }
}

impl ProfileCopyResult {
    #[must_use]
    pub fn copied(label: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            status: ProfileCopyStatus::Copied,
        }
    }

    #[must_use]
    pub fn failed(label: impl Into<String>, reason: impl Into<String>) -> Self {
        Self {
            label: label.into(),
            status: ProfileCopyStatus::Failed(reason.into()),
        }
    }
}

impl ProfileCopyProvider {
    #[must_use]
    pub fn new(run: impl Fn(ProfileCopyCommand) + Send + Sync + 'static) -> Self {
        Self {
            run: Callback::new(run),
        }
    }

    #[must_use]
    pub fn unavailable() -> Self {
        Self::new(|command| {
            command.complete.complete(ProfileCopyResult::failed(
                command.label,
                "clipboard unavailable in this host",
            ));
        })
    }

    pub fn copy(&self, label: String, value: String, complete: Callback<ProfileCopyResult>) {
        self.run.run(ProfileCopyCommand {
            label,
            value,
            complete: ProfileCopyComplete { complete },
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Arc, Mutex, MutexGuard};

    #[test]
    fn profile_copy_provider_completes_captured_command() {
        let copied = Arc::new(Mutex::new(None::<(String, String)>));
        let copied_capture = copied.clone();
        let provider = ProfileCopyProvider::new(move |command| {
            lock(&copied_capture).replace((command.label.clone(), command.value.clone()));
            command
                .complete
                .complete(ProfileCopyResult::copied(command.label));
        });
        let result = Arc::new(Mutex::new(None::<ProfileCopyResult>));
        let result_capture = result.clone();

        provider.copy(
            "npub".to_owned(),
            "npub1rust".to_owned(),
            Callback::new(move |next| {
                lock(&result_capture).replace(next);
            }),
        );

        assert_eq!(
            lock(&copied).as_ref(),
            Some(&("npub".to_owned(), "npub1rust".to_owned()))
        );
        assert_eq!(
            lock(&result).as_ref(),
            Some(&ProfileCopyResult::copied("npub"))
        );
    }

    fn lock<T>(mutex: &Mutex<T>) -> MutexGuard<'_, T> {
        match mutex.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        }
    }
}
