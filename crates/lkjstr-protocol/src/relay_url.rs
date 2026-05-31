use url::Url;

pub fn normalize_relay_url(input: &str) -> Option<String> {
    let raw = if input.contains("://") {
        input.to_owned()
    } else {
        format!("wss://{input}")
    };
    let mut url = Url::parse(&raw).ok()?;
    match url.scheme() {
        "http" => url.set_scheme("ws").ok()?,
        "https" => url.set_scheme("wss").ok()?,
        "ws" | "wss" => {}
        _ => return None,
    }
    url.host_str()?;
    url.set_fragment(None);
    let path = collapse_path(url.path());
    url.set_path(&path);
    sort_query(&mut url);
    Some(url.to_string())
}

fn collapse_path(path: &str) -> String {
    let mut parts = Vec::new();
    for part in path.split('/') {
        if !part.is_empty() {
            parts.push(part);
        }
    }
    if parts.is_empty() {
        "/".to_owned()
    } else {
        format!("/{}", parts.join("/"))
    }
}

fn sort_query(url: &mut Url) {
    let pairs: Vec<(String, String)> = url
        .query_pairs()
        .map(|(key, value)| (key.into_owned(), value.into_owned()))
        .collect();
    if pairs.is_empty() {
        return;
    }
    let mut sorted = pairs;
    sorted.sort();
    url.set_query(None);
    {
        let mut query = url.query_pairs_mut();
        for (key, value) in sorted {
            query.append_pair(&key, &value);
        }
    }
}
