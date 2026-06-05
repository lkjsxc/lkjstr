#[derive(Clone, Debug, Eq, PartialEq)]
pub struct TextSegment {
    pub text: String,
    pub starts_at: usize,
    pub ends_at: usize,
}

#[must_use]
pub fn split_text_segments(
    content: &str,
    target_chars: usize,
    max_chars: usize,
) -> Vec<TextSegment> {
    if content.is_empty() {
        return Vec::new();
    }
    let safe_target = target_chars.max(1);
    let safe_max = max_chars.max(safe_target);
    let mut segments = Vec::new();
    let mut start = 0;
    while start < content.len() {
        let end = next_segment_end(content, start, safe_target, safe_max);
        segments.push(TextSegment {
            text: content[start..end].to_owned(),
            starts_at: start,
            ends_at: end,
        });
        start = end;
    }
    segments
}

fn next_segment_end(content: &str, start: usize, target_chars: usize, max_chars: usize) -> usize {
    let remaining = &content[start..];
    if remaining.chars().count() <= max_chars {
        return content.len();
    }
    let max_end = byte_after_chars(content, start, max_chars);
    let target_end = byte_after_chars(content, start, target_chars);
    preferred_boundary(content, start, target_end, max_end).unwrap_or(max_end)
}

fn preferred_boundary(
    content: &str,
    start: usize,
    target_end: usize,
    max_end: usize,
) -> Option<usize> {
    let min_end = start + (target_end.saturating_sub(start) / 2);
    let window = &content[start..max_end];
    for pattern in ["\n\n", "\n", " ", "\t"] {
        if let Some(relative) = window.rfind(pattern) {
            let end = start + relative + pattern.len();
            if end >= min_end && end > start && content.is_char_boundary(end) {
                return Some(end);
            }
        }
    }
    None
}

fn byte_after_chars(content: &str, start: usize, char_count: usize) -> usize {
    let mut seen = 0;
    for (relative, _) in content[start..].char_indices() {
        if seen == char_count {
            return start + relative;
        }
        seen += 1;
    }
    content.len()
}
