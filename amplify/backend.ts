// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
import { Function as LambdaFunction } from 'aws-cdk-lib/aws-lambda';
import { EmailIdentity } from 'aws-cdk-lib/aws-ses';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { IConstruct } from 'constructs';
import { auth } from './auth/resource';
import { data } from './data/resource';
import { storage } from './storage/resource';
import { preTokenGeneration } from './auth/pre-token-generation/resource';

const backend = defineBackend({
  auth,
  data,
  storage,
  preTokenGeneration,
});

function findAuthLambda(scope: IConstruct, nameFragment: string): LambdaFunction | undefined {
  let found: LambdaFunction | undefined;
  const visit = (node: IConstruct): void => {
    if (node instanceof LambdaFunction && node.node.path.includes(nameFragment)) {
      found = node;
    }
    for (const child of node.node.children) {
      visit(child);
    }
  };
  visit(scope);
  return found;
}

const adminCognitoLambda = findAuthLambda(backend.data.stack, 'adminCognito');
const postConfirmationLambda = findAuthLambda(backend.auth.stack, 'postconfirmation');
const userPool = backend.auth.resources.userPool;
// TEST SENDER — replace with a verified DOMAIN identity before production (see PRODUCTION_TODO.md)
const SES_TEST_SENDER_EMAIL = 'i.ostolaza87@gmail.com';
const sesSenderEmail = process.env.SES_SENDER_EMAIL?.trim() || SES_TEST_SENDER_EMAIL;
const sesSenderIdentityArn = `arn:aws:ses:${backend.data.stack.region}:${backend.data.stack.account}:identity/${sesSenderEmail}`;
// TEST URLS — replace with custom domains before production (see PRODUCTION_TODO.md)
const ADMIN_APP_URL =
  process.env.ADMIN_APP_URL?.trim() || 'https://main.d11yajkly52yyj.amplifyapp.com';
const PORTAL_APP_URL =
  process.env.PORTAL_APP_URL?.trim() || 'https://main.daog7do89x2bd.amplifyapp.com';

if (adminCognitoLambda) {
  adminCognitoLambda.addEnvironment('AUTH_USERPOOLID', userPool.userPoolId);
  adminCognitoLambda.addEnvironment('SES_SENDER_EMAIL', sesSenderEmail);
  adminCognitoLambda.addEnvironment('ADMIN_APP_URL', ADMIN_APP_URL);
  adminCognitoLambda.addEnvironment('PORTAL_APP_URL', PORTAL_APP_URL);
  const senderIdentity = EmailIdentity.fromEmailIdentityName(
    backend.data.stack,
    'AdminInviteSesSender',
    sesSenderEmail
  );
  senderIdentity.grantSendEmail(adminCognitoLambda);
  adminCognitoLambda.addToRolePolicy(
    new PolicyStatement({
      effect: Effect.ALLOW,
      actions: ['ses:SendEmail', 'ses:SendRawEmail'],
      resources: [sesSenderIdentityArn],
      conditions: {
        StringEquals: {
          'ses:FromAddress': sesSenderEmail,
        },
      },
    })
  );
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminCreateUser');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminGetUser');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminUpdateUserAttributes');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminSetUserPassword');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminListGroupsForUser');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminAddUserToGroup');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminRemoveUserFromGroup');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminDisableUser');
  userPool.grant(adminCognitoLambda, 'cognito-idp:AdminEnableUser');
  userPool.grant(adminCognitoLambda, 'cognito-idp:ListGroups');
  userPool.grant(adminCognitoLambda, 'cognito-idp:CreateGroup');
  userPool.grant(adminCognitoLambda, 'cognito-idp:DeleteGroup');
  userPool.grant(adminCognitoLambda, 'cognito-idp:ListUsersInGroup');
}

if (postConfirmationLambda) {
  postConfirmationLambda.addEnvironment('AUTH_USERPOOLID', userPool.userPoolId);
  userPool.grant(postConfirmationLambda, 'cognito-idp:AdminAddUserToGroup');
}

// Gen 2 does not yet expose tokenGenerationVersion in defineAuth(); V2_0 is required
// to inject claims into access tokens (not just ID tokens).
const { cfnUserPool } = backend.auth.resources.cfnResources;
const { cfnFunction } = backend.preTokenGeneration.resources.cfnResources;
const preTokenGenArn = cfnFunction.attrArn;

cfnUserPool.addPropertyOverride('LambdaConfig.PreTokenGeneration', preTokenGenArn);
cfnUserPool.addPropertyOverride('LambdaConfig.PreTokenGenerationConfig', {
  LambdaArn: preTokenGenArn,
  LambdaVersion: 'V2_0',
});
