import { describe, expect, it, vi } from 'vitest';
import { createUploadSubmit } from '../src/views/compose-upload-submit.ts';

describe('a post waiting for attachments', () => {
  it('waits for the whole set and resumes exactly once', () => {
    const queued = createUploadSubmit(() => {});
    queued.hold('author');
    queued.hold('different author');
    expect(queued.el.dataset.phase).toBe('waiting');
    expect(queued.advance('uploading', 'author', true)).toBe(false);
    expect(queued.waiting()).toBe(true);
    expect(queued.advance('ready', 'author', true)).toBe(true);
    expect(queued.advance('ready', 'author', true)).toBe(false);
    expect(queued.waiting()).toBe(false);
    expect(queued.el.textContent).toBe('');
  });

  it('stops on failure and requires a new submit after retry', () => {
    const queued = createUploadSubmit(() => {});
    queued.hold('author');
    expect(queued.advance('failed', 'author', true)).toBe(false);
    expect(queued.el.dataset.phase).toBe('failed');
    expect(queued.el.querySelector('.error')?.textContent).toBeTruthy();
    expect(queued.waiting()).toBe(false);
    expect(queued.advance('ready', 'author', true)).toBe(false);
    queued.hold('author');
    expect(queued.advance('ready', 'author', true)).toBe(true);
  });

  it('drops the intent on cancel, account switch, or loss of permission', () => {
    const onCancel = vi.fn();
    const queued = createUploadSubmit(onCancel);
    queued.hold('author');
    queued.el.querySelector('button')?.click();
    expect(onCancel).toHaveBeenCalledOnce();
    expect(queued.advance('ready', 'author', true)).toBe(false);
    queued.hold('author');
    expect(queued.advance('uploading', 'new author', true)).toBe(false);
    expect(queued.advance('ready', 'author', true)).toBe(false);
    queued.hold('author');
    expect(queued.advance('ready', 'author', false)).toBe(false);
    expect(queued.waiting()).toBe(false);
  });
});
