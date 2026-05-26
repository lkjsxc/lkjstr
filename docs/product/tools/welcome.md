# Welcome

## Purpose

Welcome is the in-workspace manual and quick-start surface. It opens on clean
first launch and from New Tab.

## Contract

- Welcome renders as a document-like tab with sections, not a splash screen.
- Sections include at minimum:
  - What this workspace is
  - How to post
  - How to configure accounts
  - How to configure relays
  - Core surfaces and what is still missing
- Each section uses real readiness checks from local stores. No mock status or
  dead checklist items.
- Action links open real workspace tabs in the current context: Accounts, Relay
  Settings, Home, Notifications, Tweet, Profile Edit, Upload Settings, Stats,
  and Settings.
- Storage failure recovery falls back to a usable Welcome workspace.
- Welcome explains that lkjstr is a browser-first Nostr workspace for reading
  timelines, composing notes, inspecting relay behavior, managing signing
  accounts, and following threads without a server-side account system.
- Welcome does not start relay connections by itself. Readiness links may open
  tabs that own relay work.

## Readiness

| Check       | Ready when                          | Action              |
| ----------- | ----------------------------------- | ------------------- |
| Account     | Active signing account exists       | Open Accounts       |
| Read relays | Selected set has enabled read relay | Open Relay Settings |
| Posting     | Account and write relay ready       | Open Tweet          |
| Home        | Account ready                       | Open Home           |
