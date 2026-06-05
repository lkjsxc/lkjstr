export const textSegmentTargetChars = 1_800;
export const textSegmentMaxChars = 2_400;

export type TextFragmentSegment = {
  readonly text: string;
  readonly startsAt: number;
  readonly endsAt: number;
};

export function splitText(content: string): TextFragmentSegment[] {
  if (!content) return [];
  const segments: TextFragmentSegment[] = [];
  let start = 0;
  while (start < content.length) {
    const end = nextSegmentEnd(content, start);
    segments.push({
      text: content.slice(start, end),
      startsAt: start,
      endsAt: end,
    });
    start = end;
  }
  return segments;
}

function nextSegmentEnd(content: string, start: number): number {
  if ([...content.slice(start)].length <= textSegmentMaxChars)
    return content.length;
  const maxEnd = indexAfterCodePoints(content, start, textSegmentMaxChars);
  const targetEnd = indexAfterCodePoints(
    content,
    start,
    textSegmentTargetChars,
  );
  return preferredBoundary(content, start, targetEnd, maxEnd) ?? maxEnd;
}

function preferredBoundary(
  content: string,
  start: number,
  targetEnd: number,
  maxEnd: number,
): number | undefined {
  const minEnd = start + Math.floor((targetEnd - start) / 2);
  const window = content.slice(start, maxEnd);
  for (const pattern of ['\n\n', '\n', ' ', '\t']) {
    const relative = window.lastIndexOf(pattern);
    const end = relative >= 0 ? start + relative + pattern.length : 0;
    if (end >= minEnd && end > start) return end;
  }
  return undefined;
}

function indexAfterCodePoints(
  content: string,
  start: number,
  count: number,
): number {
  let index = start;
  let seen = 0;
  for (const char of content.slice(start)) {
    if (seen === count) return index;
    index += char.length;
    seen += 1;
  }
  return content.length;
}
