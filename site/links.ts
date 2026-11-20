import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { dirname, matchesGlob, relative, resolve } from 'node:path';

// The link plugin: a Markdown link to a file of the repository that the site leaves out (a plan, a
// recap, a CLAUDE.md, a code line) becomes a GitHub link at the commit that was built, so it opens
// from the site. A link to a page the site shows is left for Docusaurus to resolve, and a link to a
// path the repository does not hold is left too, so the build still names it as broken.

const ROOT = resolve(__dirname, '..');

const git = (...args: string[]) =>
  execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim();

// The repository's address and the built commit: GitHub's own variables under Actions, else read
// from git, so no address is written in the repository.
function githubBase(env: NodeJS.ProcessEnv = process.env): string {
  const sha = env.GITHUB_SHA || git('rev-parse', 'HEAD');
  let repo = env.GITHUB_REPOSITORY
    ? `${env.GITHUB_SERVER_URL || 'https://github.com'}/${env.GITHUB_REPOSITORY}`
    : '';
  if (!repo) {
    const origin = git('remote', 'get-url', 'origin');
    const found = /github\.com[:/](.+?)(\.git)?$/.exec(origin);
    if (!found) throw new Error(`the link plugin: origin is not a GitHub address (${origin})`);
    repo = `https://github.com/${found[1]}`;
  }
  return `${repo}/%s/${sha}/`;
}

type Node = { type: string; url?: string; children?: Node[] };

// The remark plugin, run before Docusaurus resolves Markdown links. `pages` are the site's include globs.
export function githubLinks(pages: string[], base: string = githubBase()) {
  const rewrite = (url: string, from: string): string => {
    if (/^([a-z][a-z0-9+.-]*:|#|\/)/i.test(url)) return url;
    const cut = url.search(/[?#]/);
    const path = cut < 0 ? url : url.slice(0, cut);
    if (path === '') return url;
    const target = resolve(dirname(from), decodeURI(path));
    const rel = relative(ROOT, target);
    if (rel.startsWith('..') || !existsSync(target)) return url;
    if (pages.some((glob) => matchesGlob(rel, glob))) return url;
    const kind = statSync(target).isDirectory() ? 'tree' : 'blob';
    return base.replace('%s', kind) + rel + (cut < 0 ? '' : url.slice(cut));
  };
  const walk = (node: Node, from: string) => {
    if ((node.type === 'link' || node.type === 'definition') && node.url)
      node.url = rewrite(node.url, from);
    node.children?.forEach((child) => walk(child, from));
  };
  return () => (tree: Node, file: { path: string }) => walk(tree, file.path);
}
