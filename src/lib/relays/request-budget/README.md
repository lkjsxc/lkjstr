# Request Budget Source

## Purpose

This directory contains pure helpers that derive and apply relay request budgets
from runtime intent, app caps, and typed relay information.

## Table of Contents

- `types.ts`: shared budget input, output, and warning types.
- `policy.ts`: app hard caps and surface policy helpers.
- `nip11.ts`: relay information limitation helpers.
- `message-size.ts`: serialized `REQ` byte estimation and validation.
- `derive.ts`: pure budget derivation.
- `apply.ts`: filter and read-option application helpers.
