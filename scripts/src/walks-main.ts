import { walksCommand } from './walks';

const stdin = async () => {
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
};

process.exitCode = await walksCommand(process.argv.slice(2), { stdin, out: console.log });
