/**
 * Read-only audit: count rows with null/missing organizationId per tenant-scoped model.
 *
 * Usage:
 *   node scripts/audit-null-org.mjs
 *   TABLE_SUFFIX=uu3mtdqqnjd6xnew25map3tzpu node scripts/audit-null-org.mjs
 *   node scripts/audit-null-org.mjs --samples   # include up to 5 sample PKs per model
 *
 * Requires: amplify_outputs.json, AWS CLI profile (default: amplify-admin)
 */
import { readFileSync } from 'fs';
import { execSync } from 'child_process';

const MODELS = [
  'User',
  'Team',
  'TeamMember',
  'Ticket',
  'Comment',
  'Notification',
  'Channel',
  'UserChannel',
  'Message',
  'Friend',
  'Account',
  'Transaction',
  'Invoice',
  'InvoiceItem',
  'PaymentMethod',
  'Timesheet',
  'TimesheetEntry',
  'Document',
];

const PROFILE = process.env.AWS_PROFILE ?? 'amplify-admin';
const SHOW_SAMPLES = process.argv.includes('--samples');
const MAX_SAMPLES = 5;

const outputs = JSON.parse(readFileSync('amplify_outputs.json', 'utf8'));
const REGION = outputs.data?.aws_region ?? outputs.auth?.aws_region ?? 'us-west-1';

function resolveTableSuffix() {
  if (process.env.TABLE_SUFFIX) {
    return process.env.TABLE_SUFFIX;
  }

  const url = outputs.data?.url;
  if (!url) {
    throw new Error('amplify_outputs.data.url is missing');
  }

  const apis = JSON.parse(
    execSync(
      `aws appsync list-graphql-apis --region ${REGION} --profile ${PROFILE} --output json`,
      { encoding: 'utf8' }
    )
  );

  const api = (apis.graphqlApis ?? []).find((entry) => entry.uris?.GRAPHQL === url);
  if (api?.apiId) {
    return api.apiId;
  }

  throw new Error(`No AppSync API found for ${url}. Set TABLE_SUFFIX explicitly.`);
}

function tableName(model, suffix) {
  return `${model}-${suffix}-NONE`;
}

function parseOrgId(item) {
  const attr = item?.organizationId;
  if (!attr) return null;
  if (typeof attr.S === 'string') return attr.S;
  if (attr.NULL === true) return null;
  return null;
}

function primaryKeyFields(model) {
  switch (model) {
    case 'User':
      return ['cognitoId'];
    case 'Friend':
      return ['ownerCognitoId', 'friendCognitoId'];
    case 'UserChannel':
      return ['userCognitoId', 'channelId'];
    case 'Transaction':
      return ['transactionId'];
    case 'Invoice':
      return ['invoiceId'];
    case 'InvoiceItem':
      return ['invoiceItemId'];
    case 'Document':
      return ['docId'];
    case 'Ticket':
      return ['id'];
    case 'Timesheet':
    case 'TimesheetEntry':
      return ['id'];
    case 'Account':
      return ['id'];
    default:
      return ['id'];
  }
}

function formatKey(item, keyFields) {
  const parts = keyFields.map((field) => {
    const value = item[field]?.S ?? item[field]?.N ?? item[field]?.BOOL ?? '?';
    return `${field}=${value}`;
  });
  return parts.join(', ');
}

function scanTable(model, table) {
  let total = 0;
  let nullOrg = 0;
  let hasOrg = 0;
  const samples = [];
  let exclusiveStartKey = null;
  const keyFields = primaryKeyFields(model);
  const projectionFields = [...new Set(['organizationId', ...keyFields])];
  const projectionExpression = projectionFields.join(', ');

  do {
    const out = JSON.parse(
      execSync(
        [
          'aws',
          'dynamodb',
          'scan',
          '--table-name',
          table,
          '--projection-expression',
          JSON.stringify(projectionExpression),
          '--region',
          REGION,
          '--profile',
          PROFILE,
          '--output',
          'json',
          ...(exclusiveStartKey
            ? ['--exclusive-start-key', JSON.stringify(exclusiveStartKey)]
            : []),
        ].join(' '),
        {
          encoding: 'utf8',
          maxBuffer: 64 * 1024 * 1024,
        }
      )
    );

    for (const item of out.Items ?? []) {
      total += 1;
      const orgId = parseOrgId(item);
      if (!orgId || orgId.trim() === '') {
        nullOrg += 1;
        if (SHOW_SAMPLES && samples.length < MAX_SAMPLES) {
          samples.push(formatKey(item, keyFields));
        }
      } else {
        hasOrg += 1;
      }
    }

    exclusiveStartKey = out.LastEvaluatedKey ?? null;
  } while (exclusiveStartKey);

  return { total, nullOrg, hasOrg, samples };
}

function tableExists(table) {
  try {
    execSync(
      `aws dynamodb describe-table --table-name ${table} --region ${REGION} --profile ${PROFILE} --output json`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }
    );
    return true;
  } catch {
    return false;
  }
}

const suffix = resolveTableSuffix();
console.log(`\nAudit: null organizationId (read-only)`);
console.log(`Region: ${REGION}`);
console.log(`Profile: ${PROFILE}`);
console.log(`Table suffix: ${suffix}`);
console.log(`AppSync: ${outputs.data?.url ?? 'n/a'}\n`);

const results = [];
let grandTotal = 0;
let grandNull = 0;

for (const model of MODELS) {
  const table = tableName(model, suffix);
  if (!tableExists(table)) {
    results.push({ model, table, total: 0, nullOrg: 0, hasOrg: 0, missingTable: true, samples: [] });
    continue;
  }

  const counts = scanTable(model, table);
  results.push({ model, table, ...counts, missingTable: false });
  grandTotal += counts.total;
  grandNull += counts.nullOrg;
}

console.log('Model                  | Total | Null Org | Has Org | Table');
console.log('-----------------------|-------|----------|---------|------');

for (const row of results) {
  if (row.missingTable) {
    console.log(`${row.model.padEnd(22)} |     - |        - |       - | (table not found)`);
    continue;
  }
  console.log(
    `${row.model.padEnd(22)} | ${String(row.total).padStart(5)} | ${String(row.nullOrg).padStart(8)} | ${String(row.hasOrg).padStart(7)} | ${row.table}`
  );
}

console.log('-----------------------|-------|----------|---------|------');
console.log(
  `${'TOTAL'.padEnd(22)} | ${String(grandTotal).padStart(5)} | ${String(grandNull).padStart(8)} | ${String(grandTotal - grandNull).padStart(7)} |`
);

const modelsWithNulls = results.filter((r) => !r.missingTable && r.nullOrg > 0);
if (modelsWithNulls.length === 0) {
  console.log('\n✅ No null organizationId rows found in any model.');
} else {
  console.log(`\n⚠️  ${modelsWithNulls.length} model(s) have null organizationId rows.`);
}

if (SHOW_SAMPLES && modelsWithNulls.length > 0) {
  console.log('\nSample primary keys (null organizationId):');
  for (const row of modelsWithNulls) {
    if (!row.samples.length) continue;
    console.log(`  ${row.model}:`);
    for (const sample of row.samples) {
      console.log(`    - ${sample}`);
    }
  }
}

console.log('\nNo data was modified.\n');
