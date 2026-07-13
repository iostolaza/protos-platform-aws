import { FEATURES } from './features';
import { resolveFeatures } from './resolve-features';

describe('resolveFeatures', () => {
  it('clamps full vertical to free plan features', () => {
    const features = resolveFeatures({ vertical: 'full', plan: 'free' });
    expect(features.has(FEATURES.MESSAGING)).toBe(true);
    expect(features.has(FEATURES.DOCUMENTS)).toBe(true);
    expect(features.has(FEATURES.BILLING_VIEW)).toBe(true);
    expect(features.has(FEATURES.TICKETS)).toBe(false);
    expect(features.has(FEATURES.EMPLOYEES)).toBe(false);
  });

  it('grants all vertical features for enterprise plan', () => {
    const features = resolveFeatures({ vertical: 'full', plan: 'enterprise' });
    expect(features.has(FEATURES.EMPLOYEES)).toBe(true);
    expect(features.has(FEATURES.TICKETS)).toBe(true);
    expect(features.has(FEATURES.BILLING_VIEW)).toBe(true);
  });

  it('intersects hoa vertical with free plan', () => {
    const features = resolveFeatures({ vertical: 'hoa', plan: 'free' });
    expect(features.has(FEATURES.MESSAGING)).toBe(true);
    expect(features.has(FEATURES.DOCUMENTS)).toBe(true);
    expect(features.has(FEATURES.TICKETS)).toBe(false);
    expect(features.has(FEATURES.TENANTS)).toBe(false);
  });

  it('returns empty set for unknown plan', () => {
    const features = resolveFeatures({ vertical: 'full', plan: 'bogus' });
    expect(features.size).toBe(0);
  });

  it('applies overrides then clamps by plan', () => {
    const features = resolveFeatures({
      vertical: 'full',
      plan: 'free',
      featureOverrides: [`+${FEATURES.TICKETS}`, `-${FEATURES.MESSAGING}`],
    });
    expect(features.has(FEATURES.MESSAGING)).toBe(false);
    expect(features.has(FEATURES.TICKETS)).toBe(false);
    expect(features.has(FEATURES.DOCUMENTS)).toBe(true);
    expect(features.has(FEATURES.BILLING_VIEW)).toBe(true);
  });
});
