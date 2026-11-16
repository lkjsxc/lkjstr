// The upload fixture owns a bounded lease, decode result and timers per request.
import type { Action, FromEngine, Uploaded } from '../protocol.ts';
import type { Core } from './engine.ts';

type Job = { timers: Set<ReturnType<typeof setTimeout>>; url?: string };
export function createUploads(core: Core) {
  const jobs = new Map<string, Job>(); // <=4 active fixture uploads
  const finish = (req: string, job: Job, result: Extract<FromEngine, { t: 'result' }>): void => {
    if (jobs.get(req) !== job) return;
    jobs.delete(req);
    for (const timer of job.timers) clearTimeout(timer);
    job.timers.clear();
    if (!result.ok && job.url) URL.revokeObjectURL(job.url);
    core.post(result);
  };
  const later = (req: string, job: Job, ms: number, run: () => void): void => {
    const timer = setTimeout(() => {
      job.timers.delete(timer);
      if (jobs.get(req) === job) run();
    }, ms);
    job.timers.add(timer);
  };
  const upload = async (req: string, a: Extract<Action, { a: 'upload' }>): Promise<void> => {
    if (jobs.has(req)) return;
    if (jobs.size >= 4 || a.bytes.byteLength > 20 * 1024 * 1024) {
      core.post({ t: 'result', req, ok: false, error: { code: 'too-large' } });
      return;
    }
    const job: Job = { timers: new Set() };
    jobs.set(req, job);
    const total = a.bytes.byteLength;
    if (/fail/i.test(a.name)) {
      core.post({ t: 'progress', req, sent: Math.round(total * 0.4), total });
      later(req, job, 500, () =>
        finish(req, job, {
          t: 'result',
          req,
          ok: false,
          error: { code: 'rejected', message: 'media.example.jp: unsupported media type' },
        }),
      );
      return;
    }
    const type = a.mime.startsWith('video')
      ? 'video'
      : a.mime.startsWith('audio')
        ? 'audio'
        : 'image';
    const blob = new Blob([a.bytes], { type: a.mime });
    const out: Uploaded = { url: URL.createObjectURL(blob), type, mime: a.mime };
    job.url = out.url;
    let size: { w?: number; h?: number } = {};
    try {
      const bitmap = type === 'image' ? await createImageBitmap(blob) : undefined;
      if (bitmap) {
        size = { w: bitmap.width, h: bitmap.height };
        bitmap.close();
      }
    } catch {
      /* unknown dimensions remain absent */
    }
    if (jobs.get(req) !== job) return;
    for (let i = 1; i <= 5; i++)
      later(req, job, i * 220, () => {
        core.post({ t: 'progress', req, sent: Math.round((total * i) / 5), total });
        if (i === 5)
          finish(req, job, { t: 'result', req, ok: true, uploaded: { ...out, ...size } });
      });
  };
  const cancel = (req: string): void => {
    const job = jobs.get(req);
    if (job) finish(req, job, { t: 'result', req, ok: false, cancelled: true });
  };
  return {
    run: (req: string, a: Extract<Action, { a: 'upload' }>) => void upload(req, a),
    cancel,
    dispose(): void {
      for (const [req, job] of jobs) {
        for (const timer of job.timers) clearTimeout(timer);
        if (job.url) URL.revokeObjectURL(job.url);
        jobs.delete(req);
      }
    },
  };
}
