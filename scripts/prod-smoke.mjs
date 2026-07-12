/**
 * Production smoke test: sign in, update profile, create ticket.
 * Usage: TEST_EMAIL=nabi.poodle@gmail.com TEST_PASS='...' node scripts/prod-smoke.mjs
 */
import { Amplify } from 'aws-amplify';
import { signIn, fetchAuthSession } from 'aws-amplify/auth';
import { generateClient } from 'aws-amplify/data';
import { readFileSync } from 'fs';

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
Amplify.configure(outputs);
const client = generateClient();

const EMAIL = process.env.TEST_EMAIL ?? 'nabi.poodle@gmail.com';
const PASS = process.env.TEST_PASS ?? 'ProtosLogin2026!A';

function log(ok, label, detail) {
  const mark = ok ? '✅' : '❌';
  console.log(`${mark} ${label}: ${detail}`);
  if (!ok) process.exitCode = 1;
}

try {
  console.log(`\nPool: ${outputs.auth.user_pool_id}`);
  console.log(`Signing in as ${EMAIL}...`);
  await signIn({ username: EMAIL, password: PASS });
  const session = await fetchAuthSession({ forceRefresh: true });
  const payload = session.tokens?.idToken?.payload ?? {};
  const groups = payload['cognito:groups'] ?? [];
  const sub = payload.sub;
  const tokenOrgId = typeof payload['organizationId'] === 'string' ? payload['organizationId'] : null;

  log(groups.includes('platform_SuperAdmin') || groups.includes('user_Admin'), 'Auth', `groups=[${groups.join(', ')}] sub=${sub}`);

  let orgId = tokenOrgId;
  if (!orgId) {
    const { data: orgs, errors } = await client.models.Organization.list();
    if (errors?.length) throw errors;
    orgId = orgs?.[0]?.organizationId ?? null;
    if (!orgId && groups.includes('platform_SuperAdmin')) {
      const { data: created, errors: createErrors } = await client.models.Organization.create({
        organizationId: crypto.randomUUID(),
        name: 'Nabi Test Org',
        slug: `nabi-test-${Date.now()}`,
        plan: 'starter',
        status: 'trial',
        primaryContactEmail: EMAIL,
        createdAt: new Date().toISOString(),
        createdBy: sub ?? EMAIL,
      });
      if (createErrors?.length || !created) throw createErrors ?? new Error('Failed to create org');
      orgId = created.organizationId;
      log(true, 'Org', `created ${orgId}`);
    } else {
      log(!!orgId, 'Org', orgId ? `using existing ${orgId}` : 'no org found');
    }
  } else {
    log(true, 'Org', `from token ${orgId}`);
  }

  if (!orgId) throw new Error('No organizationId available');

  const { data: existingUsers } = await client.models.User.listUserByEmail({ email: EMAIL });
  const existing = existingUsers?.find((u) => u?.cognitoId) ?? null;

  if (!existing) {
    const { data: user, errors } = await client.models.User.create({
      cognitoId: sub,
      email: EMAIL,
      firstName: 'Nabi',
      lastName: 'Test',
      username: EMAIL.split('@')[0],
      organizationId: orgId,
      role: 'Admin',
      status: 'active',
      profileComplete: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    if (errors?.length || !user) throw errors ?? new Error('Failed to create User record');
    log(true, 'User record', `created for ${EMAIL}`);
  } else {
    const { data: updated, errors } = await client.models.User.update({
      cognitoId: existing.cognitoId,
      firstName: 'Nabi',
      lastName: 'Poodle',
      phone: '+1-555-0100',
      updatedAt: new Date().toISOString(),
    });
    if (errors?.length || !updated) throw errors ?? new Error('Failed to update profile');
    log(true, 'Profile', `updated name to Nabi Poodle, phone +1-555-0100`);
  }

  const ticketTitle = `Prod smoke ticket ${new Date().toISOString()}`;
  const { data: ticket, errors: ticketErrors } = await client.models.Ticket.create({
    title: ticketTitle,
    description: 'Created by prod-smoke.mjs after production Cognito setup.',
    estimated: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    requesterId: sub,
    status: 'open',
    labels: [],
    organizationId: orgId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  if (ticketErrors?.length || !ticket) throw ticketErrors ?? new Error('Failed to create ticket');
  log(true, 'Ticket', `created ${ticket.id} — ${ticketTitle}`);

  console.log('\n=== Production smoke test complete ===');
  console.log(`Sign in at: https://main.d11yajkly52yyj.amplifyapp.com/sign-in`);
  console.log(`Email: ${EMAIL}`);
  console.log(`Password: (value passed via TEST_PASS)`);
} catch (err) {
  console.error('\nFatal:', err);
  process.exitCode = 1;
}
