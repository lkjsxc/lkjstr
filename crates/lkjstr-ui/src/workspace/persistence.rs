use leptos::prelude::{Callable, Callback};
use lkjstr_domain::Workspace;

#[derive(Clone)]
pub struct WorkspacePersistence {
    save: Callback<Workspace>,
}

impl WorkspacePersistence {
    #[must_use]
    pub fn new(save: impl Fn(Workspace) + Send + Sync + 'static) -> Self {
        Self {
            save: Callback::new(save),
        }
    }

    pub fn save(&self, workspace: Workspace) {
        self.save.run(workspace);
    }
}
