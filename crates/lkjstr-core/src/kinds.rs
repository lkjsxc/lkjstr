//! Public read capabilities. Private storage and signing remain separate authorities.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Face {
    Note,
    Act,
    Comment,
    Article,
    List,
    Generic,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ActKind {
    Repost,
    Reaction,
    Zap,
}
#[derive(Clone, Copy)]
#[repr(u16)]
pub enum Feed {
    Timeline = 1,
    ProfilePosts = 2,
    ProfileReposts = 4,
    ProfileReactions = 8,
    ThreadReplies = 16,
    Notifications = 32,
    Channels = 64,
    Channel = 128,
    People = 256,
    Followers = 512,
    Following = 1024,
    Bookmarks = 2048,
    Mutes = 4096,
    MediaServers = 8192,
    Emoji = 16384,
    List = 32768,
}
#[derive(Clone, Copy, Debug)]
pub struct KindPolicy {
    pub face: Face,
    /// Public cache eligibility; never a restriction on the private event store.
    pub retained: bool,
    pub openable: bool,
    pub public_reference: bool,
    pub context_target: bool,
    pub context_contributor: bool,
    pub reply: bool,
    pub act: Option<ActKind>,
    pub expires: bool,
    pub client_tag: bool,
    pub thread_parent: bool,
    pub thread_root: bool,
    pub act_terminal: bool,
    pub deletion_context: bool,
    pub publication_recipients: bool,
    pub serialized_write: bool,
    pub derived_tags: bool,
    pub monotonic_write: bool,
    pub feeds: u16,
}
impl KindPolicy {
    pub fn lists(self, feed: Feed) -> bool {
        self.feeds & feed as u16 != 0
    }
}
/// Finite public list vocabulary shared by projection and relay discovery.
pub const PUBLIC_LIST_KINDS: &[u64] = &[
    3, 10000, 10001, 10002, 10003, 10015, 10030, 30000, 30002, 30003, 30004, 30005, 30015, 30030,
    39089,
];
/// Defaults describe a public generic focus, without feed or contributor authority.
pub const fn policy(kind: u64) -> KindPolicy {
    let mut p = KindPolicy {
        face: Face::Generic,
        retained: true,
        openable: true,
        public_reference: true,
        context_target: true,
        context_contributor: false,
        reply: false,
        act: None,
        expires: true,
        client_tag: false,
        thread_parent: false,
        thread_root: false,
        act_terminal: false,
        deletion_context: false,
        publication_recipients: false,
        serialized_write: false,
        derived_tags: false,
        monotonic_write: false,
        feeds: 0,
    };
    if kind > u16::MAX as u64 || matches!(kind, 4 | 13 | 14 | 1059 | 20000..=29999) {
        p.retained = false;
        p.openable = false;
        p.public_reference = false;
        p.context_target = false;
        p.expires = false;
        return p;
    }
    match kind {
        0 => {
            p.expires = false;
            p.serialized_write = true;
            p.monotonic_write = true;
            p.feeds = Feed::People as u16 | Feed::Following as u16;
        }
        1 | 42 => {
            p.face = Face::Note;
            p.context_contributor = true;
            p.reply = true;
            p.thread_parent = true;
            p.thread_root = kind == 1;
            p.act_terminal = true;
            p.deletion_context = true;
            p.publication_recipients = true;
            p.client_tag = true;
            p.derived_tags = true;
            p.feeds = Feed::ThreadReplies as u16 | Feed::Notifications as u16;
            p.feeds |= if kind == 1 {
                Feed::Timeline as u16 | Feed::ProfilePosts as u16
            } else {
                Feed::Channel as u16
            };
        }
        3 => {
            p.expires = false;
            p.serialized_write = true;
            p.monotonic_write = true;
            p.feeds = Feed::Followers as u16 | Feed::Following as u16;
        }
        5 => {
            p.context_contributor = true;
            p.expires = false;
        }
        6 | 7 | 16 | 9735 => {
            p.face = Face::Act;
            p.context_contributor = true;
            p.act = Some(match kind {
                7 => ActKind::Reaction,
                9735 => ActKind::Zap,
                _ => ActKind::Repost,
            });
            p.expires = kind != 9735;
            p.client_tag = kind != 9735;
            p.publication_recipients = kind != 9735;
            p.feeds = Feed::Notifications as u16;
            p.feeds |= match kind {
                6 => Feed::Timeline as u16 | Feed::ProfileReposts as u16,
                16 => Feed::ProfileReposts as u16,
                7 => Feed::ProfileReactions as u16,
                _ => 0,
            };
        }
        40 | 41 => {
            p.expires = false;
            p.client_tag = true;
            if kind == 40 {
                p.feeds = Feed::Channels as u16;
            }
        }
        1111 => p.face = Face::Comment,
        10000..=19999 => {
            // Existing account/list metadata does not acquire wall-clock expiry.
            p.expires = false;
            p.monotonic_write = true;
            p.serialized_write = matches!(kind, 10000 | 10003 | 10005);
            p.feeds = match kind {
                10000 => Feed::Mutes as u16,
                10003 => Feed::Bookmarks as u16,
                10030 => Feed::Emoji as u16,
                10063 => Feed::MediaServers as u16,
                _ => 0,
            };
        }
        30023 => {
            p.face = Face::Article;
            p.context_contributor = true;
            p.thread_parent = true;
            p.thread_root = true;
            p.deletion_context = true;
            p.publication_recipients = true;
            p.client_tag = true;
            p.derived_tags = true;
        }
        30000 => p.feeds = Feed::List as u16,
        _ => {}
    }
    let mut index = 0;
    while index < PUBLIC_LIST_KINDS.len() {
        if kind == PUBLIC_LIST_KINDS[index] {
            p.face = Face::List;
            p.expires = false;
            break;
        }
        index += 1;
    }
    p
}
/// Stable filter order preserves the existing relay request shapes.
pub fn feed_kinds(feed: Feed) -> Vec<u64> {
    [
        0, 3, 1, 42, 6, 16, 7, 9735, 40, 10000, 10003, 10030, 10063, 30000,
    ]
    .into_iter()
    .filter(|kind| policy(*kind).lists(feed))
    .collect()
}

/// The published list faces share one selection policy for a profile.
pub fn is_public_list(kind: u64) -> bool {
    policy(kind).face == Face::List
}
