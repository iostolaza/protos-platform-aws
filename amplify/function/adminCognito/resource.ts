import { defineFunction } from '@aws-amplify/backend';

export const adminCognito = defineFunction({
  // Remove name and environment – Amplify injects them automatically
  // REGION is available as process.env.REGION in handler
});
