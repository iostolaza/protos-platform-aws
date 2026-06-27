// amplify/auth/resource.ts
import { defineAuth } from '@aws-amplify/backend';
import { postConfirmation } from './post-confirmation/resource';

export const auth = defineAuth({
  loginWith: { email: true },
  groups: ['user_Admin', 'user_Manager', 'user_Tenant', 'user_Facilities', 'user_Employee'],
  triggers: { postConfirmation },
});