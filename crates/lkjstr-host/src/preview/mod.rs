//! Optional same-origin preview service; no account, cookie, key or relay ownership.
mod cache;
mod fetch;
#[cfg(test)]
mod fetch_test;
mod metadata;
mod security;
#[cfg(test)]
mod tests;
use axum::{
    Json, Router,
    extract::{ConnectInfo, Query, State},
    http::{HeaderMap, StatusCode, header},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::get,
};
use serde::{Deserialize, Serialize};
use std::{
    collections::BTreeMap,
    net::{IpAddr, SocketAddr},
    path::PathBuf,
    sync::{Arc, Mutex},
};
use tokio::sync::Semaphore;
#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Preview {
    pub url: String,
    pub site_name: String,
    pub title: String,
    pub description: String,
    pub image_url: Option<String>,
    pub kind: String,
}
impl Preview {
    fn fallback(url: &url::Url) -> Self {
        Self {
            url: url.to_string(),
            site_name: url.host_str().unwrap_or("").into(),
            title: url.path().chars().take(500).collect(),
            description: String::new(),
            image_url: None,
            kind: "link".into(),
        }
    }
}
struct Service {
    origin: String,
    cache: Mutex<cache::Cache>,
    // At most 4096 clients; expired minute buckets dropped, new clients refused at capacity.
    rate: Mutex<BTreeMap<IpAddr, (u64, u32)>>,
    slots: Semaphore,
}
pub fn app(cache_dir: PathBuf, origin: String) -> std::io::Result<Router> {
    let state = Arc::new(Service {
        origin,
        cache: Mutex::new(cache::Cache::open(cache_dir)?),
        rate: Mutex::new(BTreeMap::new()),
        slots: Semaphore::new(8),
    });
    Ok(Router::new()
        .route(
            "/preview/health",
            get(|| async { Json(serde_json::json!({"ok":true,"version":1})) }),
        )
        .route("/preview", get(preview))
        .with_state(state.clone())
        .layer(middleware::from_fn_with_state(state, headers)))
}
async fn headers(
    State(s): State<Arc<Service>>,
    request: axum::extract::Request,
    next: Next,
) -> Response {
    let origin = request.headers().get(header::ORIGIN).cloned();
    let mut response = if origin
        .as_ref()
        .is_some_and(|o| o.as_bytes() != s.origin.as_bytes())
    {
        StatusCode::FORBIDDEN.into_response()
    } else {
        next.run(request).await
    };
    let h = response.headers_mut();
    h.insert(
        header::CACHE_CONTROL,
        header::HeaderValue::from_static("no-store"),
    );
    h.insert(
        header::X_CONTENT_TYPE_OPTIONS,
        header::HeaderValue::from_static("nosniff"),
    );
    h.insert(
        header::REFERRER_POLICY,
        header::HeaderValue::from_static("no-referrer"),
    );
    h.insert(header::VARY, header::HeaderValue::from_static("Origin"));
    if let Some(o) = origin.filter(|o| o.as_bytes() == s.origin.as_bytes()) {
        h.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, o);
    }
    response
}
#[derive(Deserialize)]
struct Args {
    url: String,
}
async fn preview(
    State(s): State<Arc<Service>>,
    ConnectInfo(peer): ConnectInfo<SocketAddr>,
    headers: HeaderMap,
    Query(args): Query<Args>,
) -> Response {
    // Only the loopback edge may supply an address, with an overwritten X-Real-IP.
    let client = if peer.ip().is_loopback() {
        headers
            .get("x-real-ip")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse().ok())
            .unwrap_or(peer.ip())
    } else {
        peer.ip()
    };
    if !allow(&s, client) {
        return StatusCode::TOO_MANY_REQUESTS.into_response();
    }
    let Ok(url) = security::target(&args.url) else {
        return StatusCode::BAD_REQUEST.into_response();
    };
    if let Some(e) = s.cache.lock().ok().and_then(|mut c| c.get(url.as_str())) {
        return Json(e.preview).into_response();
    }
    let Ok(_slot) = s.slots.try_acquire() else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };
    let result = fetch::Network::default().preview(&url).await;
    let ok = result.is_ok();
    let answer = result.unwrap_or_else(|_| Preview::fallback(&url));
    if let Ok(mut c) = s.cache.lock() {
        c.put(url.as_str(), answer.clone(), ok);
    }
    Json(answer).into_response()
}
fn allow(s: &Service, ip: IpAddr) -> bool {
    let Ok(mut rates) = s.rate.lock() else {
        return false;
    };
    let now = cache::now() / 60;
    rates.retain(|_, (at, _)| *at == now);
    if rates.len() >= 4096 && !rates.contains_key(&ip) {
        return false;
    }
    let entry = rates.entry(ip).or_insert((now, 0));
    entry.1 += 1;
    entry.1 <= 30
}
