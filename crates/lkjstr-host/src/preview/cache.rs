//! At most 2048 entries on disk and in memory, oldest written dropped. Filenames are hashes.
use super::Preview;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{collections::BTreeMap, path::PathBuf};
const LIMIT: usize = 2048;
#[derive(Clone, Serialize, Deserialize)]
pub struct Entry {
    pub at: u64,
    pub ok: bool,
    pub preview: Preview,
}
pub struct Cache {
    root: PathBuf,
    entries: BTreeMap<String, Entry>,
}
pub fn now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}
impl Cache {
    pub fn open(root: PathBuf) -> std::io::Result<Self> {
        std::fs::create_dir_all(&root)?;
        let mut cache = Self {
            root,
            entries: BTreeMap::new(),
        };
        for file in std::fs::read_dir(&cache.root)?.flatten() {
            let name = file.file_name().to_string_lossy().into_owned();
            if name.len() != 64 || !name.bytes().all(|c| c.is_ascii_hexdigit()) {
                continue;
            }
            let entry = file
                .metadata()
                .ok()
                .filter(|m| m.len() <= 32768)
                .and_then(|_| std::fs::read(file.path()).ok())
                .and_then(|b| serde_json::from_slice::<Entry>(&b).ok());
            if let Some(e) = entry.filter(Self::fresh) {
                cache.entries.insert(name, e);
            } else {
                let _ = std::fs::remove_file(file.path());
            }
        }
        cache.prune();
        Ok(cache)
    }
    fn fresh(e: &Entry) -> bool {
        now().saturating_sub(e.at) < if e.ok { 86400 } else { 3600 }
    }
    fn key(url: &str) -> String {
        format!("{:x}", Sha256::digest(url.as_bytes()))
    }
    fn prune(&mut self) {
        while self.entries.len() > LIMIT {
            let key = self
                .entries
                .iter()
                .min_by_key(|(_, e)| e.at)
                .map(|(k, _)| k.clone());
            if let Some(key) = key {
                self.entries.remove(&key);
                let _ = std::fs::remove_file(self.root.join(key));
            }
        }
    }
    pub fn get(&mut self, url: &str) -> Option<Entry> {
        let key = Self::key(url);
        let entry = self.entries.get(&key)?;
        if Self::fresh(entry) {
            return Some(entry.clone());
        }
        self.entries.remove(&key);
        let _ = std::fs::remove_file(self.root.join(key));
        None
    }
    pub fn put(&mut self, url: &str, preview: Preview, ok: bool) {
        let key = Self::key(url);
        let entry = Entry {
            at: now(),
            ok,
            preview,
        };
        if let Ok(bytes) = serde_json::to_vec(&entry) {
            // One writer holds the cache mutex. Rename never leaves a partial entry after a crash.
            let temporary = self.root.join("pending");
            if std::fs::write(&temporary, bytes).is_ok() {
                let _ = std::fs::rename(temporary, self.root.join(&key));
            }
        }
        self.entries.insert(key, entry);
        self.prune();
    }
}
