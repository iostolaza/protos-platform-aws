
// amplify/auth/post-confirmation/handler.ts 

import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';
import { env } from '$amplify/env/post-confirmation';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

export const handler: PostConfirmationTriggerHandler = async (event) => {
  const sub = event.request.userAttributes.sub;
  const email = event.request.userAttributes.email;
  const firstName = event.request.userAttributes.given_name || '';
  const lastName = event.request.userAttributes.family_name || '';
  const organizationId = event.request.userAttributes['custom:organizationId'] || null;
  const now = new Date().toISOString();

  const { data: existing } = await client.models.User.get({ cognitoId: sub });

  if (existing) {
    const { errors } = await client.models.User.update({
      cognitoId: sub,
      email: email ?? existing.email,
      firstName: firstName || existing.firstName,
      lastName: lastName || existing.lastName,
      organizationId: organizationId ?? existing.organizationId,
      status: 'active',
      updatedAt: now,
    });

    if (errors) {
      throw new Error(`Failed to activate user: ${errors.map((e) => e.message).join(', ')}`);
    }

    return event;
  }

  const { errors } = await client.models.User.create({
    cognitoId: sub,
    email,
    firstName,
    lastName,
    username: event.userName || email.split('@')[0],
    organizationId,
    status: 'active',
    createdAt: now,
    updatedAt: now,
  });

  if (errors) {
    throw new Error(`Failed to create user: ${errors.map((e) => e.message).join(', ')}`);
  }

  return event;
};
