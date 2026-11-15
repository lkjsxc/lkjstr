use super::*;
use axum::{body::Body, http::Request};
use tower::ServiceExt;
#[test]
fn refuses_nonpublic_and_mixed_dns() {
    for ip in [
        "0.0.0.0",
        "10.1.2.3",
        "100.64.1.1",
        "127.0.0.1",
        "169.254.169.254",
        "172.16.0.1",
        "192.168.1.1",
        "192.0.0.1",
        "192.0.2.1",
        "192.88.99.1",
        "198.18.0.1",
        "198.51.100.1",
        "203.0.113.1",
        "224.0.0.1",
        "240.0.0.1",
        "255.255.255.255",
        "::",
        "::1",
        "::ffff:8.8.8.8",
        "fc00::1",
        "fe80::1",
        "ff02::1",
        "64:ff9b::a00:1",
        "2001:db8::1",
        "2001::1",
        "2002:808:808::1",
        "3fff::1",
    ] {
        assert!(
            !security::public(ip.parse().unwrap_or_else(|_| unreachable!())),
            "{ip}"
        );
    }
    assert!(security::public(
        "8.8.8.8".parse().unwrap_or_else(|_| unreachable!())
    ));
    assert!(security::public(
        "2606:4700:4700::1111"
            .parse()
            .unwrap_or_else(|_| unreachable!())
    ));
    assert!(security::checked(&[]).is_err());
    assert!(
        security::checked(&[
            "8.8.8.8:80".parse().unwrap_or_else(|_| unreachable!()),
            "127.0.0.1:80".parse().unwrap_or_else(|_| unreachable!())
        ])
        .is_err()
    );
}
#[test]
fn refuses_unsafe_targets() {
    for target in [
        "file:///etc/passwd",
        "ftp://example.com",
        "http://example.com:8080",
        "https://example.com:444",
        "http://user:pass@example.com",
        "http://127.1",
        "http://2130706433",
        "http://0x7f000001",
        "http://[::1]",
        "http://[::ffff:127.0.0.1]",
        "http://169.254.169.254/latest",
    ] {
        assert!(security::target(target).is_err());
    }
}
#[test]
fn metadata_and_japanese_encodings() {
    let url = security::target("https://example.com/story").unwrap_or_else(|_| unreachable!());
    for enc in [encoding_rs::SHIFT_JIS, encoding_rs::EUC_JP] {
        let html = format!(
            "<meta charset='{}'><meta property='og:title' content='日本語の記事'><meta property='og:image' content='/image.jpg'><title>last resort</title>",
            enc.name()
        );
        let bytes = enc.encode(&html).0.into_owned();
        let (p, _) = metadata::page(&url, &metadata::decode(&bytes, "text/html"));
        assert_eq!(p.title, "日本語の記事");
        assert_eq!(
            p.image_url.as_deref(),
            Some("https://example.com/image.jpg")
        );
    }
    let (p, discovered) = metadata::page(
        &url,
        "<meta name='twitter:title' content='Twitter title'><link rel='alternate' type='application/json+oembed' href='/embed'>",
    );
    assert_eq!(p.title, "Twitter title");
    assert_eq!(
        discovered.map(String::from).as_deref(),
        Some("https://example.com/embed")
    );
    let x = security::target("https://x.com/reader/status/123").unwrap_or_else(|_| unreachable!());
    assert!(metadata::x_endpoint(&x).is_some());
    let p = metadata::oembed(&x, br#"{"author_name":"Reader","author_url":"https://twitter.com/reader","html":"<blockquote><p>Post &amp; words</p><script>bad()</script></blockquote>"}"#, true).unwrap_or_else(|_| unreachable!());
    assert_eq!(p.title, "Reader (@reader)");
    assert_eq!(p.description, "Post & words");
    let (p, _) = metadata::page(
        &url,
        "<meta property='og:title' content=' '><meta name='twitter:title' content='Real title'><meta property='og:image' content=''><meta name='twitter:image' content='/real.jpg'>",
    );
    assert_eq!(p.title, "Real title");
    assert_eq!(p.image_url.as_deref(), Some("https://example.com/real.jpg"));
    let p = metadata::oembed(
        &x,
        br#"{"author_name":"Reader","html":"<p>First line<br>Second line</p>"}"#,
        true,
    )
    .unwrap_or_else(|_| unreachable!());
    assert_eq!(p.description, "First line Second line");
}
#[tokio::test]
async fn health_cors_rate_and_cache() {
    let dir = tempfile::tempdir().unwrap_or_else(|_| unreachable!());
    let app = app(dir.path().to_owned(), "https://lkjstr.lkjsxc.com".into())
        .unwrap_or_else(|_| unreachable!());
    for (origin, status) in [
        ("https://lkjstr.lkjsxc.com", 200),
        ("https://elsewhere.example", 403),
    ] {
        let request = Request::builder()
            .uri("/preview/health")
            .header("origin", origin)
            .body(Body::empty())
            .unwrap_or_else(|_| unreachable!());
        let response = app
            .clone()
            .oneshot(request)
            .await
            .unwrap_or_else(|_| unreachable!());
        assert_eq!(response.status().as_u16(), status);
        if status == 200 {
            assert_eq!(response.headers()["access-control-allow-origin"], origin);
        }
    }
    for n in 0..31 {
        let mut request = Request::builder()
            .uri("/preview?url=file:///bad")
            .body(Body::empty())
            .unwrap_or_else(|_| unreachable!());
        request.extensions_mut().insert(ConnectInfo(
            "127.0.0.1:1000"
                .parse::<SocketAddr>()
                .unwrap_or_else(|_| unreachable!()),
        ));
        assert_eq!(
            app.clone()
                .oneshot(request)
                .await
                .unwrap_or_else(|_| unreachable!())
                .status()
                .as_u16(),
            if n < 30 { 400 } else { 429 }
        );
    }
    let mut cache = cache::Cache::open(dir.path().to_owned()).unwrap_or_else(|_| unreachable!());
    let url = security::target("https://example.com/").unwrap_or_else(|_| unreachable!());
    cache.put(url.as_str(), Preview::fallback(&url), true);
    assert!(cache.get(url.as_str()).is_some());
    drop(cache);
    let mut cache = cache::Cache::open(dir.path().to_owned()).unwrap_or_else(|_| unreachable!());
    assert!(cache.get(url.as_str()).is_some());
    // Expired positive and negative entries are removed on restart, not served indefinitely.
    use sha2::{Digest, Sha256};
    for (ok, age) in [(true, 86401), (false, 3601)] {
        let key = format!("{:x}", Sha256::digest(url.as_str().as_bytes()));
        let entry = cache::Entry {
            at: cache::now().saturating_sub(age),
            ok,
            preview: Preview::fallback(&url),
        };
        std::fs::write(
            dir.path().join(key),
            serde_json::to_vec(&entry).unwrap_or_else(|_| unreachable!()),
        )
        .unwrap_or_else(|_| unreachable!());
        let mut cache =
            cache::Cache::open(dir.path().to_owned()).unwrap_or_else(|_| unreachable!());
        assert!(cache.get(url.as_str()).is_none());
    }
    for n in 0..2050 {
        cache.put(
            &format!("https://example.com/{n}"),
            Preview::fallback(&url),
            n % 2 == 0,
        );
    }
    assert!(
        std::fs::read_dir(dir.path())
            .unwrap_or_else(|_| unreachable!())
            .count()
            <= 2048
    );
}
