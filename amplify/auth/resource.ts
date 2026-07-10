// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';
import { preTokenGeneration } from './pre-token-generation/resource';
import { preSignUp } from './pre-sign-up/resource';

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
  // Set at admin invite (AdminCreateUser) or portal self-signup (signUp userAttributes).
    'custom:organizationId': {
      dataType: 'String',
      mutable: false,
      minLen: 1,
      maxLen: 128,
    },
  },
  triggers: {
    preSignUp,
    postConfirmation,
    preTokenGeneration,
  },
});
