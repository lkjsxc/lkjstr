# Media

## Purpose

Media owns shared upload settings, NIP-96 discovery, and upload transport.

## Contents

- `settings.ts` loads and saves the `tweet.*` upload settings records.
- `endpoint.ts` resolves HTTPS NIP-96 upload endpoints.
- `upload.ts` signs NIP-98 upload auth and posts multipart media.
- Tweet and Profile Edit adapt shared uploaded media into their own fields.
