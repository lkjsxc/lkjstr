# Media

## Purpose

Media owns shared upload settings, Blossom endpoint handling, NIP-96 discovery,
and upload transport.

## Table of Contents

- `providers.ts` defines provider ids, labels, and protocol choices.
- `settings.ts` loads and saves the `tweet.*` upload settings records.
- `endpoint.ts` resolves Blossom and NIP-96 upload endpoints.
- `upload.ts` signs scoped upload auth and sends provider-specific media
  requests.
- Tweet and Profile Edit adapt shared uploaded media into their own fields.
