# Route Evidence

## Purpose

This module ranks targeted route evidence from real relay behavior and protocol
hints. It never includes disabled relays and never removes the selected-relay
fallback.

## Table of Contents

- `source.rs`: source labels and base trust constants.
- `trust.rs`: measured success and failure trust reducer.
- `decay.rs`: stale NIP-65 decay helper.
- `merge.rs`: route evidence merge helper.
- `tests.rs`: trust and planning tests.
