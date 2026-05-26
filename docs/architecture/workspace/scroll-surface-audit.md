# Scroll Surface Audit

## Purpose

This checklist tracks scrollbar placement and content inset per scrolling
surface. Each row must pass before the scroll-layout contract is complete.

## Checklist

| Surface            | Scroll root                     | Track at tile edge | Content inset on child | Status   |
| ------------------ | ------------------------------- | ------------------ | ---------------------- | -------- |
| Home / Global      | `.event-list__viewport`         | required           | required               | required |
| Thread             | `.event-list__viewport`         | required           | required               | required |
| Search             | `.event-list__viewport`         | required           | required               | required |
| Profile notes      | `.event-list__viewport`         | required           | required               | required |
| Notifications      | `.notification-list-scroll`     | required           | required               | required |
| Settings           | `.settings-tab`                 | required           | required               | required |
| Relay Settings     | `.settings-tab`                 | required           | required               | required |
| Stats              | `.settings-tab`                 | required           | required               | required |
| Welcome            | `.settings-tab`                 | required           | required               | required |
| Upload Settings    | `.settings-tab`                 | required           | required               | required |
| Custom Request     | tab scroll root                 | required           | required               | required |
| Author Context     | tab scroll root                 | required           | required               | required |
| lkjstr Log         | tab scroll root                 | required           | required               | required |
| Pane shell         | no inline padding on `.pane-body` | n/a              | tab inner roots          | required |

## Verification

- Scrolling element `getBoundingClientRect().right` aligns with pane body right
  edge within one device pixel.
- Text in the rightmost column does not sit under the scrollbar thumb.
- `scrollbar-gutter: stable` prevents layout shift when scrollbars appear.

## Related

- [scroll-layout.md](scroll-layout.md): tokens and contract.
