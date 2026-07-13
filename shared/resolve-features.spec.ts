import { FEATURES, ALL_FEATURES } from './features';
import { resolveFeatures } from './resolve-features';

describe('resolveFeatures', () => {
  it('grants all features for vertical full', () => {
    const features = resolveFeatures({ vertical: 'full', plan: 'enterprise' });
    expect(features.size).toBe(ALL_FEATURES.length);
    expect(features.has(FEATURES.EMPLOYEES)).toBe(true);
  });

  it('defaults to full when vertical is missing', () => {
    const features = resolveFeatures({});
    expect(features.size).toBe(ALL_FEATURES.length);
  });

  it('applies feature overrides', () => {
    const features = resolveFeatures({
      vertical: 'hoa',
      featureOverrides: [`+${FEATURES.TIMESHEETS}`, `-${FEATURES.TENANTS}`],
    });
    expect(features.has(FEATURES.TIMESHEETS)).toBe(true);
    expect(features.has(FEATURES.TENANTS)).toBe(false);
  });
});
