use leptos::prelude::{Callable, Callback};
use lkjstr_domain::Workspace;
use lkjstr_storage::TabStateRecord;

#[derive(Clone)]
pub struct WorkspacePersistence {
    save: Callback<Workspace>,
    save_tab_snapshot: Callback<TabStateRecord>,
}

impl WorkspacePersistence {
    #[must_use]
    pub fn new(save: impl Fn(Workspace) + Send + Sync + 'static) -> Self {
        Self {
            save: Callback::new(save),
            save_tab_snapshot: Callback::new(|_: TabStateRecord| {}),
        }
    }

    #[must_use]
    pub fn with_tab_snapshots(
        save: impl Fn(Workspace) + Send + Sync + 'static,
        save_tab_snapshot: impl Fn(TabStateRecord) + Send + Sync + 'static,
    ) -> Self {
        Self {
            save: Callback::new(save),
            save_tab_snapshot: Callback::new(save_tab_snapshot),
        }
    }

    pub fn save(&self, workspace: Workspace) {
        self.save.run(workspace);
    }

    pub fn save_tab_snapshot(&self, row: TabStateRecord) {
        self.save_tab_snapshot.run(row);
    }
}
