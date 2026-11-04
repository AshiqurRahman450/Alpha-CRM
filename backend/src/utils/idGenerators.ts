import { Project, Customer } from '../models';

/**
 * Generates the next unique projectId in sequence: ALP-001, ALP-002, ..., ALP-019, etc.
 * Finds the maximum numeric suffix across all existing projects to prevent E11000 duplicate key errors
 * even if earlier projects were deleted or IDs were skipped.
 */
export async function getNextProjectId(): Promise<string> {
  // Query all projects with projectId matching ALP-<number>
  const projects = await Project.find(
    { projectId: /^ALP-\d+$/i },
    { projectId: 1 }
  ).lean();

  let maxNum = 0;
  for (const p of projects) {
    if (p.projectId) {
      const match = p.projectId.match(/^ALP-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  // Also check if any non-standard or highest count exists
  const totalCount = await Project.countDocuments();
  if (totalCount > maxNum) {
    maxNum = totalCount;
  }

  let nextNum = maxNum + 1;
  let candidate = `ALP-${String(nextNum).padStart(3, '0')}`.toUpperCase();

  // Double check with exists in case of any concurrent write or non-sequential IDs
  while (await Project.exists({ projectId: candidate })) {
    nextNum++;
    candidate = `ALP-${String(nextNum).padStart(3, '0')}`.toUpperCase();
  }

  return candidate;
}

/**
 * Generates the next unique customerId in sequence: CUST-001, CUST-002, etc.
 * Finds the maximum numeric suffix across all existing customers to prevent E11000 duplicate key errors.
 */
export async function getNextCustomerId(): Promise<string> {
  const customers = await Customer.find(
    { customerId: /^CUST-\d+$/i },
    { customerId: 1 }
  ).lean();

  let maxNum = 0;
  for (const c of customers) {
    if (c.customerId) {
      const match = c.customerId.match(/^CUST-(\d+)$/i);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
  }

  const totalCount = await Customer.countDocuments();
  if (totalCount > maxNum) {
    maxNum = totalCount;
  }

  let nextNum = maxNum + 1;
  let candidate = `CUST-${String(nextNum).padStart(3, '0')}`.toUpperCase();

  while (await Customer.exists({ customerId: candidate })) {
    nextNum++;
    candidate = `CUST-${String(nextNum).padStart(3, '0')}`.toUpperCase();
  }

  return candidate;
}
