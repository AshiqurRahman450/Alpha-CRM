export interface BDMUser {
  _id?: string;
  id?: string;
  name: string;
  email: string;
  role: string;
  phone: string;
}

export const DEFAULT_BDMS: BDMUser[] = [
  { name: 'Thirunavukarasu', email: 'thirunavukarasu@alpha.com', role: 'BDM', phone: '+91 98401 10001' },
  { name: 'Gopinath', email: 'gopinath@alpha.com', role: 'BDM', phone: '+91 98401 10002' },
  { name: 'Javith', email: 'javith@alpha.com', role: 'BDM', phone: '+91 98401 10003' },
  { name: 'Mohamed Ashik', email: 'mohamedashik@alpha.com', role: 'BDM', phone: '+91 98401 10004' },
  { name: 'Dhananjay', email: 'dhananjay@alpha.com', role: 'BDM', phone: '+91 98401 10005' },
  { name: 'Balaji', email: 'balaji@alpha.com', role: 'BDM', phone: '+91 98401 10006' },
  { name: 'Aravind', email: 'aravind@alpha.com', role: 'BDM', phone: '+91 98401 10007' },
  { name: 'Naveen', email: 'naveen@alpha.com', role: 'BDM', phone: '+91 98401 10008' },
  { name: 'Eswar', email: 'eswar@alpha.com', role: 'BDM', phone: '+91 98401 10009' },
  { name: 'Karthik', email: 'karthik@alpha.com', role: 'BDM', phone: '+91 98401 10010' },
];

export function getTlNameForUser(user: any): string | null {
  if (!user) return null;
  const role = String(user.role || '').toUpperCase();
  const name = String(user.name || '');
  const email = String(user.email || '');

  // Never match BDMs (e.g. Balaji) or SITE_INSPECTOR
  if (role === 'BDM' || role === 'SITE_INSPECTOR' || /balaji/i.test(name) || /balaji/i.test(email)) return null;

  if (/srinivasan|srini/i.test(role) || /srinivasan|srini/i.test(name) || /srinivasan|srini/i.test(email)) {
    return 'Srinivasan (TL)';
  }
  if (/sundaram|sundar/i.test(role) || /sundaram|sundar/i.test(name) || /sundaram|sundar/i.test(email)) {
    return 'Sundaram';
  }
  if (/\bbala\b/i.test(role) || /\bbala\b/i.test(name) || /\bbala\b/i.test(email) || email.startsWith('bala@')) {
    return 'Bala';
  }
  if ((role === 'LOGISTICS_TL' || role === 'TL' || role === 'TEAM_LEAD' || role === 'TECHNICAL_LEAD') && name) {
    return name;
  }
  return null;
}

export function isSundaramUser(user: any): boolean {
  if (!user) return false;
  return getTlNameForUser(user) === 'Sundaram';
}

export function isSiteInspectorUser(user: any): boolean {
  if (!user) return false;
  return String(user.role || '').toUpperCase() === 'SITE_INSPECTOR';
}

export function normalizeTlValue(raw?: string | null): string {
  if (!raw) return '';
  const val = String(raw).trim();
  if (!val || ['UNASSIGNED', 'NONE', 'NULL'].includes(val.toUpperCase())) return '';
  if (/srinivasan|srini/i.test(val)) return 'Srinivasan (TL)';
  if (/sundaram|sundar/i.test(val)) return 'Sundaram';
  if (/\bbala\b/i.test(val) && !/balaji/i.test(val)) return 'Bala';
  return val;
}

export function doesCustomerMatchTlFilter(customer: any, tlFilter?: string | null): boolean {
  if (!tlFilter || !String(tlFilter).trim()) return true;
  const rawFilter = String(tlFilter).trim();
  const custTl = normalizeTlValue(customer?.assignedTl || customer?.activeProject?.assignedTl);
  if (rawFilter.toLowerCase() === 'unassigned' || rawFilter.toLowerCase() === 'none') {
    return !custTl;
  }
  const targetTl = normalizeTlValue(rawFilter);
  if (!targetTl) return true;
  return custTl === targetTl;
}

export function isCustomerAssignedToTlUser(customer: any, user: any): boolean {
  if (!user || !customer) return true;
  const tlName = getTlNameForUser(user);
  if (!tlName) return true;

  const targetTl = normalizeTlValue(tlName);
  const custTl = normalizeTlValue(customer.assignedTl);

  // If customer has an explicit assignedTl, it is authoritative
  if (custTl) {
    return custTl === targetTl;
  }

  // Next check activeProject's assignedTl if customer.assignedTl is empty
  const projTl = normalizeTlValue(customer.activeProject?.assignedTl);
  if (projTl) {
    return projTl === targetTl;
  }

  const userId = String(user._id || user.id || '');
  const custTlId = String(customer.assignedTlId?._id || customer.assignedTlId || '');
  if (userId && custTlId && userId === custTlId) return true;

  const projTlId = String(customer.activeProject?.assignedTlId?._id || customer.activeProject?.assignedTlId || '');
  if (userId && projTlId && userId === projTlId) return true;

  return false;
}

export function isProjectAssignedToTlUser(project: any, user: any): boolean {
  if (!user || !project) return true;
  const tlName = getTlNameForUser(user);
  if (!tlName) return true;

  const targetTl = normalizeTlValue(tlName);
  const custTl = normalizeTlValue(project.customerId?.assignedTl);
  if (custTl) {
    return custTl === targetTl;
  }

  const projTl = normalizeTlValue(project.assignedTl);
  if (projTl) {
    return projTl === targetTl;
  }

  const userId = String(user._id || user.id || '');
  const projTlId = String(project.assignedTlId?._id || project.assignedTlId || '');
  const custTlId = String(project.customerId?.assignedTlId?._id || project.customerId?.assignedTlId || '');

  if (userId && (userId === projTlId || userId === custTlId)) return true;

  return false;
}
