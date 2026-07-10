import { defineFunction } from '@aws-amplify/backend';

/**
 * SES_SENDER_EMAIL is injected at deploy time in amplify/backend.ts from
 * process.env.SES_SENDER_EMAIL (verified SES identity in us-west-1).
 * Default empty here so this file stays browser-safe — it is pulled into
 * Angular builds via @amplify-schema → data/resource.ts imports.
 *
 * Deploy example:
 *   SES_SENDER_EMAIL=no-reply@yourdomain.com npx ampx sandbox --once --profile amplify-admin
 */
export const adminCognito = defineFunction({
  resourceGroupName: 'data',
  environment: {
    SES_SENDER_EMAIL: '',
  },
});
