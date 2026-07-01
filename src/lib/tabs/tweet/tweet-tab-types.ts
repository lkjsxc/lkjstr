import type { Account } from '$lib/accounts/account';
import type { RelaySet } from '$lib/relays/relay-store';

export type TweetTabProps = {
  tabId: string;
  activeAccount?: Account;
  relaySets: readonly RelaySet[];
  openUploadSettings: () => void;
};
