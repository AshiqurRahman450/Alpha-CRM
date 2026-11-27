import { Project, Customer, Quotation, Payment, Reminder, WhatsAppChannel, WhatsAppMessage, QCReport } from '../models';
import { Types } from 'mongoose';

const PLACEHOLDER_CUSTOMER_REGEX = /^(client|new\s*client|valued\s*client|valued\s*customer|customer|primary\s*client|n\/a|unknown|-|sir\/madam|dear\s*sir\/madam)$/i;

/**
 * Returns true if the given name is empty or a generic placeholder such as "Client", "New Client", "Valued Client", etc.
 */
export function isPlaceholderCustomerName(name?: string | null): boolean {
  if (!name || typeof name !== 'string') return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_CUSTOMER_REGEX.test(trimmed);
}

/**
 * Extracts a clean customer name from a project name or WhatsApp group name
 * (e.g. "Dr. Rajesh Mehra Residence Lift" -> "Dr. Rajesh Mehra",
 *  "Senthil Kumar — Alpha Updates" -> "Senthil Kumar")
 */
export function extractCustomerNameFromProjectName(projectName?: string | null): string {
  if (!projectName || typeof projectName !== 'string') return '';
  let cleaned = projectName
    .trim()
    .replace(/\s*[—–-]\s*alpha\s+updates.*$/i, '')
    .replace(/\s*\(\s*ALP-\d+\s*\)/gi, '')
    .replace(/\bALP-\d+\b/gi, '')
    .replace(
      /\s+(?:residence\s*lift|home\s*lift|elevator\s*project|residence\s*elevator|commercial\s*lift|passenger\s*lift|hospital\s*lift|villa\s*lift|bungalow\s*lift|apartment\s*lift|hydraulic\s*lift|gearless\s*lift|residence|villa|bungalow|apartments?|complex|tower|heights|enclave|building|elevator|lift|project)\b.*$/i,
      ''
    )
    .replace(/\s*[—–-]\s*$/, '')
    .trim();

  if (!cleaned || isPlaceholderCustomerName(cleaned)) {
    return '';
  }
  return cleaned;
}

/**
 * Resolves the true customer name for a project from populated customer, project fields, or projectName.
 * Never returns "Client" unless explicitly passed as fallback and no real name is available.
 */
export function resolveProjectCustomerName(project?: any, customer?: any, fallback: string = ''): string {
  const candidates = [
    customer?.fullName,
    customer?.name,
    typeof project?.customerId === 'object' && project?.customerId !== null ? (project.customerId as any).fullName : undefined,
    typeof project?.customerId === 'object' && project?.customerId !== null ? (project.customerId as any).name : undefined,
    project?.customerName,
    project?.clientName,
    extractCustomerNameFromProjectName(project?.projectName),
    extractCustomerNameFromProjectName(project?.whatsappGroupName || project?.whatsapp?.groupName),
  ];

  for (const cand of candidates) {
    if (cand && typeof cand === 'string' && !isPlaceholderCustomerName(cand)) {
      return cand.trim();
    }
  }

  if (project?.projectName && !isPlaceholderCustomerName(project.projectName)) {
    return String(project.projectName).trim();
  }

  return fallback;
}

/**
 * Personalizes a WhatsApp message text so that generic greetings ("Dear Sir/Madam,", "Dear Valued Client,")
 * or placeholder customer lines ("*Customer:* Client") use the customer's real name.
 */
export function personalizeWhatsAppMessageForCustomer(messageText: string, customerName?: string | null): string {
  if (!messageText || typeof messageText !== 'string') return messageText;
  const cleanName = customerName && !isPlaceholderCustomerName(customerName) ? customerName.trim() : '';
  if (!cleanName) return messageText;

  return messageText
    .replace(/Dear\s+Sir\s*\/\s*Madam\s*,/gi, `Dear ${cleanName},`)
    .replace(/Dear\s+Valued\s+(?:Client|Customer)\s*,/gi, `Dear ${cleanName},`)
    .replace(/Dear\s+Client\s*,/gi, `Dear ${cleanName},`)
    .replace(/\[Customer\s*Name\]/gi, cleanName)
    .replace(/\{\{\s*customer_name\s*\}\}/gi, cleanName)
    .replace(/(\*Customer(?:\s+Name)?:\*\s*)Client\b/gi, `$1${cleanName}`)
    .replace(/(•\s*\*?Customer(?:\s+Name)?:\*?\s*)Client\b/gi, `$1${cleanName}`);
}

