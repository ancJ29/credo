import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { writeDemoFiles } from './demo-files';

// The credo root is the folder that holds .bare: the parent of the repository's common git folder.
const common = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
  encoding: 'utf8',
}).trim();
const written = await writeDemoFiles(join(dirname(common), 'demo-files'), console.log);
console.log(`${written.length} files written, outside git`);
