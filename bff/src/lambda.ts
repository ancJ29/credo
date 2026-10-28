import awsLambdaFastify from '@fastify/aws-lambda';
import { readStorageEnv } from './env';
import { buildBff } from './server';

/** The BFF as API Gateway's HTTP API calls it (payload 2.0): the app `startBff` listens with,
 * handed events instead of sockets. Built once per cold start, so the environment is read, and
 * refused by name, before the first event. */
export function createLambdaHandler(
  env: Record<string, string | undefined>,
  options: { now?: () => number; logger?: boolean } = {},
) {
  return awsLambdaFastify(buildBff(readStorageEnv(env), options));
}