/**
 * Ensures a project document has a populated customerId with a valid, non-placeholder fullName.
 * If the project lost its customerId reference or the linked customer's fullName is "Client",
 * recovers the customer record/name from customerCode, Quotation, WhatsAppChannel, WhatsAppMessage,
 * Payment, QCReport, or project.projectName, and persists the repair in MongoDB.
 */
export async function ensureProjectCustomerPopulated(project: any): Promise<any> {
  if (!project) return null;
  try {
    let custDoc: any = null;
    const rawCustomerId = project.customerId;

    if (rawCustomerId && typeof rawCustomerId === 'object' && (rawCustomerId._id || rawCustomerId.fullName)) {
      custDoc = rawCustomerId;
    } else if (rawCustomerId && Types.ObjectId.isValid(String(rawCustomerId))) {
      if (typeof project.populate === 'function') {
        await project.populate('customerId');
        custDoc = project.customerId;
      } else {
        custDoc = await Customer.findById(rawCustomerId);
      }
    }

    // If custDoc exists and has a valid non-placeholder fullName, ensure project.customerId is set to it
    if (custDoc && !isPlaceholderCustomerName(custDoc.fullName)) {
      project.customerId = custDoc;
      return custDoc;
    }

    // Otherwise, recover the true customer & fullName from all available sources
    let recoveredCustomer: any = custDoc || null;
    let recoveredName = '';
    let recoveredPhone = custDoc?.phoneNumber || '';
    let recoveredCity = custDoc?.city || '';

    // 1. Check by project.customerCode
    if (!recoveredCustomer && project.customerCode) {
      const byCode = await Customer.findOne({ customerId: project.customerCode });
      if (byCode) {
        recoveredCustomer = byCode;
        if (!isPlaceholderCustomerName(byCode.fullName)) {
          recoveredName = byCode.fullName.trim();
        }
      }
    }

    // 2. Check linked Quotation
    if (!recoveredName || !recoveredCustomer) {
      const linkedQuotation = await Quotation.findOne({
        $or: [
          ...(project._id ? [{ createdProjectId: project._id }] : []),
          ...(project.projectId ? [{ createdProjectCode: project.projectId }] : []),
        ],
      }).sort({ createdAt: -1 });

      if (linkedQuotation) {
        const qClientName = linkedQuotation.data?.clientName;
        if (!recoveredName && qClientName && !isPlaceholderCustomerName(qClientName)) {
          recoveredName = String(qClientName).trim();
        }
        if (!recoveredPhone && linkedQuotation.data?.customerPhone) {
          recoveredPhone = String(linkedQuotation.data.customerPhone).trim();
        }
        if (!recoveredCity && linkedQuotation.data?.projectCity) {
          recoveredCity = String(linkedQuotation.data.projectCity).trim();
        }
        if (!recoveredCustomer && linkedQuotation.createdCustomerId) {
          const qCust = await Customer.findById(linkedQuotation.createdCustomerId);
          if (qCust) {
            recoveredCustomer = qCust;
            if (!recoveredName && !isPlaceholderCustomerName(qCust.fullName)) {
              recoveredName = qCust.fullName.trim();
            }
          }
        }
      }
    }

    // 3. Check WhatsAppChannel
    if ((!recoveredName || !recoveredCustomer) && project._id) {
      const channel = await WhatsAppChannel.findOne({ projectId: project._id });
      if (channel) {
        if (!recoveredName && channel.customerName && !isPlaceholderCustomerName(channel.customerName)) {
          recoveredName = channel.customerName.trim();
        }
        if (!recoveredName && Array.isArray(channel.participants) && channel.participants[0]?.name && !isPlaceholderCustomerName(channel.participants[0].name)) {
          recoveredName = channel.participants[0].name.trim();
        }
        if (!recoveredPhone && Array.isArray(channel.participants) && channel.participants[0]?.phoneNumber) {
          recoveredPhone = channel.participants[0].phoneNumber.trim();
        }
        if (!recoveredCustomer && channel.customerId) {
          const chCust = await Customer.findById(channel.customerId);
          if (chCust) {
            recoveredCustomer = chCust;
            if (!recoveredName && !isPlaceholderCustomerName(chCust.fullName)) {
              recoveredName = chCust.fullName.trim();
            }
          }
        }
      }
    }

    // 4. Check Payment records
    if ((!recoveredName || !recoveredCustomer) && project._id) {
      const payment = await Payment.findOne({ projectId: project._id }).sort({ createdAt: -1 });
      if (payment) {
        if (!recoveredName && payment.customerName && !isPlaceholderCustomerName(payment.customerName)) {
          recoveredName = payment.customerName.trim();
        }
        if (!recoveredCustomer && payment.customerId) {
          const pCust = await Customer.findById(payment.customerId);
          if (pCust) {
            recoveredCustomer = pCust;
            if (!recoveredName && !isPlaceholderCustomerName(pCust.fullName)) {
              recoveredName = pCust.fullName.trim();
            }
          }
        }
      }
    }

    // 5. Check QCReport records
    if (!recoveredName) {
      const qcOr: any[] = [];
      if (project._id) qcOr.push({ projectId: project._id });
      if (project.projectId) qcOr.push({ jobNo: project.projectId });
      if (qcOr.length > 0) {
        const qcReport = await QCReport.findOne({ $or: qcOr }).sort({ createdAt: -1 });
        if (qcReport && qcReport.clientName && !isPlaceholderCustomerName(qcReport.clientName)) {
          recoveredName = qcReport.clientName.trim();
        }
      }
    }

    // 6. Check WhatsAppMessage records
    if (!recoveredName && project._id) {
      const waMessages = await WhatsAppMessage.find({ projectId: project._id }).sort({ createdAt: 1 }).limit(10).lean();
      for (const msg of waMessages) {
        if (msg.customerName && !isPlaceholderCustomerName(msg.customerName)) {
          recoveredName = msg.customerName.trim();
          break;
        }
      }
    }

    // 7. Extract from project.projectName or whatsappGroupName
    if (!recoveredName) {
      recoveredName =
        extractCustomerNameFromProjectName(project.projectName) ||
        extractCustomerNameFromProjectName(project.whatsappGroupName || project.whatsapp?.groupName) ||
        (project.projectName && !isPlaceholderCustomerName(project.projectName) ? String(project.projectName).trim() : '');
    }

    // 8. If we still don't have a linked Customer document, try finding by exact recoveredName
    if (!recoveredCustomer && recoveredName) {
      const escaped = recoveredName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const byName = await Customer.findOne({ fullName: new RegExp(`^${escaped}$`, 'i') });
      if (byName) {
        recoveredCustomer = byName;
      }
    }

    // 9. Heal or create the Customer document in MongoDB
    if (recoveredCustomer) {
      const actualCustDoc = recoveredCustomer._id && typeof recoveredCustomer.save === 'function'
        ? recoveredCustomer
        : await Customer.findById(recoveredCustomer._id);

      if (actualCustDoc) {
        if (isPlaceholderCustomerName(actualCustDoc.fullName) && recoveredName) {
          actualCustDoc.fullName = recoveredName;
          await actualCustDoc.save();
          console.log(`[CustomerSelfHeal] Repaired Customer ${actualCustDoc.customerId} fullName to "${recoveredName}" for project ${project.projectId}`);
        }

        const currentCustIdStr = rawCustomerId?._id ? String(rawCustomerId._id) : String(rawCustomerId || '');
        if (currentCustIdStr !== String(actualCustDoc._id) || project.customerCode !== actualCustDoc.customerId) {
          await Project.updateOne(
            { _id: project._id },
            { $set: { customerId: actualCustDoc._id, customerCode: actualCustDoc.customerId } }
          );
        }
        project.customerId = actualCustDoc;
        project.customerCode = actualCustDoc.customerId;
        return actualCustDoc;
      }
    } else if (recoveredName && project._id) {
      // Create a dedicated Customer document so the project is never orphaned
      const newCustCode = project.customerCode && !await Customer.exists({ customerId: project.customerCode })
        ? project.customerCode
        : await getNextCustomerId();
      const createdCustomer = await Customer.create({
        customerId: newCustCode,
        fullName: recoveredName,
        phoneNumber: recoveredPhone || project.bdmPhone || '+91 98400 00000',
        whatsappNumber: recoveredPhone || project.bdmPhone || '+91 98400 00000',
        address: project.siteAddress || 'Site Address',
        city: recoveredCity || 'Chennai',
        state: 'Tamil Nadu',
        pincode: '600001',
        customerType: 'Residential',
        leadSource: 'Direct Project',
        whatsappOptIn: true,
        assignedEmployee: project.assignedEmployee,
        bdmId: project.bdmId,
        bdmPhone: project.bdmPhone,
        assignedTl: project.assignedTl,
        assignedTlId: project.assignedTlId,
      });

      await Project.updateOne(
        { _id: project._id },
        { $set: { customerId: createdCustomer._id, customerCode: createdCustomer.customerId } }
      );
      project.customerId = createdCustomer;
      project.customerCode = createdCustomer.customerId;
      console.log(`[CustomerSelfHeal] Re-created missing Customer ${createdCustomer.customerId} ("${recoveredName}") for project ${project.projectId}`);
      return createdCustomer;
    }

    return custDoc;
  } catch (err: any) {
    console.warn('[ensureProjectCustomerPopulated] Notice:', err.message);
    return project.customerId;
  }
}

