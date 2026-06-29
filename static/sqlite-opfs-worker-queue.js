export function createCommandQueue({
  parseRequest,
  run,
  post,
  response,
  canceled,
}) {
  let queue = Promise.resolve();

  return (message) => {
    const request = parseRequest(message);
    if (!request) return undefined;
    if (request.op.kind === 'cancel') {
      canceled.add(request.op.targetRequestId);
      post(response(request, 'ok'));
      return Promise.resolve();
    }
    queue = queue.then(() => settle(request, run, post, response));
    return queue;
  };
}

async function settle(request, run, post, response) {
  try {
    post(await run(request));
  } catch (error) {
    post(response(request, 'unavailable', [], 0, { message: String(error) }));
  }
}
