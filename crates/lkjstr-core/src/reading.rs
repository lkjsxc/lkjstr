//! Preserve authored text, removing only empty URL lines around block content.
use crate::content::Segment;

fn block(segment: &Segment) -> bool {
    matches!(
        segment,
        Segment::Image(_) | Segment::Video(_) | Segment::Audio(_) | Segment::Quote { .. }
    )
}
pub fn comfortable_segments(parts: Vec<Segment>) -> Vec<Segment> {
    let mut result = Vec::new();
    for (index, part) in parts.iter().enumerate() {
        if let Segment::Text(text) = part {
            let mut text = text.as_str();
            if index > 0 && block(&parts[index - 1]) {
                text = text.trim_start_matches(char::is_whitespace);
            }
            if parts.get(index + 1).is_some_and(block) {
                text = text.trim_end_matches(char::is_whitespace);
            }
            if !text.is_empty() {
                result.push(Segment::Text(text.to_owned()));
            }
        } else {
            result.push(part.clone());
        }
    }
    result
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn removes_empty_media_lines_without_flattening_prose() {
        assert_eq!(
            comfortable_segments(vec![
                Segment::Text("one\n\ntwo\n".into()),
                Segment::Image("x".into()),
                Segment::Text("\n#three".into())
            ]),
            vec![
                Segment::Text("one\n\ntwo".into()),
                Segment::Image("x".into()),
                Segment::Text("#three".into())
            ]
        );
    }
}

#[derive(Debug, PartialEq, Eq)]
pub enum Part {
    Text(Vec<Segment>),
    Images(Vec<String>),
    Block(Segment),
}
/// Adjacent image URL lines become one gallery; text order remains authored.
pub fn group(parts: Vec<Segment>) -> Vec<Part> {
    let mut result = Vec::new();
    for segment in comfortable_segments(parts) {
        match segment {
            Segment::Image(url) => match result.last_mut() {
                Some(Part::Images(urls)) => urls.push(url),
                _ => result.push(Part::Images(vec![url])),
            },
            segment if block(&segment) => result.push(Part::Block(segment)),
            segment => match result.last_mut() {
                Some(Part::Text(parts)) => parts.push(segment),
                _ => result.push(Part::Text(vec![segment])),
            },
        }
    }
    result
}

/// Names interpret custom emoji only; links and markup remain literal text.
pub fn name_parts(text: &str, emojis: &[(String, String)]) -> Vec<Segment> {
    let mut result = Vec::new();
    let mut plain = String::new();
    let mut rest = text;
    while let Some(ch) = rest.chars().next() {
        let emoji = rest
            .strip_prefix(':')
            .and_then(|s| s.split_once(':'))
            .and_then(|(code, _)| emojis.iter().find(|(name, _)| name == code));
        if let Some((code, url)) = emoji {
            if !plain.is_empty() {
                result.push(Segment::Text(std::mem::take(&mut plain)));
            }
            result.push(Segment::Emoji {
                code: code.clone(),
                url: url.clone(),
            });
            rest = &rest[code.len() + 2..];
        } else {
            plain.push(ch);
            rest = &rest[ch.len_utf8()..];
        }
    }
    if !plain.is_empty() {
        result.push(Segment::Text(plain));
    }
    result
}

/// A removable local script heuristic; mixed-language notes match both.
pub fn language_matches(text: &str, japanese: bool) -> bool {
    if japanese {
        text.chars()
            .any(|c| matches!(c as u32,0x3040..=0x30ff|0x3400..=0x9fff))
    } else {
        text.chars().any(|c| c.is_ascii_alphabetic())
    }
}
