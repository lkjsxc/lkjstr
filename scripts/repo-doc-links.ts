import fs from 'node:fs/promises';
import path from 'node:path';

export type RepoProblem = { file: string; message: string };
export type MarkdownLink = { href: string; line: number };

export function markdownLinks(text: string): MarkdownLink[] {
  const links: MarkdownLink[] = [];
  const lines = text.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (line.startsWith('```')) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const pattern =
      /!?\[[^\]\n]*(?:\][^\[\]\n]*)*\]\(([^)\s]+)(?:\s+['"][^)]*['"])?\)/g;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(line))) {
      const href = stripAngleBrackets(match[1]!);
      if (href) links.push({ href, line: i + 1 });
    }
  }
  return links;
}

export async function localMarkdownLinkProblems(
  root: string,
  file: string,
  text: string,
): Promise<RepoProblem[]> {
  const problems: RepoProblem[] = [];
  for (const link of markdownLinks(text)) {
    if (isExternalLink(link.href)) continue;
    const target = await resolveLocalLink(root, file, link.href);
    if (target.problem)
      problems.push({
        file,
        message: `line ${link.line} ${target.problem}`,
      });
  }
  return problems;
}

async function resolveLocalLink(
  root: string,
  file: string,
  href: string,
): Promise<{ problem?: string }> {
  const [rawPath, rawAnchor = ''] = href.split('#');
  const targetFile = rawPath
    ? path.normalize(path.join(path.dirname(file), decodeLink(rawPath)))
    : file;
  if (targetFile.startsWith('..') || path.isAbsolute(targetFile))
    return { problem: `local link escapes repository: ${href}` };
  const stat = await fs.stat(path.join(root, targetFile)).catch(() => null);
  if (!stat) return { problem: `local link target missing: ${href}` };
  if (!rawAnchor || stat.isDirectory()) return {};
  if (path.extname(targetFile).toLowerCase() !== '.md') return {};
  const targetText = await fs.readFile(path.join(root, targetFile), 'utf8');
  const anchors = markdownHeadingAnchors(targetText);
  const anchor = decodeLink(rawAnchor);
  if (!anchors.has(anchor))
    return { problem: `local link anchor missing: ${href}` };
  return {};
}

function isExternalLink(href: string): boolean {
  return /^[a-z][a-z0-9+.-]*:/i.test(href) || href.startsWith('//');
}

function stripAngleBrackets(href: string): string {
  return href.replace(/^<|>$/g, '');
}

function decodeLink(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function markdownHeadingAnchors(text: string): Set<string> {
  const seen = new Map<string, number>();
  const anchors = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (!match) continue;
    const base = githubHeadingSlug(match[2]!);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    anchors.add(count === 0 ? base : `${base}-${count}`);
  }
  return anchors;
}

function githubHeadingSlug(text: string): string {
  return text
    .trim()
    .replace(/`([^`]+)`/g, '$1')
    .replace(/<[^>]+>/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 _-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
