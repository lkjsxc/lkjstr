// The client handlers the mock knows (interface-client.md W3): lkjstr's own, verified; a release bot's, whose
// handler cannot be verified. A client named without a handler address gets none.
export const HANDLERS: Readonly<
  Record<string, { readonly address: string; readonly info?: { name: string; website?: string } }>
> = {
  lkjstr: {
    address: '31990:160b7d028b99ef2530be8718d03cb0be6f9449fb74d5ae8d6f09a060c63048b1:lkjstr',
    info: { name: 'lkjstr', website: 'https://lkjstr.lkjsxc.com' },
  },
  'release-bot': {
    address: `31990:${'ab'.repeat(32)}:release bot ${'wide '.repeat(30)}descriptor`,
  },
};
