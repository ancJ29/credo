import { runFake } from './cli';
import { buildFake } from './fake';

process.exitCode = await runFake(process.argv.slice(2), buildFake, console.log);
