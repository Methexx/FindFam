import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /**
   * Match the pathname exactly rather than by prefix.
   *
   * Needed by any item whose href is a prefix of a sibling's: `/app` is a
   * prefix of `/app/map`, so without this the overview tab would light up on
   * every page in the section and two items would look active at once.
   */
  exact?: boolean;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
