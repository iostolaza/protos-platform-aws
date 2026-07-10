import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  ListGroupsCommand,
  CreateGroupCommand,
  DeleteGroupCommand,
  ListUsersInGroupCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { Amplify } from 'aws-amplify';
import { generateClient } from 'aws-amplify/data';
import { type Schema } from '../../data/resource';
import { env } from '$amplify/env/adminCognito';
import { isValidEmail, isValidInviteRole, isValidOrgId, sanitizeText } from './validation';

Amplify.configure({
  API: {
    GraphQL: {
      endpoint: env.AMPLIFY_DATA_GRAPHQL_ENDPOINT,
      region: env.AWS_REGION,
      defaultAuthMode: 'iam',
    },
  },
});

const dataClient = generateClient<Schema>({ authMode: 'iam' });
const cognito = new CognitoIdentityProviderClient({ region: process.env.REGION! });
const ses = new SESClient({ region: process.env.REGION! });
const USER_POOL_ID = process.env.AUTH_USERPOOLID!;

const roleToGroup: Record<string, string> = {
  Tenant: 'user_Tenant',
  Manager: 'user_Manager',
  Facilities: 'user_Facilities',
  Admin: 'user_Admin',
};

// Full HTML Templates
const templates: Record<'Tenant' | 'Employee', string> = {
  Tenant: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Rental Application - Protos</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 font-sans">
    <div class="max-w-2xl mx-auto my-8 p-8 bg-white rounded-lg shadow-xl">
        <h1 class="text-3xl font-bold text-center text-indigo-700 mb-6">Protos Rental Application</h1>
        <p class="text-center text-lg mb-4">Hello {{firstName}},</p>
        <p class="text-center mb-4">You've been invited to apply as a Tenant.</p>
        <p class="text-center text-xl font-bold text-indigo-600 mb-8">Temporary Password: {{temporaryPassword}}</p>
        <p class="text-center mb-8">Please complete the full rental application below.</p>

        <!-- Phase 1: Quick Apply Form -->
        <div class="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md mb-8">
            <h2 class="text-2xl font-bold text-center mb-6">Step 1: Basic Information</h2>
            <form id="quick-apply-form" class="space-y-4" onsubmit="saveProgress(event, 'quick-apply')">
                <div>
                    <label class="block text-sm font-medium text-gray-700">Full Name</label>
                    <input type="text" name="full-name" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Email Address</label>
                    <input type="email" name="email" value="{{email}}" readonly class="mt-1 block w-full border-gray-300 rounded-md shadow-sm sm:text-sm bg-gray-100" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Phone Number</label>
                    <input type="tel" name="phone" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Property Address / Unit</label>
                    <input type="text" name="property-address" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Desired Move-in Date</label>
                    <input type="date" name="move-in-date" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Lease Term</label>
                    <select name="lease-term" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="6 months">6 Months</option>
                        <option value="12 months">12 Months</option>
                        <option value="flexible">Flexible</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Number of Occupants</label>
                    <input type="number" name="occupants" min="1" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm" />
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Monthly Income Range</label>
                    <select name="income-range" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="0-2000">$0 - $2,000</option>
                        <option value="2001-4000">$2,001 - $4,000</option>
                        <option value="4001-6000">$4,001 - $6,000</option>
                        <option value="6001+">$6,001+</option>
                    </select>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Any Pets?</label>
                    <select name="pets" required onchange="togglePetDetails(this)" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                    </select>
                    <textarea name="pet-details" class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm hidden" placeholder="Describe pets (type, number, etc.)"></textarea>
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700">Smoking?</label>
                    <select name="smoking" required class="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm">
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                    </select>
                </div>
                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700">Continue to Step 2</button>
            </form>
        </div>

        <!-- Phase 2: Main Application -->
        <div class="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md mb-8 hidden" id="main-application">
            <h2 class="text-2xl font-bold text-center mb-6">Step 2: Employment & Rental History</h2>
            <form id="main-application-form" class="space-y-4" onsubmit="saveProgress(event, 'main-application')">
                <!-- All your original Phase 2 fields here -->
                <!-- ... (paste the rest from your original) ... -->
                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700">Continue to Review</button>
            </form>
        </div>

        <!-- Phase 3: Review & Consent -->
        <div class="max-w-lg mx-auto p-6 bg-white rounded-lg shadow-md hidden" id="review-consent">
            <h2 class="text-2xl font-bold text-center mb-6">Step 3: Review & Sign</h2>
            <form id="review-consent-form" class="space-y-4" onsubmit="saveProgress(event, 'review-consent')">
                <!-- All your original Phase 3 fields here -->
                <button type="submit" class="w-full bg-indigo-600 text-white py-3 rounded-md hover:bg-indigo-700">Submit Application</button>
            </form>
        </div>

        <script>
            function saveProgress(event, formId) {
                event.preventDefault();
                const form = document.getElementById(\`\${formId}-form\`);
                const formData = new FormData(form);
                const data = {};
                formData.forEach((value, key) => data[key] = value);
                localStorage.setItem(formId, JSON.stringify(data));

                if (formId === 'quick-apply') {
                    document.querySelector('#quick-apply-form').parentElement.classList.add('hidden');
                    document.getElementById('main-application').classList.remove('hidden');
                } else if (formId === 'main-application') {
                    document.getElementById('main-application').classList.add('hidden');
                    document.getElementById('review-consent').classList.remove('hidden');
                } else {
                    alert('Application submitted successfully!');
                    localStorage.clear();
                }
            }

            function togglePetDetails(select) {
                const details = document.querySelector('[name="pet-details"]');
                details.classList.toggle('hidden', select.value === 'no');
                details.required = select.value === 'yes';
            }

            window.onload = function() {
                ['quick-apply', 'main-application', 'review-consent'].forEach(id => {
                    const data = JSON.parse(localStorage.getItem(id) || 'null');
                    if (data) {
                        const form = document.getElementById(\`\${id}-form\`);
                        Object.keys(data).forEach(key => {
                            const el = form.querySelector(\`[name="\${key}"]\`);
                            if (el) el.value = data[key];
                        });
                    }
                });
            };
        </script>
    </div>
</body>
</html>`,

  Employee: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Employee Onboarding - Protos</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 font-sans">
    <div class="max-w-2xl mx-auto my-8 p-8 bg-white rounded-lg shadow-xl">
        <h1 class="text-3xl font-bold text-center text-indigo-700 mb-6">Welcome to Protos, {{firstName}}!</h1>
        <p class="text-center text-lg mb-6">You've been invited to join as a <strong>{{role}}</strong>.</p>
        <p class="text-center text-xl font-bold text-indigo-600 mb-8">Temporary Password: {{temporaryPassword}}</p>
        <p class="text-center mb-10">Please complete your employee onboarding form below.</p>

        <form class="space-y-8">
            <section>
                <h2 class="text-2xl font-semibold mb-4">Personal Information</h2>
                <input type="text" placeholder="Full Legal Name" required class="w-full border rounded px-4 py-2 mb-3" />
                <input type="date" placeholder="Date of Birth" class="w-full border rounded px-4 py-2 mb-3" />
                <input type="text" placeholder="SSN / Tax ID" class="w-full border rounded px-4 py-2 mb-3" />
                <input type="tel" placeholder="Personal Phone" required class="w-full border rounded px-4 py-2 mb-3" />
            </section>

            <section>
                <h2 class="text-2xl font-semibold mb-4">Emergency Contact</h2>
                <input type="text" placeholder="Name" required class="w-full border rounded px-4 py-2 mb-3" />
                <input type="tel" placeholder="Phone" required class="w-full border rounded px-4 py-2 mb-3" />
                <input type="text" placeholder="Relationship" class="w-full border rounded px-4 py-2 mb-3" />
            </section>

            <section>
                <h2 class="text-2xl font-semibold mb-4">Employment Details</h2>
                <input type="date" placeholder="Preferred Start Date" class="w-full border rounded px-4 py-2 mb-3" />
                <select class="w-full border rounded px-4 py-2 mb-3">
                    <option>Full-Time</option>
                    <option>Part-Time</option>
                    <option>Contract</option>
                </select>
                <textarea placeholder="Relevant Experience or Notes" class="w-full border rounded px-4 py-2 mb-3 h-32"></textarea>
            </section>

            <section>
                <h2 class="text-2xl font-semibold mb-4">Direct Deposit (Optional)</h2>
                <input type="text" placeholder="Bank Name" class="w-full border rounded px-4 py-2 mb-3" />
                <input type="text" placeholder="Routing Number" class="w-full border rounded px-4 py-2 mb-3" />
                <input type="text" placeholder="Account Number" class="w-full border rounded px-4 py-2 mb-3" />
            </section>

            <div class="text-center">
                <button type="submit" class="bg-indigo-600 text-white px-8 py-4 rounded-lg text-lg hover:bg-indigo-700">
                    Submit Onboarding
                </button>
            </div>
        </form>
    </div>
</body>
</html>`,
};

const GRAPHQL_ACTION_MAP: Record<string, string> = {
  adminInviteUser: 'inviteUser',
  adminListGroups: 'listGroups',
  adminAddUserToGroup: 'addUserToGroup',
  adminRemoveUserFromGroup: 'removeUserFromGroup',
  adminListUsersInGroup: 'listUsersInGroup',
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
      if (!isValidInviteRole(role)) {
        throw new Error(`Invalid role. Must be one of: Admin, Manager, Facilities, Tenant`);
      }
      if (organizationId) {
        if (!isValidOrgId(organizationId)) {
          throw new Error('Invalid organizationId format');
        }
        await assertOrganizationExists(organizationId);
      }

      const tempPassword = Math.random().toString(36).slice(-10) + 'A1!';
      const groupName = roleToGroup[role];
      const templateKey = applicationType === 'Tenant' ? 'Tenant' : 'Employee';

      await cognito.send(new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        UserAttributes: [
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'given_name', Value: firstName },
          { Name: 'family_name', Value: lastName },
          ...(organizationId ? [{ Name: 'custom:organizationId', Value: organizationId }] : []),
        ],
        MessageAction: 'SUPPRESS',
      }));

      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      }));

      let html = templates[templateKey]
        .replace(/{{firstName}}/g, firstName)
        .replace(/{{email}}/g, email)
        .replace(/{{temporaryPassword}}/g, tempPassword)
        .replace(/{{role}}/g, role);

      await ses.send(new SendEmailCommand({
        Source: 'no-reply@yourdomain.com', // CHANGE TO YOUR VERIFIED SES EMAIL
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Protos – ${applicationType === 'Tenant' ? 'Rental' : 'Employee'} Application` },
          Body: { Html: { Data: html } },
        },
      }));

      return { success: true };
    }

    case 'listGroups': {
      const res = await cognito.send(new ListGroupsCommand({ UserPoolId: USER_POOL_ID }));
      return res.Groups?.map((g: any) => g.GroupName) || [];
    }

    case 'createGroup': {
      const groupName = requireGroupName(payload);
      await cognito.send(new CreateGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
      }));
      return { success: true };
    }

    case 'deleteGroup': {
      const groupName = requireGroupName(payload);
      await cognito.send(new DeleteGroupCommand({
        UserPoolId: USER_POOL_ID,
        GroupName: groupName,
      }));
      return { success: true };
    }

    case 'addUserToGroup': {
      const email = requireEmail(payload);
      const groupName = requireGroupName(payload);
      await cognito.send(new AdminAddUserToGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      }));
      return { success: true };
    }

    case 'removeUserFromGroup': {
      const email = requireEmail(payload);
      const groupName = requireGroupName(payload);
      await cognito.send(new AdminRemoveUserFromGroupCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        GroupName: groupName,
      }));
      return { success: true };
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

    default:
      throw new Error('Invalid action');
  }
};
