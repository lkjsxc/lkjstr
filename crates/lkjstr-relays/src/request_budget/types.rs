#![doc = "Typed relay request-budget inputs and outputs."]

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestBudgetSurface {
    Home,
    Global,
    Notifications,
    Profile,
    Thread,
    Search,
    CustomRequest,
    AuthorContext,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestBudgetPhase {
    Bootstrap,
    Page,
    Live,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestBudgetDirection {
    Initial,
    Older,
    Newer,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestBudgetPurpose {
    Feed,
    Metadata,
    EventLookup,
    RouteDiscovery,
    Search,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct RequestRelayLimits {
    pub max_limit: Option<u64>,
    pub default_limit: Option<u64>,
    pub max_message_length: Option<usize>,
    pub max_subscriptions: Option<usize>,
    pub max_subscription_id_length: Option<usize>,
    pub auth_required: bool,
    pub payment_required: bool,
    pub restricted_writes: bool,
    pub min_pow_difficulty: Option<u64>,
    pub created_at_lower_limit: Option<u64>,
    pub created_at_upper_limit: Option<u64>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestBudgetInput {
    pub surface: RequestBudgetSurface,
    pub phase: RequestBudgetPhase,
    pub direction: Option<RequestBudgetDirection>,
    pub purpose: Option<RequestBudgetPurpose>,
    pub page_size: Option<u64>,
    pub relay_url: String,
    pub filter_count: usize,
    pub requested_filter_limit: Option<u64>,
    pub has_search_filter: bool,
    pub exact_event_lookup: bool,
    pub relay_limits: Option<RequestRelayLimits>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub enum RequestBudgetWarningKind {
    AppLimitClamped,
    RelayLimitClamped,
    RelayDefaultLimit,
    RequestTooLarge,
    AuthRequired,
    PaymentRequired,
    RestrictedWrites,
    PowRequired,
    CreatedAtBound,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub enum RequestBudgetWarningValue {
    Number(u64),
    Size(usize),
    Text(String),
    Flag(bool),
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestBudgetWarning {
    pub kind: RequestBudgetWarningKind,
    pub message: String,
    pub value: Option<RequestBudgetWarningValue>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RequestBudget {
    pub relay_url: String,
    pub filter_limit: Option<u64>,
    pub max_events: u64,
    pub timeout_ms: u64,
    pub max_message_length: Option<usize>,
    pub max_subscriptions: usize,
    pub max_subscription_id_length: usize,
    pub warnings: Vec<RequestBudgetWarning>,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub struct BudgetedFilters {
    pub filters: Vec<lkjstr_protocol::NostrFilter>,
    pub warnings: Vec<RequestBudgetWarning>,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub struct MergedReadBudget {
    pub max_events: u64,
    pub timeout_ms: u64,
}
