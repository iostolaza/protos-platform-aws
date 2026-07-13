import type { IconName } from '../services/icon-preloader.service';
import type { FeatureKey } from '@shared';

export interface SubMenuItem {
  label: string;
  route: string | null;
  icon?: IconName;
  children?: SubMenuItem[];
  active?: boolean;
  adminOnly?: boolean;
  expanded?: boolean;
  feature?: FeatureKey;
  groups?: string[];
}

export interface MenuItem {
  group: string;
  separator?: boolean;
  items: SubMenuItem[];
  active?: boolean;
  adminOnly?: boolean;
  feature?: FeatureKey;
  groups?: string[];
}
