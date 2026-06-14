pub fn nostr_entities(content: &str) -> Vec<String> {
    let bytes = content.as_bytes();
    let mut items = Vec::new();
    let mut index = 0;
    while index + 6 <= bytes.len() {
        if starts_nostr_at(bytes, index) && is_boundary(bytes, index) {
            let start = index + 6;
            let end = scan_entity_end(bytes, start);
            if end > start {
                items.push(content[start..end].to_owned());
            }
            index = end;
        } else {
            index += 1;
        }
    }
    items
}

fn starts_nostr_at(bytes: &[u8], index: usize) -> bool {
    bytes[index..].len() >= 6 && bytes[index..index + 6].eq_ignore_ascii_case(b"nostr:")
}

fn is_boundary(bytes: &[u8], index: usize) -> bool {
    index == 0 || !is_ascii_word(bytes[index - 1])
}

fn scan_entity_end(bytes: &[u8], start: usize) -> usize {
    let mut end = start;
    while end < bytes.len() && bytes[end].is_ascii_alphanumeric() {
        end += 1;
    }
    end
}

fn is_ascii_word(byte: u8) -> bool {
    byte.is_ascii_alphanumeric() || byte == b'_'
}
