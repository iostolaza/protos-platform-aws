import {
  CognitoIdentityProviderClient,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminCreateUserCommand,
  AdminGetUserCommand,
  AdminUpdateUserAttributesCommand,
  AdminSetUserPasswordCommand,
  AdminListGroupsForUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListGroupsCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { getAmplifyDataClientConfig } from '@aws-amplify/backend/function/runtime';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';
import { env } from '$amplify/env/adminCognito';
import { isValidEmail, isValidInviteRole, isValidOrgId, sanitizeText } from './validation';

const { resourceConfig, libraryOptions } = await getAmplifyDataClientConfig(env);
Amplify.configure(resourceConfig, libraryOptions);

const dataClient = generateClient<Schema>();
const lambdaRegion = process.env.AWS_REGION ?? process.env.REGION ?? 'us-west-1';
const cognito = new CognitoIdentityProviderClient({ region: lambdaRegion });
const ses = new SESClient({ region: lambdaRegion });
const USER_POOL_ID = process.env.AUTH_USERPOOLID!;

function requireSesSenderEmail(): string {
  const sender = process.env.SES_SENDER_EMAIL?.trim();
  if (!sender) {
    throw new Error(
      'SES_SENDER_EMAIL is not configured. Set it to a verified SES identity at deploy time.'
    );
  }
  return sender;
}

function describeSesSendFailure(error: unknown, recipient: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const name = error instanceof Error ? error.name : 'Error';
  const lower = message.toLowerCase();

  if (lower.includes('ses_sender_email is not configured')) {
    return `SES_SENDER_EMAIL is not configured; invite email to ${recipient} was not sent.`;
  }

  const unverifiedRecipient =
    lower.includes('not verified') ||
    lower.includes('messagerejected') ||
    lower.includes('email address is not verified') ||
    lower.includes('address is not verified');

  if (unverifiedRecipient) {
    return (
      `SES sandbox rejected invite to unverified recipient ${recipient}. ` +
      'Verify the recipient in SES (us-west-1) or request production access. ' +
      `Details: ${name}: ${message}`
    );
  }

  return `Invite email to ${recipient} was not sent. Details: ${name}: ${message}`;
}

const roleToGroup: Record<string, string> = {
  Tenant: 'user_Tenant',
  Manager: 'user_Manager',
  Facilities: 'user_Facilities',
  Admin: 'user_Admin',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

type InviteTemplateKey = 'Tenant' | 'Employee';

function getInviteSignInUrl(templateKey: InviteTemplateKey): string {
  const envKey = templateKey === 'Tenant' ? 'PORTAL_APP_URL' : 'ADMIN_APP_URL';
  const base = process.env[envKey]?.trim();
  if (!base) {
    throw new Error(
      `${envKey} is not configured. Set it to the app sign-in base URL at deploy time.`
    );
  }
  return `${base.replace(/\/$/, '')}/sign-in`;
}

function inviteEmailSubject(templateKey: InviteTemplateKey): string {
  return templateKey === 'Tenant'
    ? 'Protos – Your tenant portal invitation'
    : 'Protos – Your staff account invitation';
}

function buildInviteEmailBodies(input: {
  firstName: string;
  email: string;
  tempPassword: string;
  role: string;
  templateKey: InviteTemplateKey;
  signInUrl: string;
}): { html: string; text: string } {
  const safeFirst = escapeHtml(input.firstName);
  const safeEmail = escapeHtml(input.email);
  const safePassword = escapeHtml(input.tempPassword);
  const safeRole = escapeHtml(input.role);
  const safeUrl = escapeHtml(input.signInUrl);

  const htmlIntro =
    input.templateKey === 'Tenant'
      ? 'You&rsquo;ve been invited to join Protos as a tenant.'
      : `You&rsquo;ve been invited to join Protos as <strong>${safeRole}</strong>.`;

  const textIntro =
    input.templateKey === 'Tenant'
      ? "You've been invited to join Protos as a tenant."
      : `You've been invited to join Protos as ${input.role}.`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Protos Invitation</title>
</head>
<body style="font-family: Arial, Helvetica, sans-serif; font-size: 16px; line-height: 1.5; color: #222222; margin: 0; padding: 0;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <h1 style="font-size: 22px; color: #1e3a8a; margin: 0 0 16px 0;">Welcome to Protos, ${safeFirst}!</h1>
    <p style="margin: 0 0 16px 0;">${htmlIntro}</p>
    <p style="margin: 0 0 8px 0;"><strong>Email:</strong> ${safeEmail}</p>
    <p style="margin: 0 0 16px 0;"><strong>Temporary password:</strong> ${safePassword}</p>
    <p style="margin: 0 0 16px 0; font-size: 18px;">
      <a href="${safeUrl}" style="color: #1e40af; font-weight: bold; text-decoration: underline;">Sign in here: ${safeUrl}</a>
    </p>
    <p style="margin: 0; font-size: 14px; color: #555555;">
      You will be asked to set a new password on your first login.
      If you did not expect this invitation, you can ignore this email.
    </p>
  </div>
</body>
</html>`;

  const text = `Welcome to Protos, ${input.firstName}!

${textIntro}

Email: ${input.email}
Temporary password: ${input.tempPassword}

Sign in here: ${input.signInUrl}

You will be asked to set a new password on your first login.
If you did not expect this invitation, you can ignore this email.`;

  return { html, text };
}

const GRAPHQL_ACTION_MAP: Record<string, string> = {
  adminInviteUser: 'inviteUser',
  adminListGroups: 'listGroups',
  adminListGroupsForUser: 'listGroupsForUser',
  adminAddUserToGroup: 'addUserToGroup',
  adminRemoveUserFromGroup: 'removeUserFromGroup',
  adminListUsersInGroup: 'listUsersInGroup',
  adminDisableUser: 'disableUser',
  adminEnableUser: 'enableUser',
};

interface AdminPayload {
  email?: string;
  firstName?: string;
  lastName?: string;
  role?: string;
  applicationType?: string;
  organizationId?: string;
  groupName?: string;
  username?: string;
}

function toAdminPayload(raw: Record<string, unknown>): AdminPayload {
  return {
    email: typeof raw.email === 'string' ? raw.email : undefined,
    firstName: typeof raw.firstName === 'string' ? raw.firstName : undefined,
    lastName: typeof raw.lastName === 'string' ? raw.lastName : undefined,
    role: typeof raw.role === 'string' ? raw.role : undefined,
    applicationType: typeof raw.applicationType === 'string' ? raw.applicationType : undefined,
    organizationId: typeof raw.organizationId === 'string' ? raw.organizationId : undefined,
    groupName: typeof raw.groupName === 'string' ? raw.groupName : undefined,
    username: typeof raw.username === 'string' ? raw.username : undefined,
  };
}

function normalizeEvent(event: {
  action?: string;
  payload?: Record<string, unknown>;
  fieldName?: string;
  arguments?: Record<string, unknown>;
}): { action: string; payload: AdminPayload } {
  if (event.action) {
    return { action: event.action, payload: toAdminPayload(event.payload ?? {}) };
  }
  const fieldName = event.fieldName;
  const args = event.arguments ?? {};
  if (fieldName && GRAPHQL_ACTION_MAP[fieldName]) {
    return { action: GRAPHQL_ACTION_MAP[fieldName], payload: toAdminPayload(args) };
  }
  return { action: '', payload: toAdminPayload(args) };
}

function requireEmail(payload: AdminPayload): string {
  const email = sanitizeText(payload.email ?? '');
  if (!isValidEmail(email)) {
    throw new Error('email is required and must be a valid email address');
  }
  return email;
}

function requireGroupName(payload: AdminPayload): string {
  const groupName = sanitizeText(payload.groupName ?? '');
  if (!groupName) {
    throw new Error('groupName is required');
  }
  return groupName;
}

async function assertOrganizationExists(organizationId: string): Promise<void> {
  const { data, errors } = await dataClient.models.Organization.get({ organizationId });
  if (errors?.length || !data) {
    throw new Error(`organizationId does not match an existing Organization: ${organizationId}`);
  }
}

async function updateUserStatusByEmail(email: string, status: string): Promise<void> {
  const { data: users } = await dataClient.models.User.listUserByEmail({ email });
  const user = users?.[0];
  if (user) {
    await dataClient.models.User.update({ cognitoId: user.cognitoId, status });
  }
}

function cognitoIdFromCreateUserResponse(
  user: { Username?: string; Attributes?: Array<{ Name?: string; Value?: string }> } | undefined
): string {
  const sub = user?.Attributes?.find((attr) => attr.Name === 'sub')?.Value;
  if (sub) {
    return sub;
  }
  if (user?.Username) {
    return user.Username;
  }
  throw new Error('Failed to resolve cognitoId from Cognito user');
}

function isUsernameExistsException(error: unknown): boolean {
  const name = error instanceof Error ? error.name : '';
  const message = error instanceof Error ? error.message : String(error);
  return (
    name === 'UsernameExistsException' ||
    message.includes('UsernameExistsException') ||
    message.toLowerCase().includes('already exists')
  );
}

function generateTempPassword(): string {
  return Math.random().toString(36).slice(-10) + 'A1!';
}

type InviteUserResult = {
  invited: boolean;
  emailSent: boolean;
  userAlreadyExisted?: boolean;
  warning?: string | null;
};

async function syncUserRoleGroup(email: string, groupName: string): Promise<void> {
  const existingGroups = await cognito.send(
    new AdminListGroupsForUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: email,
    })
  );

  for (const group of existingGroups.Groups ?? []) {
    const existingGroupName = group.GroupName;
    if (existingGroupName && Object.values(roleToGroup).includes(existingGroupName)) {
      try {
        await cognito.send(
          new AdminRemoveUserFromGroupCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            GroupName: existingGroupName,
          })
        );
      } catch (error) {
        console.warn(`Could not remove ${email} from ${existingGroupName}:`, error);
      }
    }
  }

  try {
    await cognito.send(
      new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      })
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.toLowerCase().includes('already')) {
      throw error;
    }
  }
}

async function sendInviteEmail(input: {
  email: string;
  firstName: string;
  applicationType: string;
  role: string;
  tempPassword: string;
  templateKey: InviteTemplateKey;
}): Promise<{ emailSent: boolean; warning: string | null }> {
  const signInUrl = getInviteSignInUrl(input.templateKey);
  const { html, text } = buildInviteEmailBodies({
    firstName: input.firstName,
    email: input.email,
    tempPassword: input.tempPassword,
    role: input.role,
    templateKey: input.templateKey,
    signInUrl,
  });

  try {
    const senderEmail = requireSesSenderEmail();
    await ses.send(
      new SendEmailCommand({
        Source: senderEmail,
        Destination: { ToAddresses: [input.email] },
        Message: {
          Subject: { Data: inviteEmailSubject(input.templateKey) },
          Body: {
            Html: { Data: html },
            Text: { Data: text },
          },
        },
      })
    );
    return { emailSent: true, warning: null };
  } catch (emailError) {
    const warning = describeSesSendFailure(emailError, input.email);
    console.warn(warning);
    return { emailSent: false, warning };
  }
}

async function createInvitedUserRecord(input: {
  cognitoId: string;
  email: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  role: string;
}): Promise<void> {
  const now = new Date().toISOString();
  const { data: existing } = await dataClient.models.User.get({ cognitoId: input.cognitoId });

  if (existing) {
    const { errors } = await dataClient.models.User.update({
      cognitoId: input.cognitoId,
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      organizationId: input.organizationId ?? existing.organizationId,
    role: input.role as Schema['User']['type']['role'],
    status: 'invited',
    profileComplete: false,
    updatedAt: now,
    });
    if (errors?.length) {
      throw new Error(`Failed to update invited user: ${errors.map((e) => e.message).join(', ')}`);
    }
    return;
  }

  const { errors } = await dataClient.models.User.create({
    cognitoId: input.cognitoId,
    email: input.email,
    firstName: input.firstName,
    lastName: input.lastName,
    username: input.email.split('@')[0],
    organizationId: input.organizationId,
    role: input.role as Schema['User']['type']['role'],
    status: 'invited',
    profileComplete: false,
    createdAt: now,
    updatedAt: now,
  });
  if (errors?.length) {
    throw new Error(`Failed to create invited user: ${errors.map((e) => e.message).join(', ')}`);
  }
}

export const handler = async (event: { action?: string; payload?: Record<string, unknown>; fieldName?: string; arguments?: Record<string, unknown> }) => {
  const { action, payload } = normalizeEvent(event);

  switch (action) {
    case 'inviteUser': {
      const email = requireEmail(payload);
      const firstName = sanitizeText(payload.firstName ?? '');
      const lastName = sanitizeText(payload.lastName ?? '');
      const role = payload.role ?? '';
      const applicationType = payload.applicationType ?? 'Employee';
      const organizationId = payload.organizationId ? sanitizeText(payload.organizationId) : undefined;
      if (!firstName || !lastName) {
        throw new Error('firstName and lastName are required');
      }
      if (!organizationId) {
        throw new Error('organizationId is required');
      }
      if (!isValidOrgId(organizationId)) {
        throw new Error('Invalid organizationId format');
      }
      await assertOrganizationExists(organizationId);
      if (!isValidInviteRole(role)) {
        throw new Error(`Invalid role. Must be one of: Admin, Manager, Facilities, Tenant`);
      }

      const groupName = roleToGroup[role];
      const templateKey = applicationType === 'Tenant' ? 'Tenant' : 'Employee';
      let userAlreadyExisted = false;
      let cognitoId: string;
      let tempPassword = generateTempPassword();

      try {
        const createUserResponse = await cognito.send(
          new AdminCreateUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            TemporaryPassword: tempPassword,
            UserAttributes: [
              { Name: 'email', Value: email },
              { Name: 'email_verified', Value: 'true' },
              { Name: 'given_name', Value: firstName },
              { Name: 'family_name', Value: lastName },
              { Name: 'custom:organizationId', Value: organizationId },
            ],
            MessageAction: 'SUPPRESS',
          })
        );
        cognitoId = cognitoIdFromCreateUserResponse(createUserResponse.User);
      } catch (error) {
        if (!isUsernameExistsException(error)) {
          throw error;
        }

        userAlreadyExisted = true;
        const existingUser = await cognito.send(
          new AdminGetUserCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
          })
        );
        cognitoId = cognitoIdFromCreateUserResponse({
          Username: existingUser.Username,
          Attributes: existingUser.UserAttributes,
        });

        await cognito.send(
          new AdminUpdateUserAttributesCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            UserAttributes: [
              { Name: 'given_name', Value: firstName },
              { Name: 'family_name', Value: lastName },
              { Name: 'custom:organizationId', Value: organizationId },
            ],
          })
        );

        tempPassword = generateTempPassword();
        await cognito.send(
          new AdminSetUserPasswordCommand({
            UserPoolId: USER_POOL_ID,
            Username: email,
            Password: tempPassword,
            Permanent: false,
          })
        );
      }

      await syncUserRoleGroup(email, groupName);

      await createInvitedUserRecord({
        cognitoId,
        email,
        firstName,
        lastName,
        organizationId,
        role,
      });

      const { emailSent, warning: emailWarning } = await sendInviteEmail({
        email,
        firstName,
        applicationType,
        role,
        tempPassword,
        templateKey,
      });

      const warnings: string[] = [];
      if (userAlreadyExisted) {
        warnings.push('User already existed in Cognito; profile and role were updated.');
      }
      if (emailWarning) {
        warnings.push(emailWarning);
      }

      const result: InviteUserResult = {
        invited: true,
        emailSent,
        userAlreadyExisted,
        warning: warnings.length > 0 ? warnings.join(' ') : null,
      };
      return result;
    }

    case 'listGroups': {
      const res = await cognito.send(new ListGroupsCommand({ UserPoolId: USER_POOL_ID }));
      return res.Groups?.map((g: any) => g.GroupName) || [];
    }

    case 'listGroupsForUser': {
      const email = requireEmail(payload);
      const res = await cognito.send(
        new AdminListGroupsForUserCommand({
          UserPoolId: USER_POOL_ID,
          Username: email,
        })
      );
      return res.Groups?.map((g) => g.GroupName).filter((name): name is string => !!name) ?? [];
    }

    case 'createGroup': {
      const groupName = requireGroupName(payload);
      await cognito.send(new CreateGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
      }));
      return true;
    }

    case 'deleteGroup': {
      const groupName = requireGroupName(payload);
      await cognito.send(new DeleteGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
      }));
      return true;
    }

    case 'addUserToGroup': {
      const email = requireEmail(payload);
      const groupName = requireGroupName(payload);
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      }));
      return true;
    }

    case 'removeUserFromGroup': {
      const email = requireEmail(payload);
      const groupName = requireGroupName(payload);
      await cognito.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      }));
      return true;
    }

    case 'listUsersInGroup': {
      const groupName = requireGroupName(payload);
      const res = await cognito.send(new ListUsersInGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
      }));
      return res.Users?.map((u: any) => ({
        email: u.Attributes?.find((a: any) => a.Name === 'email')?.Value,
        cognitoId: u.Username,
      })) || [];
    }

    case 'disableUser': {
      const email = requireEmail(payload);
      await cognito.send(new AdminDisableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }));
      await updateUserStatusByEmail(email, 'disabled');
      return true;
    }

    case 'enableUser': {
      const email = requireEmail(payload);
      await cognito.send(new AdminEnableUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
      }));
      await updateUserStatusByEmail(email, 'active');
      return true;
    }

    default:
      throw new Error('Invalid action');
  }
};
