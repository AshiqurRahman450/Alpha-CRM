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
  if (role === 'BDM' || /balaji/i.test(name) || /balaji/i.test(email)) return false;

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

  if (role === 'BDM' || /balaji/i.test(name) || /balaji/i.test(email)) return null;

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

export function normalizeCanonicalTlName(rawTl?: string | null): string | null {
  if (!rawTl) return null;
  const trimmed = String(rawTl).trim();
  if (!trimmed || ['UNASSIGNED', 'NONE', 'NULL'].includes(trimmed.toUpperCase())) {
    return null;
  }
  if (/srinivasan|srini/i.test(trimmed)) {
    return 'Srinivasan (TL)';
  }
  if (/sundaram|sundar/i.test(trimmed)) {
    return 'Sundaram';
  }
  if (/\bbala\b/i.test(trimmed) && !/balaji/i.test(trimmed)) {
    return 'Bala';
  }
  return trimmed;
}

export function getSearchRegexForTlName(rawTl?: string | null): RegExp | null {
  const canonical = normalizeCanonicalTlName(rawTl);
  if (!canonical) return null;
  if (/srinivasan|srini/i.test(canonical)) {
    return /srinivasan|srini/i;
  }
  if (/sundaram|sundar/i.test(canonical)) {
    return /sundaram|sundar/i;
  }
  if (/\bbala\b/i.test(canonical)) {
    return /\bbala\b/i;
  }
  const escaped = canonical.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(escaped, 'i');
}

/**
 * Checks if a specific customer is accessible by the logged-in TL user
 */
export function isCustomerAccessibleByTl(customer: any, user: any): boolean {
  if (!user || !isTlUser(user)) return true;
  if (!customer) return false;
  const regex = getTlRegexForUser(user);
  if (!regex) return true;

  // If customer has an explicit assignedTl string, it is the single source of truth
  const custTl = normalizeCanonicalTlName(customer.assignedTl);
  if (custTl) {
    return regex.test(custTl);
  }

  // Next check activeProject's assignedTl if customer.assignedTl is empty
  const projTl = normalizeCanonicalTlName(customer.activeProject?.assignedTl);
  if (projTl) {
    return regex.test(projTl);
  }

  const custTlId = String(customer.assignedTlId?._id || customer.assignedTlId || '');
  if (custTlId && (custTlId === String(user._id) || custTlId === String(user.id))) return true;
  if (customer.activeProject) {
    const projTlId = String(customer.activeProject.assignedTlId?._id || customer.activeProject.assignedTlId || '');
    if (projTlId && (projTlId === String(user._id) || projTlId === String(user.id))) return true;
  }
  return false;
}

/**
 * Checks if a specific project is accessible by the logged-in TL user
 */
export function isProjectAccessibleByTl(project: any, user: any): boolean {
  if (!user || !isTlUser(user)) return true;
  if (!project) return false;
  const regex = getTlRegexForUser(user);
  if (!regex) return true;

  const cust = (project.customerId as any) || {};
  const custTl = normalizeCanonicalTlName(cust.assignedTl);
  if (custTl) {
    return regex.test(custTl);
  }

  const projTl = normalizeCanonicalTlName(project.assignedTl);
  if (projTl) {
    return regex.test(projTl);
  }

  const projTlId = String(project.assignedTlId?._id || project.assignedTlId || '');
  if (projTlId && (projTlId === String(user._id) || projTlId === String(user.id))) return true;
  const custTlId = String(cust.assignedTlId?._id || cust.assignedTlId || '');
  if (custTlId && (custTlId === String(user._id) || custTlId === String(user.id))) return true;

  return false;
}
