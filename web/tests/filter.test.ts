import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { timeText } from '../src/views/feed-scrub.ts';
import { filterActive, filterNarrows, filterQuery } from '../src/views/filter-bar.ts';

describe('the filter of a feed', () => {
  it.each([
    ['2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T03:59:59.999Z'],
    ['2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T04:59:59.999Z'],
    ['2026-12-31', '2026-12-31T05:00:00.000Z', '2027-01-01T04:59:59.999Z'],
  ])('includes the whole local day %s in New York', (day, since, until) => {
    // A separate process makes the timezone independent of the host and other tests.
    const script = `
      import { filterQuery } from './src/views/filter-bar.ts';
      console.log(JSON.stringify(filterQuery({ start: '${day}', end: '${day}' })));
    `;
    const result = execFileSync(process.execPath, ['--input-type=module', '-e', script], {
      cwd: process.cwd(),
      env: { ...process.env, TZ: 'America/New_York' },
      encoding: 'utf8',
    });
    expect(JSON.parse(result)).toEqual({ since: Date.parse(since), until: Date.parse(until) });
  });
  it('a filter becomes query fields; an untouched one adds nothing', () => {
    expect(filterQuery({})).toEqual({});
    expect(filterQuery({ text: ' 猫 ', replies: false, media: 'only' })).toEqual({
      text: '猫',
      replies: false,
      media: 'only',
    });
    const day = new Date(2026, 10, 14).getTime();
    expect(filterQuery({ start: '2026-11-14', end: '2026-11-14' })).toEqual({
      since: day,
      until: day + 86_400_000 - 1,
    });
    expect(
      filterQuery({
        text: '猫 "静かな 朝" -spam -"buy now" from:aoi from:"Sam Rivera" has:image has:LINK has:x',
        people: ['aoi', 'taro'],
        news: true,
      }),
    ).toEqual({
      text: '猫 has:x',
      phrases: ['静かな 朝'],
      exclude: ['spam', 'buy now'],
      from: ['aoi', 'Sam Rivera', 'taro'],
      has: ['image', 'link'],
      notifications: true,
    });
    // An engine older than protocol 3 gets the typed words as they are, and nothing it does not know.
    expect(filterQuery({ text: 'from:aoi "x y"', people: ['taro'], news: true }, false)).toEqual({
      text: 'from:aoi "x y"',
    });
    expect(filterActive({ text: 'x' })).toBe(false);
    expect(filterActive({ reposts: false })).toBe(true);
    expect(filterNarrows({ text: 'x' })).toBe(true);
    expect(filterNarrows({ shown: true, open: true, text: ' ' })).toBe(false);
    expect(filterActive({ people: ['aoi'] })).toBe(true);
  });
});

describe('the time beside the scrollbar', () => {
  it('always says the whole local date and time, whatever the list spans', () => {
    const at = new Date(2026, 10, 15, 9, 5).getTime();
    expect(timeText(at)).toBe('2026/11/15 09:05');
    expect(timeText(new Date(2026, 0, 3, 23, 59).getTime())).toMatch(
      /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/,
    );
  });
});
