// Expected passing checks from smoke-uploads and smoke-server-marks.
export const queuedUploadChecks = [
  'queued image-only Post waits without requesting a note signature',
  'queued image-only Post proceeds through Posting',
  'queued image-only Post publishes once with an image URL and imeta',
  'queued failed upload stops before signing or publishing and keeps its draft',
  'queued failed upload can retry the file and post explicitly',
  'removing a pending attachment stops the queued Post',
  'editing or canceling a queued Post keeps the attachment without publishing',
  'queued thread Reply publishes with its image and the parent reference',
];

const serverMarks = [
  'media root without CORS and working PUT is answering',
  'media root actually refuses browser CORS',
  'root CORS failure never changes server mark',
  'required upload failure marks down with the compose reason',
  'saved state with an old down verdict loads as unknown',
  'compose picker shares the fresh down mark',
  'optional unsupported BUD-06 never marks down',
  'row retry recovers when BUD-06 answers again',
  'required NIP-96 discovery retry recovers',
  'implicit upload uses first answering server by the row evidence',
  'fallback success and first-server failure share Settings marks',
];

function protocolChecks(signer, protocol, quick) {
  const prefix = `upload ${signer} ${protocol}`;
  const successes = protocol === 'nip96' ? ['slow', 'processing'] : ['slow'];
  const failures = ['refuse', 'cors', 'malformed', ...(quick ? [] : ['hang', 'body-hang'])];
  return [
    ...successes.flatMap((mode) => [
      `${prefix} ${mode} shows the destination`,
      `${prefix} ${mode} completes`,
      `${prefix} ${mode} auth and preflight`,
    ]),
    ...failures.flatMap((mode) => [
      `${prefix} ${mode} names server and reason`,
      `${prefix} ${mode} preserves draft and file`,
      `${prefix} ${mode} retry completes`,
      `${prefix} ${mode} auth and preflight`,
    ]),
  ];
}

function extensionChecks(quick, shots) {
  return [
    ...serverMarks,
    ...(shots ? ['server marks agree in a second app page'] : []),
    ...(quick ? ['refuse', 'wrong'] : ['refuse', 'wrong', 'hang']).flatMap((mode) => [
      `upload extension ${mode} is visible`,
      `upload extension ${mode} sends no HTTP upload`,
      `upload extension ${mode} retries the retained file`,
    ]),
    'upload failure and picker fit a narrow compose tile',
    'upload failure is plain Japanese with its server',
    'upload Japanese retry retains the file',
  ];
}

export function uploadSmokeChecks({ quick, shots }) {
  return [
    ...['local', 'extension', 'remote'].flatMap((signer) => [
      `parallel ${signer} startup renders a real Global note`,
      `upload ${signer} untested defaults show muted protocols`,
      ...protocolChecks(signer, 'blossom', quick),
      ...protocolChecks(signer, 'nip96', quick),
    ]),
    ...extensionChecks(quick, shots),
    ...queuedUploadChecks,
    'upload remote refuse is visible',
    'upload remote refuse retries the retained file',
    'upload remote signing round trip starts',
    'upload remote outage is visible',
    'upload remote outage retries the retained file',
    ...(quick ? ['no upload page errors'] : []),
  ];
}
