//! Metadata is untrusted text. Never return third-party embed markup.
use super::{Preview, security};
use scraper::{Html, Selector};
use serde_json::Value;
use url::Url;
fn select(s: &str) -> Option<Selector> {
    Selector::parse(s).ok()
}
fn clean(s: &str, limit: usize) -> String {
    s.chars()
        .filter(|c| !c.is_control() || c.is_whitespace())
        .collect::<String>()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .chars()
        .take(limit)
        .collect()
}
fn address(base: &Url, s: &str) -> Option<Url> {
    base.join(s)
        .ok()
        .and_then(|u| security::target(u.as_str()).ok())
}
pub fn decode(bytes: &[u8], mime: &str) -> String {
    let head = String::from_utf8_lossy(&bytes[..bytes.len().min(4096)]);
    let charset = mime
        .split(';')
        .find_map(|p| {
            let (name, value) = p.trim().split_once('=')?;
            name.eq_ignore_ascii_case("charset")
                .then(|| value.to_owned())
        })
        .or_else(|| {
            let doc = Html::parse_document(&head);
            select("meta")?.and_then_iter(&doc)
        });
    let encoding = charset
        .as_deref()
        .and_then(|c| encoding_rs::Encoding::for_label(c.trim_matches(['\'', '"']).as_bytes()))
        .unwrap_or(encoding_rs::UTF_8);
    encoding.decode(bytes).0.into_owned()
}
// Charset declarations may be HTML5 charset or the older http-equiv form.
trait Charset {
    fn and_then_iter(&self, doc: &Html) -> Option<String>;
}
impl Charset for Selector {
    fn and_then_iter(&self, doc: &Html) -> Option<String> {
        doc.select(self).find_map(|m| {
            m.value().attr("charset").map(str::to_owned).or_else(|| {
                m.value()
                    .attr("content")
                    .and_then(|c| c.split("charset=").nth(1))
                    .map(str::to_owned)
            })
        })
    }
}
pub fn html_title(html: &str) -> String {
    let doc = Html::parse_document(html);
    select("title")
        .and_then(|s| {
            doc.select(&s)
                .next()
                .map(|e| clean(&e.text().collect::<String>(), 500))
        })
        .unwrap_or_default()
}
pub fn page(base: &Url, html: &str) -> (Preview, Option<Url>) {
    let doc = Html::parse_document(html);
    let mut values = std::collections::BTreeMap::new();
    if let Some(sel) = select("meta") {
        for e in doc.select(&sel) {
            if let (Some(key), Some(value)) = (
                e.value()
                    .attr("property")
                    .or_else(|| e.value().attr("name")),
                e.value().attr("content"),
            ) {
                values.entry(key.to_lowercase()).or_insert(value.to_owned());
            }
        }
    }
    let get = |names: &[&str], limit| {
        names
            .iter()
            .filter_map(|n| values.get(*n))
            .map(|s| clean(s, limit))
            .find(|s| !s.is_empty())
            .unwrap_or_default()
    };
    let canonical = values
        .get("og:url")
        .filter(|s| !s.trim().is_empty())
        .and_then(|s| address(base, s))
        .or_else(|| {
            select("link[rel=canonical]").and_then(|s| {
                doc.select(&s)
                    .next()
                    .and_then(|e| address(base, e.value().attr("href")?))
            })
        })
        .unwrap_or_else(|| base.clone());
    let image = ["og:image", "twitter:image"]
        .iter()
        .filter_map(|key| values.get(*key))
        .filter(|s| !s.trim().is_empty())
        .find_map(|s| address(base, s))
        .map(String::from);
    let discovery = select("link").and_then(|s| {
        doc.select(&s).find_map(|e| {
            if e.value().attr("type") == Some("application/json+oembed")
                && e.value()
                    .attr("rel")
                    .is_some_and(|r| r.split_whitespace().any(|v| v == "alternate"))
            {
                address(base, e.value().attr("href")?)
            } else {
                None
            }
        })
    });
    (
        Preview {
            url: canonical.to_string(),
            site_name: {
                let site = get(&["og:site_name"], 120);
                if site.is_empty() {
                    base.host_str().unwrap_or("").into()
                } else {
                    site
                }
            },
            title: get(&["og:title", "twitter:title"], 500),
            description: get(
                &["og:description", "twitter:description", "description"],
                4000,
            ),
            image_url: image,
            kind: "page".into(),
        },
        discovery,
    )
}
pub fn x_endpoint(url: &Url) -> Option<Url> {
    if !matches!(
        url.host_str()?,
        "x.com" | "www.x.com" | "twitter.com" | "www.twitter.com"
    ) {
        return None;
    }
    let parts = url.path_segments()?.collect::<Vec<_>>();
    if parts.len() < 3
        || parts[1] != "status"
        || !parts[2].bytes().all(|c| c.is_ascii_digit())
        || parts[2].is_empty()
    {
        return None;
    }
    let mut endpoint = Url::parse("https://publish.twitter.com/oembed").ok()?;
    endpoint
        .query_pairs_mut()
        .append_pair("url", url.as_str())
        .append_pair("omit_script", "true")
        .append_pair("dnt", "true");
    Some(endpoint)
}
pub fn oembed(url: &Url, bytes: &[u8], x: bool) -> Result<Preview, ()> {
    let v: Value = serde_json::from_slice(bytes).map_err(|_| ())?;
    let text = |name: &str, limit| clean(v[name].as_str().unwrap_or(""), limit);
    let author = text("author_name", 200);
    let handle = v["author_url"]
        .as_str()
        .and_then(|s| Url::parse(s).ok())
        .and_then(|u| u.path_segments()?.next().map(str::to_owned))
        .unwrap_or_default();
    let doc = Html::parse_fragment(v["html"].as_str().unwrap_or(""));
    let description = select("p")
        .and_then(|s| {
            doc.select(&s)
                .next()
                .map(|e| clean(&e.text().collect::<Vec<_>>().join(" "), 4000))
        })
        .unwrap_or_default();
    Ok(Preview {
        url: url.to_string(),
        site_name: if x {
            "X".into()
        } else {
            text("provider_name", 120)
        },
        title: if x {
            clean(&format!("{author} (@{handle})"), 500)
        } else {
            text("title", 500)
        },
        description,
        image_url: v["thumbnail_url"]
            .as_str()
            .and_then(|s| address(url, s))
            .map(String::from),
        kind: if x { "post" } else { "page" }.into(),
    })
}
