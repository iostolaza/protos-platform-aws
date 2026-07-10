/**
 * E2E multi-tenant isolation test — mirrors Super Admin UI flow via Amplify APIs.
 * Usage: TEST_EMAIL=... TEST_PASS=... node scripts/org-isolation-e2e.mjs
 */
import { Amplify } from 'aws-amplify';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
Amplify.configure(outputs);
const client = generateClient();

const POOL = outputs.auth.user_pool_id;
const REGION = outputs.auth.aws_region;
const PROFILE = 'amplify-admin';

const SUPER_EMAIL = process.env.TEST_EMAIL ?? 'superadmin@protos-test.local';
const SUPER_PASS = process.env.TEST_PASS ?? 'SuperAdmin123!A';

let actingOrgId = null;
const results = [];

function pass(step, detail) {
  results.push({ step, ok: true, detail });
  console.log(`✅ Step ${step}: ${detail}`);
}

function fail(step, detail) {
  results.push({ step, ok: false, detail });
  console.error(`❌ Step ${step}: ${detail}`);
}

function getOrgFilterClause(isSuperAdmin, actingOrg, tokenOrgId) {
  if (isSuperAdmin && !actingOrg) return null;
  const orgId = actingOrg ?? tokenOrgId;
  if (orgId) return { organizationId: { eq: orgId } };
  return { organizationId: { eq: '__NO_ORG__' } };
}

async function listUsersFiltered() {
  const session = await fetchAuthSession();
  const payload = session.tokens?.idToken?.payload ?? {};
  const isSuperAdmin = (payload['cognito:groups'] ?? []).includes('platform_SuperAdmin');
  const tokenOrgId = typeof payload['organizationId'] === 'string' ? payload['organizationId'] : null;
  const filter = getOrgFilterClause(isSuperAdmin, actingOrgId, tokenOrgId);
  const { data, errors } = await client.models.User.list(filter ? { filter } : {});
  if (errors?.length) throw errors;
  return data ?? [];
}

async function ensureOrgBySlug({ name, slug, plan, email }) {
  const { data: existing } = await client.models.Organization.listOrganizationBySlug({ slug });
  if (existing?.length) {
    return existing[0];
  }
  const session = await fetchAuthSession();
  const createdBy = session.tokens?.idToken?.payload?.sub ?? 'e2e-script';
  const { data, errors } = await client.models.Organization.create({
    organizationId: crypto.randomUUID(),
    name,
    slug,
    plan,
    status: 'trial',
    primaryContactEmail: email,
    createdAt: new Date().toISOString(),
    createdBy,
  });
  if (errors?.length || !data) throw errors ?? new Error(`Failed to create org ${name}`);
  return data;
}

