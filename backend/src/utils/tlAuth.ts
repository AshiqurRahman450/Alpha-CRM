import { Types } from 'mongoose';

export const TL_NAMES = ['Srinivasan (TL)', 'Sundaram', 'Bala'] as const;

/**
 * Checks if the user is one of the three designated Team Leads (Srinivasan, Sundaram, Bala)
 * by role, name, or email across local and live environments
 */
export function isTlUser(user: any): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '');
  const email = String(user.email || '');

  // Never match BDMs (e.g. Balaji)
  if (role === 'BDM') return false;

  if (role === 'LOGISTICS_TL' || role === 'TL' || role === 'TEAM_LEAD' || role === 'TECHNICAL_LEAD') return true;
  if (/srinivasan|srini/i.test(role) || /srinivasan|srini/i.test(name) || /srinivasan|srini/i.test(email)) return true;
  if (/sundaram|sundar/i.test(role) || /sundaram|sundar/i.test(name) || /sundaram|sundar/i.test(email)) return true;
  if (/\bbala\b/i.test(role) || /\bbala\b/i.test(name) || /\bbala\b/i.test(email) || email.startsWith('bala@')) return true;
  return false;
}

/**
 * Gets the specific TL regex matching the user (Srinivasan, Sundaram, or Bala)
 */
export function getTlRegexForUser(user: any): RegExp | null {
  if (!user) return null;
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '');
  const email = String(user.email || '');

  if (role === 'BDM') return null;

  if (/srinivasan|srini/i.test(role) || /srinivasan|srini/i.test(name) || /srinivasan|srini/i.test(email)) {
    return /srinivasan|srini/i;
  }
  if (/sundaram|sundar/i.test(role) || /sundaram|sundar/i.test(name) || /sundaram|sundar/i.test(email)) {
    return /sundaram|sundar/i;
  }
  if (/\bbala\b/i.test(role) || /\bbala\b/i.test(name) || /\bbala\b/i.test(email) || email.startsWith('bala@')) {
    return /\bbala\b/i;
  }
  if ((role === 'LOGISTICS_TL' || role === 'TL' || role === 'TEAM_LEAD' || role === 'TECHNICAL_LEAD') && name) {
    const clean = name.replace(/[^a-zA-Z]/g, '');
    if (clean) return new RegExp(clean, 'i');
  }
  return null;
}

/**
 * Returns query condition for customers assigned to this TL (strictly assignedTl or assignedTlId)
 */
export function getCustomerTlFilter(user: any): any | null {
  if (!user || !isTlUser(user)) return null;
  const regex = getTlRegexForUser(user);
  if (!regex) return null;

  const conditions: any[] = [
    { assignedTl: regex },
  ];
  if (user._id) {
    conditions.push({ assignedTlId: user._id });
    if (Types.ObjectId.isValid(user._id)) {
      conditions.push({ assignedTlId: new Types.ObjectId(user._id) });
    }
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
  if (customer.assignedTlId && (String(customer.assignedTlId) === String(user._id) || String(customer.assignedTlId) === String(user.id))) return true;
  if (customer.activeProject) {
    if (customer.activeProject.assignedTl && regex.test(customer.activeProject.assignedTl)) return true;
    if (customer.activeProject.assignedTlId && (String(customer.activeProject.assignedTlId) === String(user._id) || String(customer.activeProject.assignedTlId) === String(user.id))) return true;
  }
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
  if (project.assignedTlId && (String(project.assignedTlId) === String(user._id) || String(project.assignedTlId) === String(user.id))) return true;

  const cust = (project.customerId as any) || {};
  if (cust.assignedTl && regex.test(cust.assignedTl)) return true;
  if (cust.assignedTlId && (String(cust.assignedTlId) === String(user._id) || String(cust.assignedTlId) === String(user.id))) return true;

  return false;
}
