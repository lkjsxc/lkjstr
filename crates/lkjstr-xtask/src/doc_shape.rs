const REQUIRED_TASK_HEADINGS: &[&str] = &[
    "Purpose",
    "Status",
    "Current Evidence",
    "Next Edit",
    "Files To Read",
    "Files To Touch",
    "Focused Gate",
    "Acceptance",
    "Must Not",
];

const REQUIRED_SKILL_HEADINGS: &[&str] = &[
    "Purpose",
    "Trigger",
    "Read First",
    "Files Likely Touched",
    "Procedure",
    "Focused Gate",
    "Final Gate",
    "Must Not",
    "Handoff",
];

pub fn check_task_doc_shape(problems: &mut Vec<String>, rel: &str, text: &str) {
    check_required_headings(
        problems,
        rel,
        text,
        "docs/execution/tasks/",
        "task doc",
        REQUIRED_TASK_HEADINGS,
    );
}

pub fn check_skill_doc_shape(problems: &mut Vec<String>, rel: &str, text: &str) {
    check_required_headings(
        problems,
        rel,
        text,
        "docs/agent/skills/",
        "skill doc",
        REQUIRED_SKILL_HEADINGS,
    );
}

fn check_required_headings(
    problems: &mut Vec<String>,
    rel: &str,
    text: &str,
    prefix: &str,
    label: &str,
    headings: &[&str],
) {
    if !rel.starts_with(prefix) || rel == format!("{prefix}README.md") {
        return;
    }
    for heading in headings {
        let marker = format!("## {heading}");
        if !text.lines().any(|line| line == marker.as_str()) {
            problems.push(format!("{rel}: {label} missing {heading}"));
        }
    }
}
