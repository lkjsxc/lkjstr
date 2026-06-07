import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('upload gate surfaces', () => {
  it('routes unconfigured tweet attach clicks to upload settings', () => {
    const source = readFileSync(
      'src/lib/tabs/tweet/TweetMediaControls.svelte',
      'utf8',
    );

    expect(source).toContain('UploadGateHint');
    expect(source).toContain('onclick={props.openUploadSettings}');
    expect(source).not.toContain('disabled={!canUpload}');
  });

  it('routes unconfigured profile image pickers to upload settings', () => {
    const source = readFileSync(
      'src/lib/tabs/profile-edit/ProfileImageUpload.svelte',
      'utf8',
    );

    expect(source).toContain('UploadGateHint');
    expect(source).toContain('onclick={props.openUploadSettings}');
  });
});
