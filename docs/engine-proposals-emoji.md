# Protocol 16 additions

## Purpose

Record the kind and emoji fields added together in protocol 16. See
[emoji-sets.md](emoji-sets.md) for the collision checks.

- `NoteRow.eventKind?`: public kind other than notes (1) and channel messages (42).
- `Quote` in state `ok` carries the same optional `eventKind`. Public snapshots retain it.

## Emoji identity and provenance

- `EmojiRow.source`: required owner-list or exact set coordinate; independent of provenance.
- `EmojiRow.key`: opaque identity includes source, code and SHA-256 of the exact picture URL.
- `Emoji.set?`: title of the exact tagged set already retained on this device.
- `Segment[k=emoji].address?`: valid set coordinate from that event's own emoji tag.
- `Segment[k=emoji].set?`: locally known title of that exact tagged coordinate.
- `Reaction.address?`: optional provenance from a contributing reaction's own emoji tag.
- `Reaction.set?`: locally known title for that reaction's exact tagged coordinate.
- `ActRef.emoji.address?`: provenance from the displayed reaction event's own tag.
- `ActRef.emoji.set?`: locally known title of that exact tagged coordinate.
- `NotificationRow.emoji.address?`: provenance from the represented reaction's own tag.
- `NotificationRow.emoji.set?`: locally known title of that exact tagged coordinate.

Every optional set title requires that the retained, explicitly tagged set holds
the exact picture URL. The code may differ because a draft can allocate an alias.

Author names and profile bio segments use the same emoji metadata. Incoming
pictures never consult the reader's list. No new network work or E6 preloading
is introduced. Public snapshots retain these additive public view fields;
private draft storage retains code and picture only on the encrypted private path. Snapshots without
the required emoji source are discarded; other public snapshots retain their identity.
