export type Utf8ByteLengthResult = {
  readonly within: boolean;
  readonly bytes: number;
};

export function utf8ByteLengthWithin(
  text: string,
  limit: number,
): Utf8ByteLengthResult {
  let bytes = 0;
  for (let index = 0; index < text.length; index++) {
    const code = text.charCodeAt(index);
    if (code <= 0x7f) bytes += 1;
    else if (code <= 0x7ff) bytes += 2;
    else if (
      isHighSurrogate(code) &&
      isLowSurrogate(text.charCodeAt(index + 1))
    ) {
      bytes += 4;
      index++;
    } else {
      bytes += 3;
    }
    if (bytes > limit) return { within: false, bytes };
  }
  return { within: true, bytes };
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff;
}

function isLowSurrogate(code: number): boolean {
  return code >= 0xdc00 && code <= 0xdfff;
}
