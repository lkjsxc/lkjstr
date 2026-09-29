mod assets;

pub use assets::validate_root;
use axum::{
    Router,
    extract::Request,
    http::{Method, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use percent_encoding::percent_decode_str;
use std::{io, path::Path, time::Duration};
use tower_http::{services::ServeDir, timeout::TimeoutLayer};

/// Serve only verified, immutable deployment assets, never a source checkout.
pub fn app(root: &Path) -> io::Result<Router> {
    let root = validate_root(root)?;
    let files = ServeDir::new(root)
        .append_index_html_on_directories(true)
        .precompressed_br()
        .precompressed_gzip();
    Ok(Router::new()
        .route("/healthz", get(|| async { "ok lkjstr-host\n" }))
        .fallback_service(files)
        .layer(TimeoutLayer::with_status_code(
            StatusCode::REQUEST_TIMEOUT,
            Duration::from_secs(15),
        ))
        .layer(middleware::from_fn(policy)))
}

async fn policy(request: Request, next: Next) -> Response {
    let mut response = if request.method() != Method::GET && request.method() != Method::HEAD {
        (
            StatusCode::METHOD_NOT_ALLOWED,
            [(header::ALLOW, "GET, HEAD")],
        )
            .into_response()
    } else if !public_path(request.uri().path()) {
        StatusCode::NOT_FOUND.into_response()
    } else {
        next.run(request).await
    };
    let cache = if response.status().is_success() || response.status() == StatusCode::NOT_MODIFIED {
        "no-cache"
    } else {
        "no-store"
    };
    let headers = response.headers_mut();
    headers.insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static(cache),
    );
    headers.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        header::HeaderValue::from_static("nosniff"),
    );
    headers.insert(
        header::REFERRER_POLICY,
        header::HeaderValue::from_static("strict-origin-when-cross-origin"),
    );
    // Do not add blanket COOP/COEP: OPFS uses sahpool and Nostr media is cross-origin.
    response
}

fn public_path(path: &str) -> bool {
    let Ok(decoded) = percent_decode_str(path).decode_utf8() else {
        return false;
    };
    !decoded.contains('\\')
        && !decoded.contains('\0')
        && !decoded
            .split('/')
            .any(|part| part.starts_with('.') || matches!(part, "_headers" | "_redirects"))
}
