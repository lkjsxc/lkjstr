//! One six-second budget and 512 KiB across redirects, page and oEmbed discovery.
use super::{Preview, metadata, security};
use std::time::Duration;
use url::Url;
pub const MAX: usize = 512 * 1024;
#[derive(Default)]
pub struct Network {
    #[cfg(test)]
    pub endpoint: Option<std::net::SocketAddr>,
}
impl Network {
    async fn get(
        &self,
        mut url: Url,
        budget: &mut usize,
        redirects: &mut usize,
    ) -> Result<(Url, String, Vec<u8>), ()> {
        for _ in 0..=3 {
            security::target(url.as_str())?;
            #[cfg(not(test))]
            let addresses = security::resolve(&url).await?;
            #[cfg(test)]
            let addresses = if self.endpoint.is_some() && url.host_str() == Some("public.test") {
                vec!["8.8.8.8:80".parse().map_err(|_| ())?]
            } else {
                security::resolve(&url).await?
            };
            security::checked(&addresses)?;
            #[cfg(test)]
            let addresses = self
                .endpoint
                .filter(|_| url.host_str() == Some("public.test"))
                .map(|a| vec![a])
                .unwrap_or(addresses);
            let client = reqwest::Client::builder()
                .no_proxy()
                .redirect(reqwest::redirect::Policy::none())
                .connect_timeout(Duration::from_secs(3))
                .timeout(Duration::from_secs(6))
                .user_agent("PagePreview/1.0")
                .referer(false)
                .resolve_to_addrs(url.host_str().ok_or(())?, &addresses)
                .build()
                .map_err(|_| ())?;
            let mut response = client
                .get(url.clone())
                .header("Accept", "text/html, application/json")
                .header("Accept-Encoding", "identity")
                .send()
                .await
                .map_err(|_| ())?;
            if response.status().is_redirection() {
                if *redirects >= 3 {
                    return Err(());
                }
                *redirects += 1;
                let location = response
                    .headers()
                    .get("location")
                    .ok_or(())?
                    .to_str()
                    .map_err(|_| ())?;
                url = url.join(location).map_err(|_| ())?;
                continue;
            }
            if !response.status().is_success()
                || response
                    .content_length()
                    .is_some_and(|n| n > *budget as u64)
            {
                return Err(());
            }
            let mime = response
                .headers()
                .get("content-type")
                .and_then(|v| v.to_str().ok())
                .unwrap_or("")
                .to_owned();
            if !mime.starts_with("text/html")
                && !mime.starts_with("application/json")
                && !mime.starts_with("application/xhtml+xml")
            {
                return Err(());
            }
            let mut bytes = Vec::new();
            while let Some(chunk) = response.chunk().await.map_err(|_| ())? {
                if chunk.len() > *budget {
                    return Err(());
                }
                *budget -= chunk.len();
                bytes.extend_from_slice(&chunk);
            }
            return Ok((url, mime, bytes));
        }
        Err(())
    }
    pub async fn preview(&self, url: &Url) -> Result<Preview, ()> {
        tokio::time::timeout(Duration::from_secs(6), self.load(url))
            .await
            .map_err(|_| ())?
    }
    async fn load(&self, url: &Url) -> Result<Preview, ()> {
        let mut budget = MAX;
        let mut redirects = 0;
        if let Some(endpoint) = metadata::x_endpoint(url) {
            let (_, _, bytes) = self.get(endpoint, &mut budget, &mut redirects).await?;
            return metadata::oembed(url, &bytes, true);
        }
        let (final_url, mime, bytes) = self.get(url.clone(), &mut budget, &mut redirects).await?;
        let html = metadata::decode(&bytes, &mime);
        // Do not hold the non-Send DOM across an await.
        let (mut preview, discovery) = metadata::page(&final_url, &html);
        if preview.title.is_empty()
            && let Some(endpoint) = discovery
            && let Ok((_, _, bytes)) = self.get(endpoint, &mut budget, &mut redirects).await
            && let Ok(found) = metadata::oembed(&final_url, &bytes, false)
        {
            preview = found;
        }
        if preview.title.is_empty() {
            preview.title = metadata::html_title(&html);
        }
        if preview.title.is_empty() && preview.description.is_empty() && preview.image_url.is_none()
        {
            return Err(());
        }
        Ok(preview)
    }
}
