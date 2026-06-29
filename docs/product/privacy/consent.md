# Consent Surface

## Purpose

This file defines the first-run privacy banner and consent choices.

## Contract

The root workspace renders a privacy banner until a consent choice is stored.
Reject All, Accept All, and Customize are equally reachable buttons. Essential
local-first storage is explained in the banner and is not disabled by rejection.

Optional categories are:

- optional cookies.
- optional telemetry.
- optional non-essential local storage.

All optional categories default to disabled. Accept All enables every optional
category. Reject All disables every optional category. Customize opens controls
for each optional category and persists only the categories the user enables.

The app does not claim that optional processing is active until a stored consent
record enables the matching category. Missing storage support shows an explicit
save failure and does not turn on optional processing.
