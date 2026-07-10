import type { PreSignUpTriggerHandler } from 'aws-lambda';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';
import { env } from '$amplify/env/pre-sign-up';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const client = generateClient<Schema>();

const ACTIVE_ORG_STATUSES = new Set(['active', 'trial']);

export const handler: PreSignUpTriggerHandler = async (event) => {
  const organizationId = event.request.userAttributes['custom:organizationId'];

  if (!organizationId?.trim()) {
    throw new Error('Sign-up requires a valid organization. Use your organization portal URL.');
  }

  const { data: org, errors } = await client.models.Organization.get({ organizationId });
  if (errors?.length || !org) {
    throw new Error('Invalid organization. This portal URL is not recognized.');
  }

  if (org.status === 'suspended') {
    throw new Error('This organization is suspended and is not accepting new sign-ups.');
  }

  if (!org.status || !ACTIVE_ORG_STATUSES.has(org.status)) {
    throw new Error('Invalid organization. This portal URL is not recognized.');
  }

  return event;
};
