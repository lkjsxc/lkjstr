mod support;
use axum::{
    Router,
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use std::{collections::BTreeSet, path::Path, process::Command};
use support::{Result, fixture, write};
use tower::ServiceExt;

async fn read(app: &Router, path: &str, mime: &str) -> Result<String> {
    let response = app
        .clone()
        .oneshot(Request::builder().uri(path).body(Body::empty())?)
        .await?;
    assert_eq!(response.status(), StatusCode::OK, "{path}");
    assert!(
        response.headers()["content-type"]
            .to_str()?
            .starts_with(mime)
    );
    assert_eq!(response.headers()["cache-control"], "no-cache");
    Ok(String::from_utf8(
        to_bytes(response.into_body(), 1024 * 1024).await?.to_vec(),
    )?)
}

fn values<'a>(text: &'a str, start: &str, end: &str) -> Vec<&'a str> {
    text.split(start)
        .skip(1)
        .filter_map(|part| part.split_once(end).map(|(value, _)| value))
        .collect()
}

#[tokio::test]
async fn sitemap_pages_are_real_bilingual_documents_and_links_resolve() -> Result {
    let root = fixture()?;
    let repo = Path::new(env!("CARGO_MANIFEST_DIR")).join("../..");
    let output = Command::new("node")
        .arg(repo.join("web/scripts/site.ts"))
        .arg(root.path())
        .output()?;
    assert!(output.status.success(), "public-page generation failed");
    for name in ["privacy.html", "LICENSE.txt", "icon.svg", "icon-512.png"] {
        write(root.path(), name, b"linked asset fixture")?;
    }
    let app = lkjstr_host::app(root.path())?;
    let sitemap = read(&app, "/sitemap.txt", "text/plain").await?;
    let robots = read(&app, "/robots.txt", "text/plain").await?;
    assert!(robots.contains("Sitemap: https://lkjstr.lkjsxc.com/sitemap.txt"));
    let urls: Vec<_> = sitemap.lines().collect();
    assert_eq!(urls.len(), 16);
    assert_eq!(urls.iter().collect::<BTreeSet<_>>().len(), urls.len());
    assert!(urls.contains(&"https://lkjstr.lkjsxc.com/"));
    assert!(urls.contains(&"https://lkjstr.lkjsxc.com/privacy.html"));
    for missing in ["/sitemap.xml", "/en/missing.html", "/ja/missing.html"] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(missing).body(Body::empty())?)
            .await?;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{missing}");
    }
    let mut titles = BTreeSet::new();
    let mut en = BTreeSet::new();
    let mut ja = BTreeSet::new();
    for url in urls {
        let path = url
            .strip_prefix("https://lkjstr.lkjsxc.com")
            .ok_or("origin")?;
        let html = read(&app, path, "text/html").await?;
        if path == "/" || path == "/privacy.html" {
            continue;
        }
        assert!(html.contains(&format!("<link rel=\"canonical\" href=\"{url}\">")));
        assert_eq!(html.matches("<h1>").count(), 1, "{path}");
        assert_eq!(html.matches("<title>").count(), 1, "{path}");
        assert!(!html.contains("<script"));
        for code in ["en", "ja", "x-default"] {
            let lang = if code == "x-default" { "en" } else { code };
            let page = path.rsplit('/').next().ok_or("page")?;
            assert!(html.contains(&format!("rel=\"alternate\" hreflang=\"{code}\" href=\"https://lkjstr.lkjsxc.com/{lang}/{page}\"")));
        }
        let title = values(&html, "<title>", "</title>")[0];
        assert!(titles.insert(title.to_owned()), "duplicate title: {path}");
        if let Some(page) = path.strip_prefix("/en/") {
            en.insert(page.to_owned());
        } else if let Some(page) = path.strip_prefix("/ja/") {
            ja.insert(page.to_owned());
        } else {
            return Err("unexpected sitemap language".into());
        }
        for target in values(&html, "href=\"", "\"") {
            let target = target
                .strip_prefix("https://lkjstr.lkjsxc.com")
                .unwrap_or(target);
            if target.starts_with('/') {
                // All local page, language, footer and asset links must resolve through the host.
                let response = app
                    .clone()
                    .oneshot(Request::builder().uri(target).body(Body::empty())?)
                    .await?;
                assert_eq!(response.status(), StatusCode::OK, "{path} -> {target}");
            }
        }
    }
    assert_eq!(en, ja);
    assert_eq!(en.len(), 7);
    Ok(())
}
