//! Guard direct UI prose and accessible text; data, selectors and CSS are exempt.
use lkjstr_core::{appearance::Language, words};
use std::{fs, path::Path};

fn visit(path: &Path, files: &mut Vec<std::path::PathBuf>) -> std::io::Result<()> {
    for entry in fs::read_dir(path)? {
        let path = entry?.path();
        if path.is_dir() {
            visit(&path, files)?;
        } else if path.extension().is_some_and(|e| e == "rs") {
            files.push(path);
        }
    }
    Ok(())
}

#[test]
fn views_have_no_literal_prose_or_accessible_labels() -> std::io::Result<()> {
    let root = Path::new(env!("CARGO_MANIFEST_DIR")).join("../lkjstr-web/src/ui");
    let mut files = vec![];
    visit(&root, &mut files)?;
    let mut errors = vec![];
    for path in files {
        let source = fs::read_to_string(&path).unwrap_or_default();
        for line in source
            .lines()
            .filter(|line| !line.trim_start().starts_with("//"))
        {
            let mut rest = line;
            while let Some(start) = rest.find('"') {
                let end = rest
                    .as_bytes()
                    .iter()
                    .enumerate()
                    .skip(start + 1)
                    .find(|(i, b)| {
                        **b == b'"'
                            && rest.as_bytes()[..*i]
                                .iter()
                                .rev()
                                .take_while(|b| **b == b'\\')
                                .count()
                                % 2
                                == 0
                    })
                    .map(|(i, _)| i);
                let Some(end) = end else {
                    break;
                };
                let prefix = rest[..start].trim_end();
                let raw = &rest[start..=end];
                let text: String = serde_json::from_str(raw).unwrap_or_default();
                let prose = text.chars().any(char::is_alphabetic);
                let direct = prefix.ends_with('>') && !prefix.ends_with("=>");
                let attr = [
                    "title=",
                    "aria-label=",
                    "placeholder=",
                    "alt=",
                    "data-label=",
                ]
                .iter()
                .any(|attr| prefix.ends_with(attr));
                if prose && (direct || attr) {
                    errors.push(format!("{}: literal UI text: {raw}", path.display()));
                }
                if prefix.ends_with("ui.tr(") || prefix.ends_with("ui.fmt(") {
                    let key = text
                        .rsplit_once(" (")
                        .map_or(text.as_str(), |(label, _)| label);
                    if !words::contains(&text) && !words::contains(key) {
                        errors.push(format!(
                            "{}: missing string table entry: {raw}",
                            path.display()
                        ));
                    }
                }
                rest = &rest[end + 1..];
            }
        }
    }
    assert!(errors.is_empty(), "{}", errors.join("\n"));
    Ok(())
}

#[test]
fn formatting_does_not_interpret_user_text_as_another_slot() {
    assert_eq!(
        words::format(Language::Japanese, "Replying to {0}", &["{1}さん"]),
        "{1}さんさんへの返信"
    );
    assert_eq!(
        words::format(Language::English, "{0} new · show", &["12"]),
        "12 new · show"
    );
}
