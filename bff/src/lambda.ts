import awsLambdaFastify from '@fastify/aws-lambda';
import { readLambdaEnv } from './env';
import { buildBff } from './server';

/** The BFF as API Gateway's HTTP API calls it (payload 2.0): the app `startBff` listens with,
 * handed events instead of sockets. Built once per cold start, so the environment is read, and
 * refused by name, before the first event. */
export function createLambdaHandler(
  env: Record<string, string | undefined>,
  options: { now?: () => number; logger?: boolean } = {},
) {
  return awsLambdaFastify(buildBff(readLambdaEnv(env), options), {
    // The adapter sends a body as text unless its type is listed binary, which turns a picture's
    // bytes to text on Lambda and in no local check; the BFF compresses nothing, so every image
    // is the one case.
    enforceBase64: (response) => String(response.headers['content-type']).startsWith('image/'),
  });
}
