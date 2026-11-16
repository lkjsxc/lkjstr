//! Private windows clone only rows they return; the frame watch returns counts alone.
use super::*;
impl Inbox {
    fn unread(&self, account: &str, message: &Message) -> bool {
        let mark = self
            .marks
            .get(&format!("{account}:{}", message.conversation));
        message.author != account
            && mark.is_none_or(|seen| {
                message.at > seen.at || (message.at == seen.at && !seen.ids.contains(&message.id))
            })
    }
    fn projected(&self, account: &str, message: &Message) -> Message {
        let mut row = message.clone();
        row.unread = self.unread(account, message);
        row.reply = row.reply_to.as_ref().and_then(|id| {
            let parent = self.messages.get(&(account.to_owned(), id.clone()))?;
            (parent.conversation == row.conversation).then(|| Reply {
                id: id.clone(),
                author: parent.author.clone(),
                excerpt: parent
                    .text
                    .lines()
                    .next()
                    .unwrap_or("")
                    .chars()
                    .take(160)
                    .collect(),
            })
        });
        row
    }
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
            .filter(|((account, _), _)| account == &query.account)
            .map(|(_, message)| message)
            .collect();
        let unread = rows
            .iter()
            .filter(|message| self.unread(&query.account, message))
            .count();
        let mut snapshot = Snapshot {
            account: query.account.clone(),
            conversations: vec![],
            messages: vec![],
            more: history_more,
            undecryptable: 0,
            conversation: query.conversation.clone(),
            people: None,
            blocked: None,
            unread: Some(unread),
            phase: phase.into(),
            error,
        };
        if query.unread_only {
            return snapshot;
        }
        rows.sort_by(|a, b| (b.at, &b.id).cmp(&(a.at, &a.id)));
        let mut rooms: BTreeMap<&str, (&Message, usize, Vec<String>)> = BTreeMap::new();
        for message in &rows {
            let room = rooms
                .entry(&message.conversation)
                .or_insert((message, 0, vec![]));
            room.1 += usize::from(self.unread(&query.account, message));
            if message.author != query.account
                && room.2.len() < 2
                && !room.2.contains(&message.author)
            {
                room.2.push(message.author.clone());
            }
        }
        let mut rooms: Vec<_> = rooms.into_values().collect();
        rooms.sort_by(|(a, _, _), (b, _, _)| (b.at, &b.id).cmp(&(a.at, &a.id)));
        snapshot.conversations = rooms
            .into_iter()
            .take(200)
            .map(|(last, unread, recent_authors)| Conversation {
                recent_authors: Some(recent_authors),
                key: last.conversation.clone(),
                participants: last.participants.clone(),
                last: self.projected(&query.account, last),
                unread,
            })
            .collect();
        let messages: Vec<_> = rows
            .into_iter()
            .filter(|message| query.conversation.as_ref() == Some(&message.conversation))
            .collect();
        let start = query
            .before
            .as_ref()
            .and_then(|id| messages.iter().position(|message| &message.id == id))
            .map_or(0, |index| index + 1);
        let limit = query.limit.unwrap_or(100).clamp(1, 200);
        snapshot.more |= messages.len() > start + limit;
        snapshot.messages = messages
            .into_iter()
            .skip(start)
            .take(limit)
            .map(|message| self.projected(&query.account, message))
            .collect();
        snapshot
    }
}
