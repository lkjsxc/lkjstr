use super::*;
impl Inbox {
    pub fn snapshot(
        &self,
        query: &Query,
        phase: &str,
        error: Option<String>,
        history_more: bool,
    ) -> Snapshot {
        let mut rows: Vec<_> = self
            .messages
            .iter()
            .filter(|((a, _), _)| a == &query.account)
            .map(|(_, m)| {
                let mut m = m.clone();
                let mark = self
                    .marks
                    .get(&format!("{}:{}", query.account, m.conversation));
                m.unread = m.author != query.account
                    && mark.is_none_or(|seen| {
                        m.at > seen.at || (m.at == seen.at && !seen.ids.contains(&m.id))
                    });
                m
            })
            .collect();
        rows.sort_by(|a, b| (b.at, &b.id).cmp(&(a.at, &a.id)));
        let mut conversations: BTreeMap<String, Conversation> = BTreeMap::new();
        for m in &rows {
            let room = conversations
                .entry(m.conversation.clone())
                .or_insert_with(|| Conversation {
                    key: m.conversation.clone(),
                    participants: m.participants.clone(),
                    last: m.clone(),
                    unread: 0,
                });
            room.unread += usize::from(m.unread);
        }
        let mut conversations: Vec<_> = conversations.into_values().collect();
        conversations.sort_by(|a, b| (b.last.at, &b.last.id).cmp(&(a.last.at, &a.last.id)));
        conversations.truncate(200);
        let mut messages: Vec<_> = rows
            .into_iter()
            .filter(|m| {
                query
                    .conversation
                    .as_ref()
                    .is_some_and(|c| c == &m.conversation)
            })
            .collect();
        let start = query
            .before
            .as_ref()
            .and_then(|id| messages.iter().position(|m| &m.id == id))
            .map_or(0, |i| i + 1);
        let limit = query.limit.unwrap_or(100).clamp(1, 200);
        let more = messages.len() > start + limit || history_more;
        messages = messages.into_iter().skip(start).take(limit).collect();
        Snapshot {
            account: query.account.clone(),
            conversations,
            messages,
            more,
            undecryptable: 0,
            phase: phase.into(),
            error,
        }
    }
}
