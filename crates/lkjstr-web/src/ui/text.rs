//! Small display helpers: names, keys and times for people, not machines.

use lkjstr_protocol::encode_npub;

const MONTHS: [&str; 12] = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

pub fn npub(pubkey: &str) -> String {
    encode_npub(pubkey).unwrap_or_else(|_| pubkey.to_owned())
}

/// `npub1abcd…wxyz`: recognisable without the full 63 characters.
pub fn short_npub(pubkey: &str) -> String {
    let full = npub(pubkey);
    if full.len() <= 16 {
        return full;
    }
    format!("{}…{}", &full[..9], &full[full.len() - 4..])
}

/// Civil date from Unix days (Howard Hinnant's algorithm).
fn civil(days: i64) -> (i64, usize, i64) {
    let z = days + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let day = doy - (153 * mp + 2) / 5 + 1;
    let month = if mp < 10 { mp + 3 } else { mp - 9 };
    let year = yoe + era * 400 + i64::from(month <= 2);
    (year, (month - 1) as usize, day)
}

/// "now", "5m", "3h", "2d", then "Mar 4" this year or "Mar 4, 2023".
pub fn ago(at: u64, now: u64) -> String {
    let delta = now.saturating_sub(at);
    match delta {
        0..60 => "now".to_owned(),
        60..3_600 => format!("{}m", delta / 60),
        3_600..86_400 => format!("{}h", delta / 3_600),
        86_400..604_800 => format!("{}d", delta / 86_400),
        _ => {
            let (year, month, day) = civil((at / 86_400) as i64);
            let (this_year, _, _) = civil((now / 86_400) as i64);
            if year == this_year {
                format!("{} {day}", MONTHS[month])
            } else {
                format!("{} {day}, {year}", MONTHS[month])
            }
        }
    }
}

/// Full timestamp for tooltips, in UTC.
pub fn stamp(at: u64) -> String {
    let (year, month, day) = civil((at / 86_400) as i64);
    let secs = at % 86_400;
    format!(
        "{} {day}, {year} {:02}:{:02} UTC",
        MONTHS[month],
        secs / 3_600,
        secs % 3_600 / 60
    )
}

pub fn plural(count: usize, one: &str, many: &str) -> String {
    if count == 1 {
        format!("1 {one}")
    } else {
        format!("{count} {many}")
    }
}

pub fn date_label(ui: super::Ui, at: u64) -> String {
    let day = lkjstr_core::appearance::day_label(at, crate::host::now_secs());
    if day.is_empty() {
        stamp(at).split(',').next().unwrap_or("").to_owned()
    } else {
        ui.tr(day)
    }
}
