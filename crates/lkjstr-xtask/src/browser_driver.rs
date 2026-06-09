use std::{env, ffi::OsString, fs, path::PathBuf, process::Command};

pub fn chrome_driver_args() -> Vec<OsString> {
    matching_chromedriver()
        .map(|driver| vec![OsString::from("--chromedriver"), driver.into_os_string()])
        .unwrap_or_default()
}

fn matching_chromedriver() -> Option<PathBuf> {
    let chrome_major = installed_chrome_major()?;
    select_matching_driver(&chrome_major, driver_candidates())
}

fn installed_chrome_major() -> Option<String> {
    ["google-chrome", "chromium", "chromium-browser"]
        .into_iter()
        .find_map(command_major)
}

fn driver_candidates() -> Vec<PathBuf> {
    let mut candidates = vec![PathBuf::from("chromedriver")];
    candidates.extend(cached_driver_candidates());
    candidates.sort();
    candidates.dedup();
    candidates
}

fn cached_driver_candidates() -> Vec<PathBuf> {
    let Some(home) = env::var_os("HOME") else {
        return Vec::new();
    };
    let cache = PathBuf::from(home).join(".cache/.wasm-pack");
    let Ok(entries) = fs::read_dir(cache) else {
        return Vec::new();
    };
    entries
        .filter_map(|entry| entry.ok().map(|entry| entry.path().join("chromedriver")))
        .filter(|path| path.is_file())
        .collect()
}

fn select_matching_driver(chrome_major: &str, candidates: Vec<PathBuf>) -> Option<PathBuf> {
    let versions = candidates.into_iter().map(|candidate| {
        let major = command_major(candidate.as_os_str());
        (candidate, major)
    });
    select_matching_candidate(chrome_major, versions)
}

fn select_matching_candidate<I>(chrome_major: &str, candidates: I) -> Option<PathBuf>
where
    I: IntoIterator<Item = (PathBuf, Option<String>)>,
{
    candidates
        .into_iter()
        .find(|(_, major)| major.as_deref() == Some(chrome_major))
        .map(|(candidate, _)| candidate)
}

fn command_major<I>(program: I) -> Option<String>
where
    I: AsRef<std::ffi::OsStr>,
{
    let output = Command::new(program).arg("--version").output().ok()?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout);
    version_major(&text)
}

fn version_major(text: &str) -> Option<String> {
    text.split_whitespace()
        .find_map(|part| part.chars().next()?.is_ascii_digit().then_some(part))
        .and_then(|part| part.split('.').next())
        .filter(|major| !major.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use super::{select_matching_candidate, version_major};

    #[test]
    fn parses_chrome_major_versions() {
        assert_eq!(
            version_major("Google Chrome 148.0.7778.215"),
            Some("148".to_owned())
        );
        assert_eq!(
            version_major("ChromeDriver 149.0.7827.55"),
            Some("149".to_owned())
        );
        assert_eq!(version_major("not installed"), None);
    }

    #[test]
    fn selects_driver_matching_installed_chrome_major() {
        let candidates = vec![
            (PathBuf::from("driver-149"), Some("149".to_owned())),
            (PathBuf::from("driver-148"), Some("148".to_owned())),
            (PathBuf::from("driver-147"), Some("147".to_owned())),
        ];
        assert_eq!(
            select_matching_candidate("148", candidates),
            Some(PathBuf::from("driver-148"))
        );
    }
}
