// amplify/backend.ts
import { defineBackend } from '@aws-amplify/backend';
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
