//! Literal dependency forms emitted by the app build, adapter and WASM loader.
#[derive(Clone, Copy)]
enum Token<'a> {
    Word(&'a str),
    String(&'a str),
    Punct(u8),
    Other,
}
pub(super) struct Reference<'a> {
    pub target: &'a str,
    pub module: bool,
}
struct Tokens<'a> {
    text: &'a str,
    at: usize,
    regex: bool,
}
impl<'a> Tokens<'a> {
    fn new(text: &'a str) -> Self {
        Self {
            text,
            at: 0,
            regex: true,
        }
    }
    fn quoted(&mut self, quote: u8) -> Token<'a> {
        self.at += 1;
        let start = self.at;
        let bytes = self.text.as_bytes();
        while self.at < bytes.len() {
            match bytes[self.at] {
                b'\\' => self.at = (self.at + 2).min(bytes.len()),
                b if b == quote => {
                    let value = &self.text[start..self.at];
                    self.at += 1;
                    return if quote == 0x60 {
                        Token::Other
                    } else {
                        Token::String(value)
                    };
                }
                _ => self.at += 1,
            }
        }
        Token::Other
    }
    fn number(&mut self) {
        let bytes = self.text.as_bytes();
        let radix = match &bytes[self.at..] {
            [b'0', b'x' | b'X', ..] => 16,
            [b'0', b'o' | b'O', ..] => 8,
            [b'0', b'b' | b'B', ..] => 2,
            _ => 10,
        };
        let digit = |b: &u8| b.is_ascii_digit() || *b == b'_';
        if radix != 10 {
            self.at += 2;
            while bytes.get(self.at).is_some_and(|b| {
                *b == b'_'
                    || match radix {
                        16 => b.is_ascii_hexdigit(),
                        8 => (b'0'..=b'7').contains(b),
                        _ => matches!(b, b'0' | b'1'),
                    }
            }) {
                self.at += 1;
            }
        } else {
            while bytes.get(self.at).is_some_and(digit) {
                self.at += 1;
            }
            if bytes.get(self.at) == Some(&b'.') {
                self.at += 1;
                while bytes.get(self.at).is_some_and(digit) {
                    self.at += 1;
                }
            }
            if matches!(bytes.get(self.at), Some(b'e' | b'E')) {
                self.at += 1;
                if matches!(bytes.get(self.at), Some(b'+' | b'-')) {
                    self.at += 1;
                }
                while bytes.get(self.at).is_some_and(digit) {
                    self.at += 1;
                }
            }
        }
        if bytes.get(self.at) == Some(&b'n') {
            self.at += 1;
        }
    }
    fn regexp(&mut self) {
        self.at += 1;
        let bytes = self.text.as_bytes();
        let mut class = false;
        while self.at < bytes.len() {
            let byte = bytes[self.at];
            self.at += 1;
            match byte {
                b'\\' => self.at = (self.at + 1).min(bytes.len()),
                b'[' => class = true,
                b']' => class = false,
                b'/' if !class => break,
                _ => {}
            }
        }
        while bytes.get(self.at).is_some_and(u8::is_ascii_alphabetic) {
            self.at += 1;
        }
    }
}
impl<'a> Iterator for Tokens<'a> {
    type Item = Token<'a>;
    fn next(&mut self) -> Option<Self::Item> {
        let bytes = self.text.as_bytes();
        while self.at < bytes.len() {
            if bytes[self.at].is_ascii_whitespace() {
                self.at += 1;
                continue;
            }
            let rest = &bytes[self.at..];
            if rest.starts_with(b"//") {
                self.at += rest.iter().position(|b| *b == b'\n').unwrap_or(rest.len());
                continue;
            }
            if rest.starts_with(b"/*") {
                self.at += rest
                    .windows(2)
                    .position(|b| b == b"*/")
                    .map_or(rest.len(), |n| n + 2);
                continue;
            }
            let byte = bytes[self.at];
            let token = match byte {
                b'\'' | b'"' | 0x60 => self.quoted(byte),
                b'/' if self.regex => {
                    self.regexp();
                    Token::Other
                }
                b if b.is_ascii_digit()
                    || b == b'.' && bytes.get(self.at + 1).is_some_and(u8::is_ascii_digit) =>
                {
                    self.number();
                    Token::Other
                }
                b if b.is_ascii_alphabetic() || b == b'_' || b == b'$' => {
                    let start = self.at;
                    while bytes
                        .get(self.at)
                        .is_some_and(|b| b.is_ascii_alphanumeric() || *b == b'_' || *b == b'$')
                    {
                        self.at += 1;
                    }
                    Token::Word(&self.text[start..self.at])
                }
                b => {
                    self.at += 1;
                    Token::Punct(b)
                }
            };
            self.regex = match token {
                Token::Word(word) => {
                    matches!(word, "return" | "throw" | "case" | "yield" | "await")
                }
                Token::Punct(b) => !matches!(b, b')' | b']' | b'}'),
                _ => false,
            };
            return Some(token);
        }
        None
    }
}
pub(super) fn scripts(text: &str) -> Vec<Reference<'_>> {
    let mut refs = Vec::new();
    let (mut before, mut previous) = (Token::Other, Token::Other);
    for token in Tokens::new(text) {
        if let Token::String(target) = token {
            let module = matches!(previous, Token::Word("from" | "import"))
                || matches!(
                    (before, previous),
                    (Token::Word("import"), Token::Punct(b'('))
                );
            let url = matches!(
                (before, previous),
                (
                    Token::Word(
                        "URL"
                            | "url"
                            | "Worker"
                            | "SharedWorker"
                            | "fetch"
                            | "init"
                            | "importScripts"
                    ),
                    Token::Punct(b'(')
                )
            );
            if module || url {
                refs.push(Reference { target, module });
            }
        }
        before = previous;
        previous = token;
    }
    refs
}
pub(super) fn html(mut text: &str) -> Vec<Reference<'_>> {
    let mut refs = Vec::new();
    while let Some(start) = text.find('<') {
        text = &text[start + 1..];
        if text.starts_with("!--") {
            let Some(end) = text.find("-->") else { break };
            text = &text[end + 3..];
            continue;
        }
        let Some(end) = text.find('>') else { break };
        let mut tokens = Tokens::new(&text[..end]);
        if matches!(tokens.next(), Some(Token::Word("script" | "link"))) {
            let (mut before, mut previous) = (Token::Other, Token::Other);
            for token in tokens {
                if let (Token::Word("href" | "src"), Token::Punct(b'='), Token::String(target)) =
                    (before, previous, token)
                {
                    refs.push(Reference {
                        target,
                        module: false,
                    });
                }
                before = previous;
                previous = token;
            }
        }
        text = &text[end + 1..];
    }
    refs
}
