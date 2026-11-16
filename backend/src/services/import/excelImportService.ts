import * as XLSX from 'xlsx';
import { Customer, Project, User, ProjectStatus } from '../../models';
import { getNextCustomerId, getNextProjectId } from '../../utils/idGenerators';
import { logProjectActivity } from '../activity/activityService';
import { calculateNextUpdateDate } from '../scheduler/schedulerService';

export interface ImportSummary {
  totalRows: number;
  customersCreated: number;
  customersUpdated: number;
  projectsCreated: number;
  projectsUpdated: number;
  errorsCount: number;
}

export interface ImportedItem {
  rowNumber: number;
  customerCode: string;
  customerName: string;
  phone: string;
  projectCode?: string;
  projectName?: string;
  stage?: string;
  orderValue?: number;
  isNewCustomer: boolean;
  isNewProject: boolean;
}

export interface ImportError {
  rowNumber: number;
  customerName?: string;
  projectName?: string;
  reason: string;
}

export interface ImportResult {
  success: boolean;
  message: string;
  summary: ImportSummary;
  items: ImportedItem[];
  errors: ImportError[];
}

/**
 * Normalizes an arbitrary header string for fuzzy matching
 */
function normalizeKey(str: any): string {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Normalizes phone numbers to standard 10 digits when possible
 */
function normalizePhone(val: any): string {
  if (!val) return '';
  const digits = String(val).replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) {
    return digits.slice(-10);
  }
  if (digits.length > 10 && digits.startsWith('0')) {
    return digits.slice(-10);
  }
  return digits.length >= 10 ? digits.slice(-10) : digits;
}

/**
 * Flexible Date parser supporting Excel serial numbers and date strings (DD/MM/YYYY, YYYY-MM-DD, etc.)
 */
