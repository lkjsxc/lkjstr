// Person addresses standing alone as a word, perhaps in brackets, quotes or before a full stop: exactly the words the
// engine turns into references when it publishes (an invalid checksum aside, which only the engine can tell). Inside a
// URL, a path or a longer word, and in mixed case, they stay text. The composer's chips and a waiting draft's links
// both read text through this one rule.

const WORD = /\S+/g;
const OPEN = /^[(<"']*/;
const CLOSE = /[)>"'.,;:!?]*$/;
// Lowercase or wholly uppercase, as bech32 allows.
const PERSON =
  /^(?:[nN][oO][sS][tT][rR]:)?(?:(?:npub1|nprofile1)[02-9ac-hj-np-z]{20,}|(?:NPUB1|NPROFILE1)[02-9AC-HJ-NP-Z]{20,})$/;

export type PersonAddress = {
  /** Where the address starts in the text, after any opening bracket or quote. */
  readonly from: number;
  /** As written, with its `nostr:` prefix if it has one. */
  readonly text: string;
  /** The code without the prefix, lowercased, for the engine to resolve. */
  readonly bech32: string;
};

export function personAddresses(text: string): PersonAddress[] {
  const found: PersonAddress[] = [];
  for (const word of text.matchAll(WORD)) {
    const lead = OPEN.exec(word[0])?.[0].length ?? 0;
    const core = word[0].slice(lead).replace(CLOSE, '');
    if (PERSON.test(core))
      found.push({
        from: word.index + lead,
        text: core,
        bech32: core.replace(/^nostr:/i, '').toLowerCase(),
      });
  }
  return found;
}
