
// amplify/auth/post-confirmation/handler.ts 

import type { PostConfirmationTriggerHandler } from 'aws-lambda'; 
import { type Schema } from '../../data/resource';
import { Amplify } from 'aws-amplify'; 
import { generateClient } from 'aws-amplify/data';
import { env } from '$amplify/env/post-confirmation';

console.log('Environment variables:', env);

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
      region: env.AWS_REGION,
      defaultAuthMode: 'iam'
    }
  }
});

const client = generateClient<Schema>({ authMode: 'iam' });

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const sub = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const firstName = event.request.userAttributes.given_name || '';
  const lastName = event.request.userAttributes.family_name || '';

  const { data: existing } = await client.models.User.get({ cognitoId: sub });
  if (existing) return event;

  const { errors } = await client.models.User.create({
    cognitoId: sub,
    email,
    firstName,
    lastName,
    username: event.userName || email.split('@')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  if (errors) throw new Error(`Failed to create user: ${errors.map(e => e.message).join(', ')}`);

  return event;
};