function parseExcelDate(val: any): Date | undefined {
  if (!val) return undefined;
  if (val instanceof Date && !isNaN(val.getTime())) {
    return val;
  }
  if (typeof val === 'number') {
    // Excel serial date: days since 1899-12-30
    const utc_days = Math.floor(val - 25569);
    const utc_value = utc_days * 86400;
    const date_info = new Date(utc_value * 1000);
    if (!isNaN(date_info.getTime())) return date_info;
  }
  const str = String(val).trim();
  if (!str) return undefined;

  // Check DD/MM/YYYY or DD-MM-YYYY
  const ddmmyyyy = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (ddmmyyyy) {
    const day = parseInt(ddmmyyyy[1], 10);
    const month = parseInt(ddmmyyyy[2], 10) - 1;
    const year = parseInt(ddmmyyyy[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  // Check YYYY-MM-DD
  const yyyymmdd = str.match(/^(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$/);
  if (yyyymmdd) {
    const year = parseInt(yyyymmdd[1], 10);
    const month = parseInt(yyyymmdd[2], 10) - 1;
    const day = parseInt(yyyymmdd[3], 10);
    const d = new Date(year, month, day);
    if (!isNaN(d.getTime())) return d;
  }

  const direct = new Date(str);
  if (!isNaN(direct.getTime())) return direct;

  return undefined;
}

/**
 * Maps arbitrary stage string from Excel to system ProjectStatus
 */
function resolveProjectStage(rawStage: any): ProjectStatus {
  if (!rawStage) return 'PAYMENT_RECEIVED';
  const clean = normalizeKey(rawStage);

  if (clean.includes('advance') || clean.includes('paymentrec') || clean.includes('initialpay')) {
    return 'PAYMENT_RECEIVED';
  }
  if (clean.includes('sitevisit') || clean.includes('sitemeas') || clean.includes('measurement')) {
    return 'SITE_MEASUREMENT';
  }
  if (clean.includes('drawingandcabinapproval') || clean.includes('approval') || clean.includes('approved')) {
    return 'CUSTOMER_APPROVAL';
  }
  if (clean.includes('drawing') || clean.includes('cabin') || clean.includes('design')) {
    return 'DESIGN';
  }
  if (clean.includes('productionpay') || clean.includes('engineering')) {
    return 'ENGINEERING';
  }
  if (clean.includes('productioninprog') || clean.includes('manufacturing') || clean.includes('production')) {
    return 'MANUFACTURING';
  }
  if (clean.includes('readiness') || clean.includes('qc') || clean.includes('qualitycheck')) {
    return 'QUALITY_CHECK';
  }
  if (clean.includes('materialready') || clean.includes('readytodispatch') || clean.includes('dispatchready') || clean.includes('dispatched') || clean.includes('dispatch')) {
    return 'DISPATCH';
  }
  if (clean.includes('transit') || clean.includes('intransit')) {
    return 'MATERIAL_IN_TRANSIT';
  }
  if (clean.includes('presite') || clean.includes('previsit')) {
    return 'DELIVERY';
  }
  if (clean.includes('materialdeliv') || clean.includes('delivered')) {
    return 'MATERIAL_DELIVERY';
  }
  if (clean.includes('installation') || clean.includes('install')) {
    return 'INSTALLATION';
  }
  if (clean.includes('testing') || clean.includes('handover') || clean.includes('commission')) {
    return 'TESTING';
  }
  if (clean.includes('complet') || clean.includes('finished') || clean.includes('closed')) {
    return 'COMPLETED';
  }
  if (clean.includes('hold')) {
    return 'ON_HOLD';
  }
  if (clean.includes('cancel')) {
    return 'CANCELLED';
  }

  return 'PAYMENT_RECEIVED';
}

/**
 * Normalizes shaft model name with civil shaft support
 */
function resolveShaftModel(rawModel: any): string {
  if (!rawModel) return 'Civil Shaft';
  const clean = normalizeKey(rawModel);
  if (clean.includes('noshaft') || clean.includes('civil')) return 'Civil Shaft';
  if (clean.includes('acp')) return 'ACP Shaft';
  if (clean.includes('glass')) return 'Glass Shaft';
  if (clean.includes('ms') || clean.includes('structure') || clean.includes('steel')) return 'MS Structure';
  return String(rawModel).trim();
}

/**
 * Normalizes lift model name
 */
function resolveLiftModel(rawModel: any): string {
  if (!rawModel) return 'AE 01 Home Series';
  const clean = normalizeKey(rawModel);
  if (clean.includes('ae01') || clean.includes('ae1')) return 'AE 01 Home Series';
  if (clean.includes('ae02') || clean.includes('ae2') || clean.includes('rope')) return 'AE 02 Gearless Rope Home Series';
  if (clean.includes('ae03') || clean.includes('ae3') || clean.includes('belt')) return 'AE 03 Gearless Belt Home series';
  if (clean.includes('alphaev') || clean.includes('ev')) return 'Alpha EV';
  if (clean.includes('alphapremier') || clean.includes('premier')) return 'Alpha Premier';
  if (clean.includes('alphaluxe') || clean.includes('luxe')) return 'Alpha Luxe';
  if (clean.includes('hydraulic')) return 'Hydraulic Home Series';
  return String(rawModel).trim();
}

/**
 * Main importer function: parses Excel buffer, creates/updates Customers and Projects
 */
export async function parseAndImportExcel(
  buffer: Buffer,
  currentUser?: { _id?: any; name?: string; role?: string }
): Promise<ImportResult> {
  const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('The uploaded Excel file does not contain any sheets');
  }

  // Use the first sheet or the sheet named "Alpha CRM" / "Customers & Projects"
  const targetSheetName =
    workbook.SheetNames.find((s) => {
      const n = s.toLowerCase();
      return n.includes('customer') || n.includes('project') || n.includes('data') || n.includes('alpha');
    }) || workbook.SheetNames[0];

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error(`Sheet "${targetSheetName}" could not be read`);
  }

  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  if (!rawRows || rawRows.length === 0) {
    return {
      success: false,
      message: 'The uploaded Excel sheet contains no data rows',
      summary: {
        totalRows: 0,
        customersCreated: 0,
        customersUpdated: 0,
        projectsCreated: 0,
        projectsUpdated: 0,
        errorsCount: 0,
      },
      items: [],
      errors: [],
    };
  }

  // Pre-load active users (BDMs, Sales, Managers) for assigned employee matching
  const allUsers = await User.find({ isActive: true }).select('_id name phone email role').lean();

  const summary: ImportSummary = {
    totalRows: rawRows.length,
    customersCreated: 0,
    customersUpdated: 0,
    projectsCreated: 0,
    projectsUpdated: 0,
    errorsCount: 0,
  };

  const items: ImportedItem[] = [];
  const errors: ImportError[] = [];

  for (let rowIndex = 0; rowIndex < rawRows.length; rowIndex++) {
    const raw = rawRows[rowIndex];
    const rowNum = rowIndex + 2; // 1-based index + header row

    try {
      // Map row fields dynamically using normalized keys
      const rowMap: Record<string, any> = {};
      for (const key of Object.keys(raw)) {
        rowMap[normalizeKey(key)] = raw[key];
      }

      const getVal = (...aliases: string[]) => {
        for (const alias of aliases) {
          const norm = normalizeKey(alias);
          if (rowMap[norm] !== undefined && rowMap[norm] !== null && String(rowMap[norm]).trim() !== '') {
            return rowMap[norm];
          }
        }
        return '';
      };

      // Extract Customer Fields
      const rawCustomerName = getVal(
        'customername',
        'clientname',
        'fullname',
        'customer',
        'client',
        'name'
      );
      const rawPhone = getVal(
        'phonenumber',
        'phone',
        'mobilenumber',
        'mobile',
        'contactnumber',
        'contact',
        'tel'
      );
      const rawWhatsapp = getVal(
        'whatsappnumber',
        'whatsapp',
        'wanumber',
        'whatsappno',
        'wano'
      );
      const rawEmail = getVal('email', 'emailaddress', 'mail', 'e-mail');
      const rawAddress = getVal(
        'siteaddress',
        'address',
        'customeraddress',
        'deliveryaddress',
        'location',
        'street'
      );
      const rawCity = getVal('city', 'town', 'district');
      const rawState = getVal('state', 'province');
      const rawPincode = getVal('pincode', 'pin', 'postalcode', 'zip', 'zipcode');
      const rawCustomerType = getVal('customertype', 'clienttype', 'type');
      const rawLeadSource = getVal('leadsource', 'source', 'reference');
      const rawCustomerCode = getVal('customercode', 'customerid', 'custid', 'custcode');

      // Extract Project Fields
      const rawProjectName = getVal('projectname', 'project', 'sitename', 'title');
      const rawProjectCode = getVal('projectcode', 'projectid', 'alpid', 'alpcode');
      const rawLiftModel = getVal('liftmodel', 'elevatormodel', 'model');
      const rawLiftType = getVal('lifttype', 'elevatortype', 'type');
      const rawFloors = getVal('numberoffloors', 'floors', 'stops', 'levels', 'noofstops');
      const rawShaftModel = getVal('shaftmodel', 'shafttype', 'shaft');
      const rawOrderValue = getVal('ordervalue', 'totalamount', 'totalvalue', 'amount', 'price', 'totalprice');
      const rawAdvanceAmount = getVal('advanceamount', 'advancepaid', 'paidamount', 'advance', 'initialpayment');
      const rawAdvancePct = getVal('advancepercentage', 'advancepercent', 'advancepct', 'adv%');
      const rawCurrentStage = getVal('currentstage', 'stage', 'status', 'projectstatus', 'milestone');
      const rawExecutive = getVal(
        'assignedexecutive',
        'assignedemployee',
        'salesexecutive',
        'projectexecutive',
        'bdm',
        'executive',
        'employee'
      );
      const rawDeliveryDate = getVal('expecteddeliverydate', 'deliverydate', 'targetdate', 'estdelivery');
      const rawOrderDate = getVal('orderDate', 'bookingdate', 'date');
      const rawTracking = getVal('trackingnumber', 'lrnumber', 'vrllrnumber', 'tracking', 'lrno', 'vrlno');
      const rawNotes = getVal('notes', 'remarks', 'comments', 'description');
      const rawWhatsappGroup = getVal('whatsappgroupid', 'groupid', 'wagroup', 'group');

      // Check if row has meaningful data
      const hasCustomerData = Boolean(rawCustomerName || rawPhone || rawEmail);
      const hasProjectData = Boolean(rawProjectName || rawLiftModel || rawOrderValue || rawProjectCode);

      if (!hasCustomerData && !hasProjectData) {
        // Empty row, silently skip
        continue;
      }

      // Format customer name & project name
      const customerName = String(rawCustomerName || rawProjectName || 'Valued Customer').trim();
      const phone = normalizePhone(rawPhone);
      const whatsapp = normalizePhone(rawWhatsapp) || phone;
      const email = String(rawEmail || '').trim().toLowerCase();
      const city = String(rawCity || 'Bengaluru').trim();
      const state = String(rawState || 'Karnataka').trim();
      const pincode = String(rawPincode || '').trim();
      const address = String(rawAddress || `${city}, ${state}`).trim();

      // Find matching user for BDM / Assigned Employee
      let matchedUser: any = null;
      if (rawExecutive) {
        const execClean = normalizeKey(rawExecutive);
        matchedUser = allUsers.find((u) => {
          const uClean = normalizeKey(u.name);
          return uClean.includes(execClean) || execClean.includes(uClean);
        });
      }

      // 1. Resolve or Create Customer
      let customer: any = null;
      let isNewCustomer = false;

      // Match by provided Customer ID
      if (rawCustomerCode) {
        customer = await Customer.findOne({ customerId: String(rawCustomerCode).trim().toUpperCase() });
      }

      // Match by Phone
      if (!customer && phone && phone.length >= 8) {
        customer = await Customer.findOne({
          $or: [
            { phoneNumber: new RegExp(phone.slice(-10) + '$') },
            { whatsappNumber: new RegExp(phone.slice(-10) + '$') },
          ],
        });
      }

      // Match by Email
      if (!customer && email) {
        customer = await Customer.findOne({ email });
      }

      // Match by Full Name
      if (!customer && customerName && customerName !== 'Valued Customer') {
        customer = await Customer.findOne({
          fullName: new RegExp(`^${customerName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
      }

      if (customer) {
        // Existing customer: update missing details
        let changed = false;
        if (!customer.phoneNumber && phone) {
          customer.phoneNumber = phone;
          changed = true;
        }
        if (!customer.whatsappNumber && whatsapp) {
          customer.whatsappNumber = whatsapp;
          changed = true;
        }
        if (!customer.email && email) {
          customer.email = email;
          changed = true;
        }
        if ((!customer.address || customer.address === 'Bengaluru, Karnataka') && address) {
          customer.address = address;
          changed = true;
        }
        if (matchedUser && !customer.bdmId) {
          customer.bdmId = matchedUser._id;
          customer.bdmPhone = matchedUser.phone;
          customer.assignedEmployee = matchedUser.name;
          changed = true;
        }
        if (changed) {
          await customer.save();
          summary.customersUpdated++;
        }
      } else {
        // Create new Customer
        const newCustomerId = await getNextCustomerId();
        customer = await Customer.create({
          customerId: newCustomerId,
          fullName: customerName,
          phoneNumber: phone || '9999999999',
          whatsappNumber: whatsapp || phone || '9999999999',
          email: email || undefined,
          address: address || 'Site Address',
          city: city || 'Bengaluru',
          state: state || 'Karnataka',
          pincode: pincode || '',
          customerType: rawCustomerType || 'Residential',
          leadSource: rawLeadSource || 'Excel Import',
          assignedEmployee: matchedUser?.name || rawExecutive || currentUser?.name || 'CRM Team',
          bdmId: matchedUser?._id,
          bdmPhone: matchedUser?.phone,
          whatsappOptIn: true,
          notes: rawNotes ? `Imported from Excel: ${rawNotes}` : 'Imported from Excel spreadsheet',
        });
        isNewCustomer = true;
        summary.customersCreated++;
      }

      // 2. Resolve or Create Project
      let project: any = null;
      let isNewProject = false;
      const projectName = String(rawProjectName || `${customer.fullName} Residence`).trim();
      const siteAddress = String(rawAddress || customer.address || `${city}, ${state}`).trim();
      const liftModel = resolveLiftModel(rawLiftModel);
      const liftType = String(rawLiftType || 'Home Lift').trim();
      const numberOfFloors = String(rawFloors || 'G+1').trim();
      const shaftModel = resolveShaftModel(rawShaftModel);

      // Numeric values
      const orderValue = rawOrderValue ? Math.max(0, Number(String(rawOrderValue).replace(/[^\d.]/g, '')) || 0) : 1000000;
      let advanceAmount = 0;
      let advancePercentage = 30;

      if (rawAdvanceAmount) {
        advanceAmount = Math.max(0, Number(String(rawAdvanceAmount).replace(/[^\d.]/g, '')) || 0);
        advancePercentage = orderValue > 0 ? Math.round((advanceAmount / orderValue) * 100) : 30;
      } else if (rawAdvancePct) {
        advancePercentage = Math.max(0, Number(String(rawAdvancePct).replace(/[^\d.]/g, '')) || 30);
        advanceAmount = Math.round((orderValue * advancePercentage) / 100);
      } else {
        advanceAmount = Math.round((orderValue * 30) / 100);
      }

      const totalPaid = advanceAmount;
      const balanceAmount = Math.max(0, orderValue - totalPaid);
      let paymentStatus: any = 'PENDING';
      if (totalPaid >= orderValue && orderValue > 0) {
        paymentStatus = 'FULLY_PAID';
      } else if (totalPaid > 0) {
        paymentStatus = totalPaid >= advanceAmount ? 'ADVANCE_PAID' : 'PARTIAL_PAID';
      }

      const projectStatus = resolveProjectStage(rawCurrentStage);
      const parsedDeliveryDate = parseExcelDate(rawDeliveryDate);
      const parsedOrderDate = parseExcelDate(rawOrderDate) || new Date();

      // Check if project exists
      if (rawProjectCode) {
        project = await Project.findOne({ projectId: String(rawProjectCode).trim().toUpperCase() });
      }

      if (!project && customer) {
        project = await Project.findOne({
          customerId: customer._id,
          projectName: new RegExp(`^${projectName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'),
        });
      }

      if (project) {
        // Update existing project
        project.liftModel = liftModel;
        project.liftType = liftType;
        project.shaftModel = shaftModel;
        project.numberOfFloors = numberOfFloors;
        if (orderValue > 0) project.orderValue = orderValue;
        if (advanceAmount > 0) project.advanceAmount = advanceAmount;
        if (rawCurrentStage) project.projectStatus = projectStatus;
        if (rawTracking) {
          project.vrlLrNumber = rawTracking;
          project.trackingNumber = rawTracking;
        }
        if (parsedDeliveryDate) project.expectedDeliveryDate = parsedDeliveryDate;
        if (rawNotes) project.notes = rawNotes;
        await project.save();
        summary.projectsUpdated++;
      } else {
        // Create new Project
        const newProjectId = await getNextProjectId();
        const nextUpdate = calculateNextUpdateDate(20, new Date());

        project = await Project.create({
          projectId: newProjectId,
          customerId: customer._id,
          customerCode: customer.customerId,
          projectName,
          siteAddress,
          liftModel,
          liftType,
          numberOfFloors,
          shaftModel,
          liftAmount: orderValue,
          shaftAmount: 0,
          orderValue,
          advancePercentage,
          productionPaymentPercent: 40,
          readinessNotificationPercent: 30,
          dispatchMaterialsPercent: 0,
          afterInstallationPercent: 0,
          advanceAmount,
          totalPaid,
          balanceAmount,
          paymentStatus,
          orderDate: parsedOrderDate,
          expectedDeliveryDate:
            parsedDeliveryDate ||
            (() => {
              const d = new Date(parsedOrderDate);
              d.setDate(d.getDate() + 120);
              return d;
            })(),
          projectStatus,
          assignedEmployee: matchedUser?.name || rawExecutive || customer.assignedEmployee || currentUser?.name || 'CRM Team',
          bdmId: customer.bdmId || matchedUser?._id,
          bdmPhone: customer.bdmPhone || matchedUser?.phone,
          vrlLrNumber: rawTracking || undefined,
          trackingNumber: rawTracking || undefined,
          whatsappGroupId: rawWhatsappGroup ? String(rawWhatsappGroup).trim() : undefined,
          whatsappGroupName: rawWhatsappGroup ? `${projectName} — Alpha Updates` : undefined,
          automationEnabled: true,
          updateFrequencyDays: 20,
          nextUpdateAt: nextUpdate,
          notes: rawNotes ? `Excel Import: ${rawNotes}` : 'Imported from Excel spreadsheet',
        });

        isNewProject = true;
        summary.projectsCreated++;

        // Activity log
        await logProjectActivity({
          projectId: project._id,
          projectCode: newProjectId,
          type: 'STATUS_CHANGE',
          description: `Project created via Excel bulk import. Initial status: ${projectStatus}, Order Value: ₹${orderValue.toLocaleString('en-IN')}`,
          userId: currentUser?._id,
          userName: currentUser?.name || 'Excel Importer',
        });
      }

      items.push({
        rowNumber: rowNum,
        customerCode: customer.customerId,
        customerName: customer.fullName,
        phone: customer.phoneNumber,
        projectCode: project?.projectId,
        projectName: project?.projectName,
        stage: project?.projectStatus,
        orderValue: project?.orderValue,
        isNewCustomer,
        isNewProject,
      });
    } catch (rowErr: any) {
      summary.errorsCount++;
      errors.push({
        rowNumber: rowNum,
        customerName: raw['Customer Name'] || raw['Customer'] || raw['Name'] || 'Unknown',
        projectName: raw['Project Name'] || raw['Project'] || 'Unknown',
        reason: rowErr.message || 'Row processing failure',
      });
    }
  }

  return {
    success: true,
    message: `Excel import processed ${summary.totalRows} row(s). Customers: +${summary.customersCreated} new, ~${summary.customersUpdated} updated. Projects: +${summary.projectsCreated} new, ~${summary.projectsUpdated} updated.`,
    summary,
    items,
    errors,
  };
}

/**
 * Generates an Excel Template workbook buffer with sample rows and guidance
 */
export function generateImportTemplateBuffer(): Buffer {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Data Import
  const templateHeaders = [
    'Customer Name *',
    'Phone Number *',
    'WhatsApp Number',
    'Email',
    'Site Address *',
    'City',
    'State',
    'Pincode',
    'Customer Type',
    'Project Name *',
    'Lift Model',
    'Lift Type',
    'Number of Floors',
    'Shaft Model',
    'Order Value (INR) *',
    'Advance Amount (INR)',
    'Advance %',
    'Current Stage',
    'Assigned Executive',
    'Expected Delivery Date (DD/MM/YYYY)',
    'VRL LR Tracking Number',
    'Notes',
  ];

  const sampleRows = [
    [
      'Rajesh Kumar',
      '9876543210',
      '9876543210',
      'rajesh.kumar@gmail.com',
      '#42, 100 Feet Road, Indiranagar',
      'Bengaluru',
      'Karnataka',
      '560038',
      'Residential',
      'Kumar Residence',
      'AE 01 Home Series',
      'Home Lift',
      'G+2',
      'Civil Shaft',
      1250000,
      375000,
      30,
      'Site Visit',
      'Srinivasan (TL)',
      '15/04/2026',
      '',
      'Hydraulic Home Elevator for private villa',
    ],
    [
      'Priya Sharma',
      '9845123456',
      '9845123456',
      'priya.sharma@outlook.com',
      'Villa 18, Palm Meadows, Whitefield',
      'Bengaluru',
      'Karnataka',
      '560066',
      'Villa',
      'Sharma Villa',
      'Alpha EV',
      'Villa Elevator',
      'G+1',
      'ACP Shaft',
      1400000,
      420000,
      30,
      'Advance Payment Received',
      'Sundaram',
      '20/05/2026',
      '',
      '3 passenger panoramic cabin finish',
    ],
    [
      'Venkat Raman',
      '9900112233',
      '9900112233',
      'venkat@ramangroup.in',
      'No. 88, Anna Nagar West',
      'Chennai',
      'Tamil Nadu',
      '600040',
      'Commercial',
      'Raman Commercial Center',
      'AE 02 Gearless Rope Home Series',
      'Commercial',
      'G+4',
      'Glass Shaft',
      2200000,
      660000,
      30,
      'Material in transit',
      'Bala',
      '10/03/2026',
      'VRL-BLR-884920',
      '6 passenger MRL gearless lift',
    ],
  ];

  const wsData = [templateHeaders, ...sampleRows];
  const ws1 = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths
  ws1['!cols'] = [
    { wch: 20 }, // Customer Name
    { wch: 15 }, // Phone Number
    { wch: 16 }, // WhatsApp Number
    { wch: 24 }, // Email
    { wch: 32 }, // Site Address
    { wch: 14 }, // City
    { wch: 14 }, // State
    { wch: 10 }, // Pincode
    { wch: 15 }, // Customer Type
    { wch: 24 }, // Project Name
    { wch: 24 }, // Lift Model
    { wch: 16 }, // Lift Type
    { wch: 16 }, // Number of Floors
    { wch: 16 }, // Shaft Model
    { wch: 18 }, // Order Value
    { wch: 20 }, // Advance Amount
    { wch: 12 }, // Advance %
    { wch: 22 }, // Current Stage
    { wch: 20 }, // Assigned Executive
    { wch: 26 }, // Expected Delivery Date
    { wch: 22 }, // VRL Tracking
    { wch: 35 }, // Notes
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Data Import');

  // Sheet 2: Guidelines & Allowed Values
  const guideData = [
    ['Alpha CRM Excel Import Reference Guide', ''],
    ['Field Name', 'Description & Allowed Values'],
    ['Customer Name *', 'Full name of customer or primary contact person (Mandatory).'],
    ['Phone Number *', '10-digit mobile number for contact (Mandatory).'],
    ['WhatsApp Number', '10-digit mobile number for automated WhatsApp updates (Defaults to Phone Number).'],
    ['Email', 'Customer email address (Optional).'],
    ['Site Address *', 'Installation physical site address or location (Mandatory).'],
    ['City / State / Pincode', 'City, State and Pincode of the project location.'],
    ['Customer Type', 'Residential | Villa | Commercial | Builder (Default: Residential)'],
    ['Project Name *', 'Name for the elevator project (e.g. "Kumar Residence"). Defaults to Customer Name Residence.'],
    ['Lift Model', 'AE 01 Home Series | AE 02 Gearless Rope Home Series | AE 03 Gearless Belt Home series | Alpha EV | Alpha Premier | Alpha Luxe | Hydraulic Home Series'],
    ['Lift Type', 'Home Lift | Villa Elevator | Glass Panoramic | Commercial | Dumbwaiter'],
    ['Number of Floors', 'e.g. G+1, G+2, G+3, 2 Stops, 3 Stops'],
    ['Shaft Model', 'Civil Shaft | ACP Shaft | Glass Shaft | MS Structure (Default: Civil Shaft)'],
    ['Order Value (INR) *', 'Total elevator order value in INR without commas (e.g. 1250000).'],
    ['Advance Amount (INR)', 'Initial advance payment amount received (e.g. 375000). If left blank, calculated from Advance %.'],
    ['Advance %', 'Advance percentage (Default: 30%).'],
    ['Current Stage', 'One of the standard stages:\n• Advance Payment Received\n• Site Visit\n• Drawing and Cabin\n• Drawing and Cabin Design Approval\n• Production Payment\n• Production in progress\n• Readiness Payment\n• Material ready to Dispatch\n• Material in transit\n• Pre Site Visit\n• Material Delivered\n• Installation in Progress\n• Handover - Payment Pending\n• Project Completed'],
    ['Assigned Executive', 'Name of BDM / Sales Executive / Technical Lead (e.g. Srinivasan, Sundaram, Bala, etc.).'],
    ['Expected Delivery Date', 'Target delivery date in DD/MM/YYYY format.'],
    ['VRL LR Tracking Number', 'VRL or courier tracking LR number for materials.'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(guideData);
  ws2['!cols'] = [{ wch: 28 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Reference Guide');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
