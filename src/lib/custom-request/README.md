# Custom Request

## Purpose

Custom Request parses user-supplied Nostr relay filters for one-shot reads.

## Table of Contents

- [Contract](#contract)

## Contract

- Input must be a filter object, filter array, request object, or `REQ` array.
- Relay URLs are optional; selected read relays are used by default.
- Invalid filters fail before relay reads start.
