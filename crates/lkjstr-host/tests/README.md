# Host tests

## Purpose

Exercise HTTP behavior and reject incomplete or invalid deployment assets.

## Table of Contents

- [http.rs](http.rs): headers, methods, missing files, HEAD and byte ranges.
- [validation.rs](validation.rs): missing, corrupt, oversized and unsafe inputs.
- [support/](support/): isolated temporary asset fixtures for tests only.
