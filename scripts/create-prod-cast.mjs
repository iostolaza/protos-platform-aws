/**
 * Create themed production users via adminInviteUser + Cognito group/password fixes.
 * Usage: node scripts/create-prod-cast.mjs
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
const ADMIN_EMAIL = process.env.ADMIN_EMAIL ?? 'i.ostolaza87@gmail.com';
const ADMIN_PASS = process.env.ADMIN_PASS ?? 'ProtosLogin2026!A';
const USER_PASS = process.env.USER_PASS ?? 'ProtosCast2026!A';
const ORG_ID = process.env.ORG_ID ?? 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';

/** @type {Array<{email:string,firstName:string,lastName:string,role:'Admin'|'Manager'|'Facilities'|'Tenant',superAdmin?:boolean,app:'admin'|'portal'}>} */
const CAST = [
  { email: 'jaypritchett.owner@closetsclosets.com', firstName: 'Jay', lastName: 'Pritchett', role: 'Admin', superAdmin: true, app: 'admin' },
  { email: 'michaelscott.boss@dundermifflin.com', firstName: 'Michael', lastName: 'Scott', role: 'Admin', app: 'admin' },
  { email: 'clairedunphy.mom@icloud.com', firstName: 'Claire', lastName: 'Dunphy', role: 'Admin', app: 'admin' },
  { email: 'pambeesly.art@outlook.com', firstName: 'Pam', lastName: 'Beesly', role: 'Admin', app: 'admin' },
  { email: 'tobyflenderson.hr@outlook.com', firstName: 'Toby', lastName: 'Flenderson', role: 'Admin', app: 'admin' },
  { email: 'neo.carbon@gmail.com', firstName: 'Neo', lastName: 'Carbon', role: 'Admin', app: 'admin' },
  { email: 'dwightschrute.farm@gmail.com', firstName: 'Dwight', lastName: 'Schrute', role: 'Manager', app: 'admin' },
  { email: 'jimhalpert.pranks@yahoo.com', firstName: 'Jim', lastName: 'Halpert', role: 'Manager', app: 'admin' },
  { email: 'oscarmartinez.account@yahoo.com', firstName: 'Oscar', lastName: 'Martinez', role: 'Manager', app: 'admin' },
  { email: 'mitchellpritchett.law@outlook.com', firstName: 'Mitchell', lastName: 'Pritchett', role: 'Manager', app: 'admin' },
  { email: 'angelamartin.cats@hotmail.com', firstName: 'Angela', lastName: 'Martin', role: 'Manager', app: 'admin' },
  { email: 'kevinmalone.chili@gmail.com', firstName: 'Kevin', lastName: 'Malone', role: 'Facilities', app: 'admin' },
  { email: 'creedbratton.mystery@gmail.com', firstName: 'Creed', lastName: 'Bratton', role: 'Facilities', app: 'admin' },
  { email: 'stanleyhudson.crossword@hotmail.com', firstName: 'Stanley', lastName: 'Hudson', role: 'Facilities', app: 'admin' },
  { email: 'phildunphy.realtor@gmail.com', firstName: 'Phil', lastName: 'Dunphy', role: 'Tenant', app: 'portal' },
  { email: 'gloriapritchett.family@gmail.com', firstName: 'Gloria', lastName: 'Pritchett', role: 'Tenant', app: 'portal' },
  { email: 'haleydunphy.influencer@yahoo.com', firstName: 'Haley', lastName: 'Dunphy', role: 'Tenant', app: 'portal' },
  { email: 'lukedunphy.tricks@gmail.com', firstName: 'Luke', lastName: 'Dunphy', role: 'Tenant', app: 'portal' },
  { email: 'lilypritchett.kid@gmail.com', firstName: 'Lily', lastName: 'Pritchett', role: 'Tenant', app: 'portal' },
  { email: 'alexdunphy.science@gmail.com', firstName: 'Alex', lastName: 'Dunphy', role: 'Tenant', app: 'portal' },
  { email: 'camerontucker.clown@gmail.com', firstName: 'Cameron', lastName: 'Tucker', role: 'Tenant', app: 'portal' },
];

function shell(cmd) {
  execSync(cmd, { stdio: 'pipe', encoding: 'utf8' });
}

function cognitoUserExists(email) {
  try {
    const out = execSync(
      `aws cognito-idp admin-get-user --user-pool-id ${POOL} --username "${email}" --profile ${PROFILE} --region ${REGION}`,
      { encoding: 'utf8' }
    );
    return !!out;
  } catch {
    return false;
  }
}

function setPermanentPassword(email) {
  shell(
    `aws cognito-idp admin-set-user-password --user-pool-id ${POOL} --username "${email}" --password '${USER_PASS}' --permanent --profile ${PROFILE} --region ${REGION}`
  );
}

function addSuperAdmin(email) {
  shell(
    `aws cognito-idp admin-add-user-to-group --user-pool-id ${POOL} --username "${email}" --group-name platform_SuperAdmin --profile ${PROFILE} --region ${REGION}`
  );
}

console.log(`Pool: ${POOL}`);
console.log(`Signing in as ${ADMIN_EMAIL}...`);
await signIn({ username: ADMIN_EMAIL, password: ADMIN_PASS });
await fetchAuthSession({ forceRefresh: true });

const results = [];

for (const person of CAST) {
  const row = { ...person, status: 'ok', note: '' };
  try {
    if (cognitoUserExists(person.email)) {
      row.note = 'already existed — password reset';
    } else {
      const { data, errors } = await client.mutations.adminInviteUser({
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        role: person.role,
        applicationType: person.role === 'Tenant' ? 'Tenant' : 'Employee',
        organizationId: ORG_ID,
      });
      if (errors?.length) {
        throw new Error(errors.map((e) => e.message ?? String(e)).join('; '));
      }
      row.note = data?.emailSent ? 'invited + email sent' : `invited (${data?.warning ?? 'no email'})`;
    }
    setPermanentPassword(person.email);
    if (person.superAdmin) {
      try {
        addSuperAdmin(person.email);
        row.note += ' + SuperAdmin';
      } catch {
        row.note += ' + SuperAdmin (group may already exist)';
      }
    }
  } catch (err) {
    row.status = 'fail';
    row.note = err instanceof Error ? err.message : String(err);
  }
  results.push(row);
  console.log(`${row.status === 'ok' ? '✅' : '❌'} ${person.email} — ${row.note}`);
}

// Ensure existing accounts have the cast password too
for (const email of ['i.ostolaza87@gmail.com', 'nabi.apricot@gmail.com']) {
  if (cognitoUserExists(email)) {
    setPermanentPassword(email);
    console.log(`✅ ${email} — password synced to ${USER_PASS}`);
  }
}

console.log('\n=== Production cast password (all users) ===');
console.log(USER_PASS);
console.log('\nAdmin: https://main.d11yajkly52yyj.amplifyapp.com/sign-in');
console.log('Portal: https://main.daog7do89x2bd.amplifyapp.com/sign-in');

const failed = results.filter((r) => r.status === 'fail');
if (failed.length) process.exitCode = 1;
