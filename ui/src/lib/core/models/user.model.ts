// src/app/core/models/user.model.ts
//
// The canonical, unified user profile type lives in user.service.ts where it is
// derived from the Amplify schema (`Schema['User']['type'] & { profileImageUrl }`).
// It already includes the merged payroll fields (rate, otMultiplier, taxRate, role).
// Re-exported here so consumers can import it from either the model or the service.
export type { UserProfile } from '../services/user.service';
