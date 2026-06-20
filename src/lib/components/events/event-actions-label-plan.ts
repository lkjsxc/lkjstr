export type EventActionLabels = {
  readonly heart: 'Heart';
  readonly publishReply: 'Publish reply';
  readonly reply: 'Reply';
  readonly repost: 'Repost';
  readonly zap: 'Zap';
};

export function eventActionLabels(): EventActionLabels {
  return {
    heart: 'Heart',
    publishReply: 'Publish reply',
    reply: 'Reply',
    repost: 'Repost',
    zap: 'Zap',
  };
}
