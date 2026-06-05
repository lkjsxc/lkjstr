export const kinds = {
  metadata: 0,
  textNote: 1,
  recommendRelay: 2,
  followList: 3,
  deletion: 5,
  repost: 6,
  reaction: 7,
  genericRepost: 16,
  channelCreate: 40,
  channelMetadata: 41,
  channelMessage: 42,
  channelHideMessage: 43,
  channelMuteUser: 44,
  groupPutUser: 9000,
  groupRemoveUser: 9001,
  groupEditMetadata: 9002,
  groupDeleteEvent: 9005,
  groupCreateGroup: 9007,
  groupDeleteGroup: 9008,
  groupCreateInvite: 9009,
  groupJoinRequest: 9021,
  groupLeaveRequest: 9022,
  groupCloseReport: 9030,
  relayListMetadata: 10002,
  userGroups: 10009,
  zapRequest: 9734,
  zapReceipt: 9735,
  httpAuth: 27235,
  relayAuth: 22242,
  blossomAuth: 24242,
  handlerRecommendation: 31989,
  handlerInformation: 31990,
  groupMetadata: 39000,
  groupAdmins: 39001,
  groupMembers: 39002,
  groupRoles: 39003,
  groupLivekitParticipants: 39004,
} as const;

export function isReplaceableKind(kind: number): boolean {
  return kind === 0 || kind === 3 || (kind >= 10_000 && kind < 20_000);
}

export function isEphemeralKind(kind: number): boolean {
  return kind >= 20_000 && kind < 30_000;
}

export function isAddressableKind(kind: number): boolean {
  return kind >= 30_000 && kind < 40_000;
}
