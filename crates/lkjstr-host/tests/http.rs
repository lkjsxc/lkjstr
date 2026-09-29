mod support;
use axum::{
    body::{Body, to_bytes},
    http::{Request, StatusCode},
};
use support::{Result, fixture};
use tower::ServiceExt;

#[tokio::test]
async fn serves_root_health_and_concrete_assets() -> Result {
    let root = fixture()?;
    let app = lkjstr_host::app(root.path())?;
    for (path, content_type) in [
        ("/", "text/html"),
        ("/index.html", "text/html"),
        ("/healthz", "text/plain"),
        ("/lkjstr-web-wasm/bridge.js", "text/javascript"),
        ("/lkjstr-web-wasm/snippets/inline0.js", "text/javascript"),
        ("/lkjstr-web-wasm/bridge.wasm", "application/wasm"),
        ("/sqlite/sqlite3.wasm", "application/wasm"),
        ("/lkjstr-web-wasm/asset-manifest.json", "application/json"),
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty())?)
            .await?;
        assert_eq!(response.status(), StatusCode::OK, "{path}");
        assert!(
            response.headers()["content-type"]
                .to_str()?
                .starts_with(content_type),
            "{path}"
        );
        assert_eq!(response.headers()["cache-control"], "no-cache");
        if path != "/healthz" {
            assert!(
                response.headers().get("vary").is_some_and(|v| v
                    .to_str()
                    .is_ok_and(|s| s.to_ascii_lowercase().contains("accept-encoding"))),
                "{path}: missing encoding cache variation"
            );
        }
        assert_eq!(response.headers()["x-content-type-options"], "nosniff");
        assert!(
            !response
                .headers()
                .contains_key("cross-origin-opener-policy")
        );
        assert!(
            !response
                .headers()
                .contains_key("cross-origin-embedder-policy")
        );
        let bytes = to_bytes(response.into_body(), 4096).await?;
        assert!(!bytes.is_empty(), "{path}");
        if path.ends_with(".wasm") {
            assert_eq!(bytes.as_ref(), support::WASM);
        }
    }
    Ok(())
}

#[tokio::test]
async fn head_has_metadata_but_no_body() -> Result {
    let root = fixture()?;
    let app = lkjstr_host::app(root.path())?;
    for path in ["/", "/healthz", "/sqlite/sqlite3.wasm"] {
        let response = app
            .clone()
            .oneshot(
                Request::builder()
                    .method("HEAD")
                    .uri(path)
                    .body(Body::empty())?,
            )
            .await?;
        assert_eq!(response.status(), StatusCode::OK);
        assert!(response.headers().contains_key("content-type"));
        assert!(to_bytes(response.into_body(), 4096).await?.is_empty());
    }
    Ok(())
}

#[tokio::test]
async fn absent_or_private_assets_are_not_success_html() -> Result {
    let root = fixture()?;
    let app = lkjstr_host::app(root.path())?;
    for path in [
        "/missing.js",
        "/unknown-route",
        "/lkjstr-web-wasm/missing.wasm",
        "/sqlite/",
        "/.private",
        "/%2eprivate",
        "/_headers",
        "/_redirects",
        "/%2e%2e/index.html",
        "/sqlite/%2e%2e/index.html",
        "/sqlite%5c..%5cindex.html",
        "/%00index.html",
    ] {
        let response = app
            .clone()
            .oneshot(Request::builder().uri(path).body(Body::empty())?)
            .await?;
        assert_eq!(response.status(), StatusCode::NOT_FOUND, "{path}");
        assert_eq!(response.headers()["cache-control"], "no-store");
        assert!(
            to_bytes(response.into_body(), 4096).await?.is_empty(),
            "{path}"
        );
    }
    Ok(())
}

#[tokio::test]
async fn rejects_all_mutating_and_options_methods() -> Result {
    let root = fixture()?;
    let app = lkjstr_host::app(root.path())?;
    for method in ["POST", "PUT", "PATCH", "DELETE", "OPTIONS", "TRACE"] {
        for path in ["/", "/healthz", "/missing.js"] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method(method)
                        .uri(path)
                        .body(Body::empty())?,
                )
                .await?;
            assert_eq!(response.status(), StatusCode::METHOD_NOT_ALLOWED);
            assert_eq!(response.headers()["allow"], "GET, HEAD");
            assert_eq!(response.headers()["cache-control"], "no-store");
        }
    }
    Ok(())
}

#[tokio::test]
async fn wasm_range_is_binary_and_revalidates() -> Result {
    let root = fixture()?;
    let app = lkjstr_host::app(root.path())?;
    let response = app
        .oneshot(
            Request::builder()
                .uri("/sqlite/sqlite3.wasm")
                .header("range", "bytes=0-3")
                .body(Body::empty())?,
        )
        .await?;
    assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT);
    assert_eq!(response.headers()["content-type"], "application/wasm");
    assert_eq!(response.headers()["cache-control"], "no-cache");
    assert_eq!(
        to_bytes(response.into_body(), 4096).await?.as_ref(),
        b"\0asm"
    );
    Ok(())
}
