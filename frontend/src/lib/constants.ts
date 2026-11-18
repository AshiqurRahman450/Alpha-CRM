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

  // Never match BDMs (e.g. Balaji)
  if (role === 'BDM') return null;

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

export function isCustomerAssignedToTlUser(customer: any, user: any): boolean {
  if (!user || !customer) return true;
  const tlName = getTlNameForUser(user);
  if (!tlName) return true;

  const userId = String(user._id || user.id || '');
  const custTlId = String(customer.assignedTlId?._id || customer.assignedTlId || '');
  if (userId && custTlId && userId === custTlId) return true;

  const target = tlName.toLowerCase().replace(/[^a-z]/g, '');
  const assigned = String(customer.assignedTl || '').toLowerCase().replace(/[^a-z]/g, '');

  if (tlName === 'Bala') {
    if (
      (assigned.includes('bala') && !assigned.includes('balaji')) ||
      (customer.assignedTl && /\bbala\b/i.test(customer.assignedTl))
    ) return true;
  } else if (target.includes('srini') || assigned.includes('srini')) {
    if (assigned.includes('srini')) return true;
  } else if (target.includes('sundar') || assigned.includes('sundar')) {
    if (assigned.includes('sundar')) return true;
  } else if (assigned && (assigned.includes(target) || target.includes(assigned))) {
    return true;
  }

  // Also check if customer's activeProject is assigned to this TL
  if (customer.activeProject) {
    const proj = customer.activeProject;
    const projTlId = String(proj.assignedTlId?._id || proj.assignedTlId || '');
    if (userId && projTlId && userId === projTlId) return true;

    const assignedProj = String(proj.assignedTl || '').toLowerCase().replace(/[^a-z]/g, '');
    if (tlName === 'Bala') {
      if (
        (assignedProj.includes('bala') && !assignedProj.includes('balaji')) ||
        (proj.assignedTl && /\bbala\b/i.test(proj.assignedTl))
      ) return true;
    } else if (target.includes('srini') || assignedProj.includes('srini')) {
      if (assignedProj.includes('srini')) return true;
    } else if (target.includes('sundar') || assignedProj.includes('sundar')) {
      if (assignedProj.includes('sundar')) return true;
    } else if (assignedProj && (assignedProj.includes(target) || target.includes(assignedProj))) {
      return true;
    }
  }

  return false;
}

export function isProjectAssignedToTlUser(project: any, user: any): boolean {
  if (!user || !project) return true;
  const tlName = getTlNameForUser(user);
  if (!tlName) return true;

  const userId = String(user._id || user.id || '');
  const projTlId = String(project.assignedTlId?._id || project.assignedTlId || '');
  const custTlId = String(project.customerId?.assignedTlId?._id || project.customerId?.assignedTlId || '');

  if (userId && (userId === projTlId || userId === custTlId)) return true;

  const target = tlName.toLowerCase().replace(/[^a-z]/g, '');
  const assignedProj = String(project.assignedTl || '').toLowerCase().replace(/[^a-z]/g, '');
  const assignedCust = String(project.customerId?.assignedTl || '').toLowerCase().replace(/[^a-z]/g, '');

  if (tlName === 'Bala') {
    const projMatch = (assignedProj.includes('bala') && !assignedProj.includes('balaji')) || (project.assignedTl && /\bbala\b/i.test(project.assignedTl));
    const custMatch = (assignedCust.includes('bala') && !assignedCust.includes('balaji')) || (project.customerId?.assignedTl && /\bbala\b/i.test(project.customerId.assignedTl));
    return Boolean(projMatch || custMatch);
  }

  if (target.includes('srini')) {
    if (assignedProj.includes('srini') || assignedCust.includes('srini')) return true;
  }
  if (target.includes('sundar')) {
    if (assignedProj.includes('sundar') || assignedCust.includes('sundar')) return true;
  }

  return (
    (!!assignedProj && (assignedProj.includes(target) || target.includes(assignedProj))) ||
    (!!assignedCust && (assignedCust.includes(target) || target.includes(assignedCust)))
  );
}
