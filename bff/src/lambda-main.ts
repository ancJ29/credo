import { createLambdaHandler } from './lambda';

export const handler = createLambdaHandler(process.env);
