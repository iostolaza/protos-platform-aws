import type { PreTokenGenerationV2TriggerHandler } from 'aws-lambda';

const GROUP_TO_ROLE: Record<string, string> = {
  platform_SuperAdmin: 'SuperAdmin',
  user_Admin: 'Admin',
  user_Manager: 'Manager',
  user_Facilities: 'Facilities',
  user_Tenant: 'Tenant',
  user_Employee: 'Employee',
  team_lead: 'TeamLead',
  member: 'Member',
};

function resolveRole(groups: string[]): string | undefined {
  for (const group of groups) {
    const role = GROUP_TO_ROLE[group];
    if (role) return role;
  }
  return undefined;
}

// V2_0 handler: injects claims into both ID and access tokens.
// Requires LambdaVersion V2_0 CDK override in amplify/backend.ts.
export const handler: PreTokenGenerationV2TriggerHandler = async (event) => {
  const organizationId = event.request.userAttributes['custom:organizationId'] ?? '';
  const groups = event.request.groupConfiguration.groupsToOverride ?? [];

  const claimsToAdd: Record<string, string> = {};
  if (organizationId) {
    claimsToAdd.organizationId = organizationId;
  }

  const role = resolveRole(groups);
  if (role) {
    claimsToAdd.role = role;
  }

  if (groups.length > 0) {
    claimsToAdd.groups = groups.join(',');
  }

  event.response = {
    claimsAndScopeOverrideDetails: {
      idTokenGeneration: {
        claimsToAddOrOverride: claimsToAdd,
      },
      accessTokenGeneration: {
        claimsToAddOrOverride: claimsToAdd,
      },
    },
  };

  return event;
};