/**
 * Startup & on-demand migration that scans all Projects, Customers, WhatsAppChannels, and Payments
 * to repair any orphaned customerId references or placeholder "Client" customer names.
 */
export async function healOrphanedAndPlaceholderCustomers(): Promise<void> {
  try {
    const projects = await Project.find({}).populate('customerId');
    let healedCount = 0;

    for (const proj of projects) {
      const cust = proj.customerId as any;
      if (!cust || !cust._id || isPlaceholderCustomerName(cust.fullName)) {
        const resolvedCust = await ensureProjectCustomerPopulated(proj);
        if (resolvedCust && !isPlaceholderCustomerName(resolvedCust.fullName)) {
          healedCount++;
        }
      }

      // Also synchronize WhatsAppChannel and Payment customerName if they were saved as 'Client'
      const finalCust = proj.customerId as any;
      const validName = resolveProjectCustomerName(proj, finalCust);
      if (validName && !isPlaceholderCustomerName(validName)) {
        await WhatsAppChannel.updateMany(
          {
            projectId: proj._id,
            $or: [
              { customerName: { $in: ['Client', 'New Client', 'Valued Client', 'Valued Customer', 'Customer', '', null] } },
              { customerName: { $exists: false } },
            ],
          },
          {
            $set: {
              customerName: validName,
              ...(finalCust?._id ? { customerId: finalCust._id } : {}),
            },
          }
        );

        await Payment.updateMany(
          {
            projectId: proj._id,
            $or: [
              { customerName: { $in: ['Client', 'New Client', 'Valued Client', 'Valued Customer', 'Customer', '', null] } },
              { customerName: { $exists: false } },
            ],
          },
          {
            $set: {
              customerName: validName,
              ...(finalCust?._id ? { customerId: finalCust._id } : {}),
            },
          }
        );

        await WhatsAppMessage.updateMany(
          {
            projectId: proj._id,
            customerName: { $in: ['Client', 'New Client', 'Valued Client', 'Valued Customer', 'Customer', '', null] },
          },
          {
            $set: {
              customerName: validName,
              ...(finalCust?._id ? { customerId: finalCust._id } : {}),
            },
          }
        );
      }
    }

    // Also check any standalone Customer documents that have placeholder fullName ("Client", "New Client", etc.)
    const placeholderCustomers = await Customer.find({
      fullName: PLACEHOLDER_CUSTOMER_REGEX,
    });

    for (const pCust of placeholderCustomers) {
      const linkedProj = await Project.findOne({
        $or: [{ customerId: pCust._id }, { customerCode: pCust.customerId }],
      });
      if (linkedProj) {
        const extracted = extractCustomerNameFromProjectName(linkedProj.projectName);
        if (extracted && !isPlaceholderCustomerName(extracted)) {
          pCust.fullName = extracted;
          await pCust.save();
          healedCount++;
          continue;
        }
      }

      const linkedQuot = await Quotation.findOne({
        $or: [{ createdCustomerId: pCust._id }, { createdCustomerCode: pCust.customerId }],
      });
      if (linkedQuot?.data?.clientName && !isPlaceholderCustomerName(linkedQuot.data.clientName)) {
        pCust.fullName = String(linkedQuot.data.clientName).trim();
        await pCust.save();
        healedCount++;
      }
    }

    if (healedCount > 0) {
      console.log(`[healOrphanedAndPlaceholderCustomers] Repaired ${healedCount} project/customer record(s) with accurate customer names.`);
    }
  } catch (err: any) {
    console.warn('[healOrphanedAndPlaceholderCustomers] Warning during customer self-healing:', err.message);
  }
}

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
 * Generates the next unique customerId for Old Customers in sequence: CUST-001, CUST-002, etc.
 * Old Customers and Regular Customers now share the exact same continuous CUST-XXX numbering sequence.
 */
