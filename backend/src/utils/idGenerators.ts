import { Project, Customer, Quotation, Payment, Reminder } from '../models';

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

/**
 * Ensures every project has its own unique, individual customer.
 * If multiple projects currently share the same customer document,
 * separates projects 1..N into their own individual customer documents
 * (with the same customer name, phone, address) and updates all associated records.
 */
export async function splitSharedCustomerProjects(): Promise<void> {
  try {
    const customers = await Customer.find().lean();
    for (const cust of customers) {
      const projects = await Project.find({ customerId: cust._id }).sort({ createdAt: 1 });
      if (projects.length > 1) {
        // Project index 0 keeps original customer cust
        // Projects index 1..N get their own individual customer
        for (let i = 1; i < projects.length; i++) {
          const proj = projects[i];

          // Check if this project was created from an approved quotation
          const linkedQuotation = await Quotation.findOne({
            $or: [
              { createdProjectId: proj._id },
              { createdProjectCode: proj.projectId },
            ],
          });

          const qData = linkedQuotation?.data || {};
          const newCustomerId = await getNextCustomerId();

          const newCust = await Customer.create({
            customerId: newCustomerId,
            fullName: qData.clientName || cust.fullName,
            phoneNumber: qData.customerPhone || cust.phoneNumber,
            whatsappNumber: qData.customerPhone || cust.whatsappNumber || cust.phoneNumber,
            address: proj.siteAddress || cust.address,
            city: qData.projectCity || cust.city || 'Mumbai',
            state: cust.state || 'Maharashtra',
            pincode: cust.pincode || '400001',
            customerType: cust.customerType || 'Residential',
            leadSource: cust.leadSource || 'Quotation Proposal',
            assignedEmployee: proj.assignedEmployee || cust.assignedEmployee,
            bdmId: proj.bdmId || cust.bdmId,
            bdmPhone: proj.bdmPhone || cust.bdmPhone,
            notes: `Individual customer auto-created for Project ${proj.projectId} (${proj.projectName})`,
          });

          // Update Project to point to this individual customer
          proj.customerId = newCust._id;
          proj.customerCode = newCust.customerId;
          await proj.save();

          // Update Quotation if linked
          if (linkedQuotation) {
            linkedQuotation.createdCustomerId = newCust._id;
            linkedQuotation.createdCustomerCode = newCust.customerId;
            await linkedQuotation.save();
          }

          // Update Payments
          await Payment.updateMany(
            { projectId: proj._id },
            { $set: { customerId: newCust._id, customerCode: newCust.customerId } }
          );

          // Update Reminders
          await Reminder.updateMany(
            { relatedProjectId: proj._id },
            { $set: { relatedCustomerId: newCust._id } }
          );

          console.log(`[splitSharedCustomerProjects] Separated project ${proj.projectId} to new individual customer ${newCust.customerId} (${newCust.fullName})`);
        }
      }
    }
  } catch (err: any) {
    console.warn('[splitSharedCustomerProjects] Error during separation:', err.message);
  }
}


