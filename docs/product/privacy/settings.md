# Privacy Settings

## Purpose

This file defines the privacy settings surface after first-run consent.

## Contract

A Privacy settings control remains reachable after the banner is dismissed. It
shows the current optional category choices, lets the user save changed choices,
and includes withdrawal.

Withdrawal disables optional cookies, optional telemetry, and optional
non-essential local storage. It clears optional records owned by the privacy
adapter, including optional cookies and optional local-storage keys. It does not
clear essential local-first product data such as accounts, relay settings,
drafts, cached events, tab snapshots, diagnostics, or the consent record needed
to remember the withdrawal.

Privacy settings never expose local signing secrets or draft content.
