use serde_json::Value;

use crate::{EventFramePolicy, EventValidationError, NostrTag, event::bad_tag};

pub(crate) fn parse_tags(
    value: Option<&Value>,
    policy: Option<&EventFramePolicy>,
) -> Result<Vec<NostrTag>, EventValidationError> {
    let Some(Value::Array(raw_tags)) = value else {
        return crate::event::bad_field("tags must be an array");
    };
    if let Some(frame_policy) = policy
        && raw_tags.len() > frame_policy.max_event_tags
    {
        return bad_tag(format!(
            "tags exceed {} entries",
            frame_policy.max_event_tags
        ));
    }
    raw_tags.iter().map(|tag| parse_tag(tag, policy)).collect()
}

fn parse_tag(
    value: &Value,
    policy: Option<&EventFramePolicy>,
) -> Result<NostrTag, EventValidationError> {
    let Value::Array(fields) = value else {
        return bad_tag("tag must be an array");
    };
    if let Some(frame_policy) = policy
        && fields.len() > frame_policy.max_tag_fields
    {
        return bad_tag(format!(
            "tag exceeds {} fields",
            frame_policy.max_tag_fields
        ));
    }
    fields
        .iter()
        .map(|field| parse_tag_field(field, policy))
        .collect()
}

fn parse_tag_field(
    value: &Value,
    policy: Option<&EventFramePolicy>,
) -> Result<String, EventValidationError> {
    let Some(field) = value.as_str() else {
        return bad_tag("tag entries must be strings");
    };
    if let Some(frame_policy) = policy
        && field.len() > frame_policy.max_tag_field_bytes
    {
        return bad_tag(format!(
            "tag field exceeds {} bytes",
            frame_policy.max_tag_field_bytes
        ));
    }
    Ok(field.to_owned())
}
