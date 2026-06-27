import type { IconName } from '../services/icon-preloader.service';

export interface SubMenuItem {
  label: string;
  route: string | null;
  icon?: IconName;
  children?: SubMenuItem[];
  active?: boolean;
  adminOnly?: boolean;
  expanded?: boolean;
}

export interface MenuItem {
  group: string;
  separator?: boolean;
  items: SubMenuItem[];
  active?: boolean;
  adminOnly?: boolean;
}
