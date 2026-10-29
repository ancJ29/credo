import { runDemo } from './cli';
import { buildArtifacts } from './stack';

process.exitCode = await runDemo(process.argv.slice(2), buildArtifacts, console.log, {
  partner: process.env.CREDO_DEMO_PARTNER,
});
