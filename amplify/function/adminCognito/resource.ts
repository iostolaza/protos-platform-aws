import { defineFunction } from '@aws-amplify/backend';

/**
 * SES_SENDER_EMAIL is also set in amplify/backend.ts (process.env override or
 * the test default below). Verified SES identity must exist in us-west-1.
 */
export const adminCognito = defineFunction({
  resourceGroupName: 'data',
  environment: {
    // TEST SENDER — replace with a verified DOMAIN identity before production (see PRODUCTION_TODO.md)
    SES_SENDER_EMAIL: 'i.ostolaza87@gmail.com',
    // TEST URLS — replace with custom domains before production (see PRODUCTION_TODO.md)
    ADMIN_APP_URL: 'https://main.d11yajkly52yyj.amplifyapp.com',
    PORTAL_APP_URL: 'https://main.daog7do89x2bd.amplifyapp.com',
  },
});
