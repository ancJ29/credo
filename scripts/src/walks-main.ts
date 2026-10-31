import { execFileSync } from 'node:child_process';
import { walksCommand } from './walks';

const stdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

/** A process's working folder by lsof; undefined when it cannot be read. */
const cwdOf = (pid: number) => {
  try {
    const found = execFileSync('lsof', ['-a', '-d', 'cwd', '-p', String(pid), '-Fn'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    return /^n(.*)$/m.exec(found)?.[1];
  } catch {
    return undefined;
  }
};

process.exitCode = await walksCommand(process.argv.slice(2), { stdin, out: console.log, cwdOf });
