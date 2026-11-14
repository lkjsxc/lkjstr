use crate::{Error, Result};
pub(crate) fn amount(hrp: &str) -> Result<Option<u64>> {
    let body = ["lnbcrt", "lntbs", "lnbc", "lntb"]
        .into_iter()
        .find_map(|prefix| hrp.strip_prefix(prefix))
        .ok_or(Error::Invalid)?;
    if body.is_empty() {
        return Ok(None);
    }
    let (digits, multiplier) = match body.as_bytes().last() {
        Some(b'm') => (&body[..body.len() - 1], 100_000_000u64),
        Some(b'u') => (&body[..body.len() - 1], 100_000),
        Some(b'n') => (&body[..body.len() - 1], 100),
        Some(b'p') => {
            let digits = &body[..body.len() - 1];
            if !digits.ends_with('0') {
                return Err(Error::Invalid);
            }
            let n = crate::metadata::decimal(digits)? / 10;
            if n == 0 || digits.starts_with('0') {
                return Err(Error::Invalid);
            }
            return Ok(Some(n));
        }
        _ => (body, 100_000_000_000),
    };
    let n = crate::metadata::decimal(digits)?;
    if n == 0 || digits.starts_with('0') {
        return Err(Error::Invalid);
    }
    Ok(Some(n.checked_mul(multiplier).ok_or(Error::Invalid)?))
}
pub(crate) fn integer(words: &[u8]) -> Result<u64> {
    words.iter().try_fold(0u64, |acc, w| {
        acc.checked_mul(32)
            .and_then(|n| n.checked_add(*w as u64))
            .ok_or(Error::Invalid)
    })
}
// Convert 5-bit words to bytes. Field data has zero padding; signing data gets
// a final zero-padded byte instead of discarding the last partial byte.
pub(crate) fn bytes(words: &[u8], pad: bool) -> Result<Vec<u8>> {
    let mut acc = 0u32;
    let mut bits = 0;
    let mut result = vec![];
    for word in words {
        if *word > 31 {
            return Err(Error::Invalid);
        }
        acc = ((acc << 5) | *word as u32) & 0xffff;
        bits += 5;
        if bits >= 8 {
            bits -= 8;
            result.push((acc >> bits) as u8);
        }
    }
    if pad {
        if bits != 0 {
            result.push((acc << (8 - bits)) as u8);
        }
    } else if bits >= 5 || (acc << (8 - bits)) & 255 != 0 {
        return Err(Error::Invalid);
    }
    Ok(result)
}
