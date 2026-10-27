import { runStack } from './cli';
import { buildArtifacts } from './stack';

process.exitCode = await runStack(process.argv.slice(2), buildArtifacts, console.log);
