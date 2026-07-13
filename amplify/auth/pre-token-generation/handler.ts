import type { PreTokenGenerationV2TriggerHandler } from 'aws-lambda';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import {
  resolveFeatures,
  serializeFeaturesClaim,
  FEATURES_CLAIM,
  VERTICAL_CLAIM,
  PLAN_CLAIM,
} from '@shared';

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const ORG_TABLE = process.env.ORGANIZATION_TABLE_NAME ?? '';

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

async function getOrganization(organizationId: string) {
  if (!ORG_TABLE) return null;
  try {
    const { Item } = await ddb.send(
      new GetCommand({
        TableName: ORG_TABLE,
        Key: { organizationId },
      })
    );
    return Item ?? null;
  } catch (err) {
    console.error('[pre-token-gen] Organization lookup failed:', err);
    return null;
  }
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

  if (organizationId) {
    const org = await getOrganization(organizationId);
    if (org) {
      const vertical = (org['vertical'] as string | null) ?? 'full';
      const features = resolveFeatures({
        vertical,
        plan: (org['plan'] as string | null) ?? null,
        featureOverrides: (org['featureOverrides'] as string[] | null) ?? null,
      });
      claimsToAdd[FEATURES_CLAIM] = serializeFeaturesClaim(features);
      claimsToAdd[VERTICAL_CLAIM] = vertical;
      if (org['plan']) {
        claimsToAdd[PLAN_CLAIM] = String(org['plan']);
      }
    }
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
