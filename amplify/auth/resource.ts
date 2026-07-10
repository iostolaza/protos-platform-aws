// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';
import { preTokenGeneration } from './pre-token-generation/resource';

export const auth = defineAuth({
  loginWith: { email: true },
  groups: [
    'platform_SuperAdmin',
    'user_Admin',
    'user_Manager',
    'user_Tenant',
    'user_Facilities',
    'user_Employee',
    'team_lead',
    'member',
  ],
  userAttributes: {
  // Admin/backend-only: mutable:false blocks UpdateUserAttributes from clients.
  // Value is set via AdminCreateUser in adminCognito Lambda only.
    'custom:organizationId': {
      dataType: 'String',
      mutable: false,
      minLen: 1,
      maxLen: 128,
    },
  },
  triggers: {
    postConfirmation,
    preTokenGeneration,
  },
});
