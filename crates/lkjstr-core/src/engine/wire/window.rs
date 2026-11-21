//! Translate window intents and keep projected edges consistent with their rows.
use super::{Anchor, Query, Session};
use crate::engine::{Engine, protocol::Input, windows::HEAD_ROWS};
use serde_json::Value;

pub(super) struct Request {
    pub anchor: Anchor,
    pub before: usize,
    pub after: usize,
    pub retain_above: bool,
    pub live_above: bool,
    pub head_through: Option<String>,
}

impl Session {
    pub(super) fn window(
        &mut self,
        sub: String,
        request: Request,
        engine: &Engine,
    ) -> Result<Vec<Input>, (Option<String>, &'static str)> {
        let query = self
            .queries
            .get(&sub)
            .ok_or((None, "unknown-subscription"))?;
        if let Anchor::Time { at } = request.anchor {
            if Query::convert(query)
                .as_ref()
                .is_some_and(crate::engine::time_window::supported)
            {
                self.visibility_navigation.insert(sub.clone());
                self.windows.remove(&sub);
                self.return_keys.remove(&sub);
                self.head_tails.remove(&sub);
            }
            return Ok(vec![Input::WindowAtTime {
                sub,
                at,
                before: request.before,
                after: request.after,
            }]);
        }
        let account = query.account.as_deref();
        let tail = request.head_through.filter(|key| {
            matches!(request.anchor, Anchor::Top(_))
                && matches!(
                    query.source.as_str(),
                    "home"
                        | "their-home"
                        | "global"
                        | "profile"
                        | "hashtag"
                        | "notifications"
                        | "channel"
                        | "bookmarks"
                        | "search"
                        | "relay"
                )
                && key.len() <= 256
                && self
                    .delivered
                    .get(&sub)
                    .is_some_and(|rows| rows.iter().any(|r| r["key"].as_str() == Some(key)))
                && engine.accepts_private_anchor(account, key)
        });
        if let Some(through) = tail {
            let after = request.after.clamp(1, HEAD_ROWS);
            if self
                .windows
                .get(&sub)
                .is_some_and(|(key, _, _)| key.is_some())
            {
                self.visibility_navigation.insert(sub.clone());
            }
            self.windows.insert(sub.clone(), (None, 0, after));
            self.head_tails.insert(sub.clone(), through.clone());
            return Ok(vec![Input::FollowHead {
                sub,
                through,
                after: after - 1,
            }]);
        }
        let anchor = match request.anchor {
            Anchor::Top(_) => None,
            Anchor::Time { .. } => unreachable!(),
            Anchor::Key { key } => self.search_header_anchor(&sub, &key).unwrap_or(Some(key)),
            Anchor::Month {
                month,
                offset,
                return_key,
            } => {
                let return_key = return_key
                    .and_then(|key| self.search_header_anchor(&sub, &key).unwrap_or(Some(key)));
                if let Some(key) =
                    return_key.filter(|key| engine.accepts_private_anchor(account, key))
                {
                    self.return_keys.insert(sub.clone(), key);
                }
                Some(
                    self.timelines
                        .get(&sub)
                        .and_then(|i| i.key(month, offset))
                        .ok_or((None, "timeline-unavailable"))?,
                )
            }
        };
        let anchor = anchor.filter(|key| engine.accepts_private_anchor(account, key));
        let retain_above = request.retain_above && !request.live_above;
        let mut before = if retain_above {
            6000
        } else {
            request.before.min(800)
        };
        // A retained grouped window still needs room to prepend new groups.
        if !retain_above
            && !request.live_above
            && (query.source == "notifications" || query.notifications == Some(true))
        {
            before = self.notification_before(&sub, engine, anchor.as_deref(), before);
        }
        self.head_tails.remove(&sub);
        if self
            .windows
            .get(&sub)
            .and_then(|(key, _, _)| key.as_deref())
            != anchor.as_deref()
        {
            self.visibility_navigation.insert(sub.clone());
        }
        self.windows.insert(
            sub.clone(),
            (anchor.clone(), before, request.after.min(800)),
        );
        Ok(vec![Input::Window {
            sub,
            anchor,
            before,
            after: request.after.saturating_sub(1),
        }])
    }

    pub(super) fn source_range(&self, sub: &str, rows: &[Value]) -> (usize, usize) {
        let Some((anchor, before, after)) = self.windows.get(sub) else {
            return (0, 50);
        };
        let position = |key: &str| rows.iter().position(|r| r["key"].as_str() == Some(key));
        if let Some(tail) = self.head_tails.get(sub) {
            let through = position(tail).map_or(0, |i| i + 1);
            return (0, (*after).max(through).min(HEAD_ROWS));
        }
        let at = anchor.as_deref().and_then(position).unwrap_or(0);
        (at.saturating_sub(*before), at.saturating_add(*after))
    }
}