async function inviteEmployee({ email, firstName, lastName, organizationId }) {
  try {
    const { errors } = await client.mutations.adminInviteUser({
      email,
      firstName,
      lastName,
      role: 'Manager',
      applicationType: 'Employee',
      organizationId,
    });
    if (errors?.length) {
      const message = errors.map((e) => e.message ?? String(e)).join('; ');
      if (!message.toLowerCase().includes('already exists')) {
        throw errors;
      }
      console.log(`  (invite skipped — ${email} already exists in Cognito)`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (!message.toLowerCase().includes('already exists')) {
      throw err;
    }
    console.log(`  (invite skipped — ${email} already exists in Cognito)`);
  }
}

function cognitoSubForEmail(email) {
  const out = execSync(
    `aws cognito-idp list-users --user-pool-id ${POOL} --filter "email = \\"${email}\\"" --region ${REGION} --profile ${PROFILE} --output json`,
    { encoding: 'utf8' }
  );
  const users = JSON.parse(out).Users ?? [];
  const user = users.find((u) =>
    u.Attributes?.some((a) => a.Name === 'email' && a.Value === email)
  );
  if (!user) throw new Error(`Cognito user not found for ${email}`);
  const sub =
    user.Attributes?.find((a) => a.Name === 'sub')?.Value ?? user.Username;
  return sub;
}

/** Invited users appear in employee list only after User record exists (post-confirmation). */
async function ensureUserRecord({ email, firstName, lastName, organizationId }) {
  const { data: byEmail } = await client.models.User.listUserByEmail({ email });
  if (byEmail?.length) {
    return byEmail[0];
  }
  const cognitoId = cognitoSubForEmail(email);
  const { data, errors } = await client.models.User.create({
    cognitoId,
    email,
    firstName,
    lastName,
    username: email.split('@')[0],
    organizationId,
    role: 'Manager',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (errors?.length || !data) throw errors ?? new Error(`Failed to create User for ${email}`);
  return data;
}

function emails(users) {
  return users.map((u) => u.email).sort();
}

function assertEmails(step, users, expected, label) {
  const got = emails(users);
  const want = [...expected].sort();
  if (got.length === want.length && got.every((e, i) => e === want[i])) {
    pass(step, `${label}: [${got.join(', ')}]`);
    return true;
  }
  fail(step, `${label}: expected [${want.join(', ')}], got [${got.join(', ')}]`);
  return false;
}

try {
  console.log(`\nSigning in as ${SUPER_EMAIL}...`);
  await signIn({ username: SUPER_EMAIL, password: SUPER_PASS });
  const session = await fetchAuthSession();
  const groups = session.tokens?.idToken?.payload['cognito:groups'] ?? [];
  if (!groups.includes('platform_SuperAdmin')) {
    throw new Error(`Not in platform_SuperAdmin group. Groups: ${groups.join(', ')}`);
  }
  console.log('Signed in as Super Admin.\n');

  // Steps 1-2: Create organizations
  const companyA = await ensureOrgBySlug({
    name: 'Company A',
    slug: 'companya',
    plan: 'starter',
    email: 'contact-a@protos-test.local',
  });
  pass('1', `Company A ready (${companyA.organizationId}, slug: companya)`);

  const companyB = await ensureOrgBySlug({
    name: 'Company B',
    slug: 'companyb',
    plan: 'starter',
    email: 'contact-b@protos-test.local',
  });
  pass('2', `Company B ready (${companyB.organizationId}, slug: companyb)`);

  // Steps 3-4: Invite per acting org
  actingOrgId = companyA.organizationId;
  await inviteEmployee({
    email: 'alice@test.com',
    firstName: 'Alice',
    lastName: 'Anderson',
    organizationId: companyA.organizationId,
  });
  await ensureUserRecord({
    email: 'alice@test.com',
    firstName: 'Alice',
    lastName: 'Anderson',
    organizationId: companyA.organizationId,
  });
  pass('3', `Invited alice@test.com under Company A (acting org: ${actingOrgId})`);

  actingOrgId = companyB.organizationId;
  await inviteEmployee({
    email: 'bob@test.com',
    firstName: 'Bob',
    lastName: 'Baker',
    organizationId: companyB.organizationId,
  });
  await ensureUserRecord({
    email: 'bob@test.com',
    firstName: 'Bob',
    lastName: 'Baker',
    organizationId: companyB.organizationId,
  });
  pass('4', `Invited bob@test.com under Company B (acting org: ${actingOrgId})`);

  // Step 5: Acting as Company A — only Alice
  actingOrgId = companyA.organizationId;
  const listA = await listUsersFiltered();
  assertEmails('5', listA, ['alice@test.com'], 'Acting as Company A');

  // Step 6: Acting as Company B — only Bob
  actingOrgId = companyB.organizationId;
  const listB = await listUsersFiltered();
  assertEmails('6', listB, ['bob@test.com'], 'Acting as Company B');

  // Step 7: Clear acting org — both visible
  actingOrgId = null;
  const listAll = await listUsersFiltered();
  const tenantEmails = listAll
    .map((u) => u.email)
    .filter((e) => e === 'alice@test.com' || e === 'bob@test.com');
  if (tenantEmails.includes('alice@test.com') && tenantEmails.includes('bob@test.com')) {
    pass('7', `Cleared acting org — sees both: [${tenantEmails.sort().join(', ')}]`);
  } else {
    fail('7', `Expected alice + bob, got [${tenantEmails.join(', ')}]`);
  }

  // Step 8: Disable/enable Alice
  actingOrgId = companyA.organizationId;
  const { errors: disableErrors } = await client.mutations.adminDisableUser({
    email: 'alice@test.com',
  });
  if (disableErrors?.length) throw disableErrors;

  const { data: disabledUser } = await client.models.User.listUserByEmail({
    email: 'alice@test.com',
  });
  if (disabledUser?.[0]?.status === 'disabled') {
    pass('8a', 'adminDisableUser Lambda worked — User status is disabled');
  } else {
    fail('8a', `Expected status disabled, got ${disabledUser?.[0]?.status}`);
  }

  const { errors: enableErrors } = await client.mutations.adminEnableUser({
    email: 'alice@test.com',
  });
  if (enableErrors?.length) throw enableErrors;

  const { data: enabledUser } = await client.models.User.listUserByEmail({
    email: 'alice@test.com',
  });
  if (enabledUser?.[0]?.status === 'active') {
    pass('8b', 'adminEnableUser Lambda worked — User status is active');
  } else {
    fail('8b', `Expected status active, got ${enabledUser?.[0]?.status}`);
  }
} catch (err) {
  console.error('\nFatal error:', err);
  process.exitCode = 1;
}

const failed = results.filter((r) => !r.ok);
console.log(`\n=== Summary: ${results.length - failed.length}/${results.length} passed ===`);
if (failed.length) {
  process.exitCode = 1;
}