export async function getNextOldCustomerId(): Promise<string> {
  return getNextCustomerId();
}

/**
 * Resequences all customer IDs in ascending numeric order (CUST-001, CUST-002, CUST-003...)
 * without any gaps or duplicate key collisions.
 * Also synchronizes denormalized customerCode across Project and Quotation records.
 */
export async function resequenceCustomerIds(): Promise<{ totalResequenced: number; updatedCount: number }> {
  try {
    const customers = await Customer.find({}).lean();
    if (!customers || customers.length === 0) {
      return { totalResequenced: 0, updatedCount: 0 };
    }

    // Sort customers preserving existing numeric order or creation order
    customers.sort((a, b) => {
      const extractNum = (cid: string | undefined): number => {
        if (!cid) return 999999;
        const clean = cid.replace(/__TMP_[a-f0-9]+_\d+/i, '');
        const match = (clean || cid).match(/\d+/);
        return match ? parseInt(match[0], 10) : 999999;
      };

      const numA = extractNum(a.customerId);
      const numB = extractNum(b.customerId);

      if (numA !== numB) {
        return numA - numB;
      }

      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      if (timeA !== timeB) {
        return timeA - timeB;
      }

      return String(a._id).localeCompare(String(b._id));
    });

    const updates: { id: any; oldId: string; targetId: string }[] = [];
    customers.forEach((cust, index) => {
      const targetId = `CUST-${String(index + 1).padStart(3, '0')}`;
      if (cust.customerId !== targetId) {
        updates.push({
          id: cust._id,
          oldId: cust.customerId,
          targetId,
        });
      }
    });

    if (updates.length === 0) {
      return { totalResequenced: customers.length, updatedCount: 0 };
    }

    // Phase 1: assign temporary unique IDs to prevent E11000 duplicate key errors on unique index { customerId: 1 }
    for (let i = 0; i < updates.length; i++) {
      const item = updates[i];
      const tempId = `__TMP_${item.id}_${Date.now()}_${i}`;
      await Customer.updateOne({ _id: item.id }, { $set: { customerId: tempId } });
    }

    // Phase 2: assign target continuous IDs and synchronize Project and Quotation references
    for (const item of updates) {
      await Customer.updateOne({ _id: item.id }, { $set: { customerId: item.targetId } });

      // Synchronize Project customerCode by customerId reference OR by previous oldId
      await Project.updateMany(
        { $or: [{ customerId: item.id }, { customerCode: item.oldId }] },
        { $set: { customerCode: item.targetId } }
      );

      // Synchronize Quotation createdCustomerCode
      await Quotation.updateMany(
        { $or: [{ createdCustomerId: item.id }, { createdCustomerCode: item.oldId }] },
        { $set: { createdCustomerCode: item.targetId } }
      );
    }

    console.log(`[resequenceCustomerIds] Successfully resequenced ${updates.length} customer IDs out of ${customers.length} total.`);
    return { totalResequenced: customers.length, updatedCount: updates.length };
  } catch (err: any) {
    console.error('[resequenceCustomerIds] Error during resequencing:', err);
    throw err;
  }
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
          const isOld = (cust as any).isOldCustomer || cust.customerId?.startsWith('OLD-CUST-');
          const newCustomerId = isOld ? await getNextOldCustomerId() : await getNextCustomerId();

          const newCust = await Customer.create({
            customerId: newCustomerId,
            isOldCustomer: isOld,
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


