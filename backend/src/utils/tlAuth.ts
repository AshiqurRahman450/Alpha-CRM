import { Types } from 'mongoose';

export const TL_NAMES = ['Srinivasan (TL)', 'Sundaram', 'Bala'] as const;

/**
 * Checks if the user is one of the three designated Team Leads (Srinivasan, Sundaram, Bala)
 * by role, name, or email across local and live environments
 */
export function isTlUser(user: any): boolean {
  if (!user) return false;
  if (user.role === 'LOGISTICS_TL') return true;
  const name = user.name || '';
  const email = user.email || '';
  if (/srinivasan/i.test(name) || /srinivasan/i.test(email)) return true;
  if (/sundaram/i.test(name) || /sundaram/i.test(email)) return true;
  if (/bala/i.test(name) || /bala/i.test(email)) return true;
  return false;
}

/**
 * Gets the specific TL regex matching the user (Srinivasan, Sundaram, or Bala)
 */
export function getTlRegexForUser(user: any): RegExp | null {
  if (!user) return null;
  const name = user.name || '';
  const email = user.email || '';

  if (/srinivasan/i.test(name) || /srinivasan/i.test(email)) {
    return /srinivasan/i;
  }
  if (/sundaram/i.test(name) || /sundaram/i.test(email)) {
    return /sundaram/i;
  }
  if (/bala/i.test(name) || /bala/i.test(email)) {
    return /bala/i;
  }
  if (user.role === 'LOGISTICS_TL' && name) {
    return new RegExp(`^${name.trim()}$`, 'i');
  }
  return null;
}

/**
 * Returns query condition for customers assigned to this TL
 */
export function getCustomerTlFilter(user: any): any | null {
  if (!user || !isTlUser(user)) return null;
  const regex = getTlRegexForUser(user);
  if (!regex) return null;

  const conditions: any[] = [
    { assignedTl: regex },
    { assignedEmployee: regex },
  ];
  if (user._id) {
    conditions.push({ assignedTlId: user._id });
  }
  return { $or: conditions };
}

/**
 * Checks if a specific customer is accessible by the logged-in TL user
 */
export function isCustomerAccessibleByTl(customer: any, user: any): boolean {
  if (!user || !isTlUser(user)) return true;
  const regex = getTlRegexForUser(user);
  if (!regex) return true;

  if (customer.assignedTl && regex.test(customer.assignedTl)) return true;
  if (customer.assignedEmployee && regex.test(customer.assignedEmployee)) return true;
  if (customer.assignedTlId && String(customer.assignedTlId) === String(user._id)) return true;
  return false;
}

/**
 * Checks if a specific project is accessible by the logged-in TL user
 */
export function isProjectAccessibleByTl(project: any, user: any): boolean {
  if (!user || !isTlUser(user)) return true;
  const regex = getTlRegexForUser(user);
  if (!regex) return true;

  if (project.assignedTl && regex.test(project.assignedTl)) return true;
  if (project.assignedEmployee && regex.test(project.assignedEmployee)) return true;
  if (project.assignedTlId && String(project.assignedTlId) === String(user._id)) return true;

  const cust = (project.customerId as any) || {};
  if (cust.assignedTl && regex.test(cust.assignedTl)) return true;
  if (cust.assignedEmployee && regex.test(cust.assignedEmployee)) return true;
  if (cust.assignedTlId && String(cust.assignedTlId) === String(user._id)) return true;

  return false;
}
