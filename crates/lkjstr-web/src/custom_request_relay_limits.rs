use lkjstr_app::custom_request::CustomRequestRelayLimitInput;
use lkjstr_relays::RequestRelayLimits;
use lkjstr_storage::{RelayInformationRecord, StorageOutcome};
use serde_json::Value;

use crate::{
    sqlite_host_store::with_sqlite_store,
    sqlite_store::{SqliteStore, sqlite_relay_information_get},
};

pub(crate) async fn custom_request_relay_limits(
    db_name: &str,
    worker_url: &str,
    relays: &[String],
) -> Vec<CustomRequestRelayLimitInput> {
    let relays = relays.to_vec();
    match with_sqlite_store(db_name, worker_url, |store| async move {
        relay_limits_from_store(store, relays).await
    })
    .await
    {
        StorageOutcome::Ok(rows) => rows,
        _ => Vec::new(),
    }
}

async fn relay_limits_from_store(
    store: SqliteStore,
    relays: Vec<String>,
) -> StorageOutcome<Vec<CustomRequestRelayLimitInput>> {
    let mut out = Vec::new();
    for relay in relays {
        if let StorageOutcome::Ok(Some(record)) = sqlite_relay_information_get(&store, &relay).await
            && let Some(limit) = relay_limit_input(record)
        {
            out.push(limit);
        }
    }
    StorageOutcome::Ok(out)
}

fn relay_limit_input(record: RelayInformationRecord) -> Option<CustomRequestRelayLimitInput> {
    let value = serde_json::from_str::<Value>(&record.info_json).ok()?;
    let limit = limitation_value(&value)?;
    let limits = RequestRelayLimits {
        max_limit: positive_u64(limit, &["max_limit", "maxLimit"]),
        default_limit: positive_u64(limit, &["default_limit", "defaultLimit"]),
        max_message_length: positive_usize(limit, &["max_message_length", "maxMessageLength"]),
        max_subscriptions: positive_usize(limit, &["max_subscriptions", "maxSubscriptions"]),
        max_subscription_id_length: positive_usize(
            limit,
            &[
                "max_subscription_id_length",
                "max_subid_length",
                "maxSubIdLength",
            ],
        ),
        auth_required: bool_field(limit, &["auth_required", "authRequired"]),
        payment_required: bool_field(limit, &["payment_required", "paymentRequired"]),
        restricted_writes: bool_field(limit, &["restricted_writes", "restrictedWrites"]),
        min_pow_difficulty: positive_u64(limit, &["min_pow_difficulty", "minPowDifficulty"]),
        created_at_lower_limit: positive_u64(
            limit,
            &["created_at_lower_limit", "createdAtLowerLimit"],
        ),
        created_at_upper_limit: positive_u64(
            limit,
            &["created_at_upper_limit", "createdAtUpperLimit"],
        ),
    };
    Some(CustomRequestRelayLimitInput {
        relay_url: record.relay_url,
        limits,
    })
}

fn limitation_value(value: &Value) -> Option<&serde_json::Map<String, Value>> {
    value
        .get("info")
        .unwrap_or(value)
        .get("limitation")?
        .as_object()
}

fn positive_u64(record: &serde_json::Map<String, Value>, names: &[&str]) -> Option<u64> {
    names
        .iter()
        .filter_map(|name| record.get(*name)?.as_u64())
        .find(|value| *value > 0)
}

fn positive_usize(record: &serde_json::Map<String, Value>, names: &[&str]) -> Option<usize> {
    positive_u64(record, names).and_then(|value| usize::try_from(value).ok())
}

fn bool_field(record: &serde_json::Map<String, Value>, names: &[&str]) -> bool {
    names
        .iter()
        .find_map(|name| record.get(*name)?.as_bool())
        .unwrap_or(false)
}
