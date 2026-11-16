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
 * Parses boolean representation from Excel
 */
function parseExcelBoolean(val: any, defaultVal = true): boolean {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'boolean') return val;
  const str = String(val).trim().toLowerCase();
  if (['yes', 'true', '1', 'y', 'enabled'].includes(str)) return true;
  if (['no', 'false', '0', 'n', 'disabled'].includes(str)) return false;
  return defaultVal;
}

/**
 * Parses numeric currency / percentage value safely from Excel
 */
function parseExcelNumber(val: any, defaultVal = 0): number {
  if (val === undefined || val === null || val === '') return defaultVal;
  if (typeof val === 'number') return isNaN(val) ? defaultVal : val;
  const clean = String(val).replace(/[^0-9.-]/g, '');
  const num = parseFloat(clean);
  return isNaN(num) ? defaultVal : num;
}

/**
 * Resolves PaymentStatus from raw string or calculated financial figures
 */
function resolvePaymentStatus(
  rawStatus: any,
  totalPaid: number,
  advanceAmount: number,
  orderValue: number
): 'PENDING' | 'ADVANCE_PAID' | 'PARTIAL_PAID' | 'FULLY_PAID' {
  if (rawStatus) {
    const clean = normalizeKey(rawStatus);
    if (clean.includes('fully') || clean.includes('full') || clean.includes('complete')) return 'FULLY_PAID';
    if (clean.includes('advance')) return 'ADVANCE_PAID';
    if (clean.includes('partial') || clean.includes('part')) return 'PARTIAL_PAID';
    if (clean.includes('pending') || clean.includes('due') || clean.includes('unpaid')) return 'PENDING';
  }
  if (totalPaid >= orderValue && orderValue > 0) return 'FULLY_PAID';
  if (totalPaid >= advanceAmount && advanceAmount > 0) return 'ADVANCE_PAID';
  if (totalPaid > 0) return 'PARTIAL_PAID';
  return 'PENDING';
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
      const rawCustomerCode = getVal('customercode', 'customerid', 'custid', 'custcode');
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
      const rawDoorNo = getVal('doorno', 'door', 'flatno', 'houseno');
      const rawStreetName = getVal('streetname', 'street', 'road');
      const rawLandmark = getVal('landmark', 'near');
      const rawCustomerAddress = getVal('customeraddress', 'custaddress', 'clientaddress');
      const rawSiteAddress = getVal(
        'siteaddress',
        'address',
        'deliveryaddress',
        'installationaddress',
        'location',
        'street'
      );
      const rawCustomerMapsLink = getVal('customergooglemapslink', 'customergooglemaps', 'customermapslink', 'customermaps');
      const rawSiteMapsLink = getVal('sitegooglemapslink', 'sitegooglemaps', 'googlemapslink', 'googlemaps', 'mapslink', 'maps');
      const rawCity = getVal('city', 'town', 'district');
      const rawState = getVal('state', 'province');
      const rawPincode = getVal('pincode', 'pin', 'postalcode', 'zip', 'zipcode');
      const rawCustomerType = getVal('customertype', 'clienttype', 'type');
      const rawLeadSource = getVal('leadsource', 'source', 'reference');
      const rawWhatsappOptIn = getVal('whatsappoptin', 'optin', 'waoptin');
      const rawOptInDate = getVal('whatsappoptindate', 'optindate');
      const rawOptInSource = getVal('whatsappoptinsource', 'optinsource');
      const rawIsOldCustomer = getVal('oldcustomer', 'isoldcustomer', 'existingcustomer');
      const rawCustomerNotes = getVal('customernotes', 'customernote', 'clientnotes');
      const rawCustomerAssignedEmp = getVal('customerassignedemployee', 'customerassigned');
      const rawBdmPhone = getVal('bdmphone', 'bdmcontact', 'bdmmobile');

      // Extract Project Fields
      const rawProjectName = getVal('projectname', 'project', 'sitename', 'title');
      const rawProjectCode = getVal('projectcode', 'projectid', 'alpid', 'alpcode');
      const rawLiftModel = getVal('liftmodel', 'elevatormodel', 'model');
      const rawLiftType = getVal('lifttype', 'elevatortype');
      const rawFloors = getVal('numberoffloors', 'floors', 'stops', 'levels', 'noofstops');
      const rawShaftModel = getVal('shaftmodel', 'shafttype', 'shaft');
      const rawDrawingUrl = getVal('drawingurl', 'drawinglink', 'drawing');
      const rawOrderValue = getVal('ordervalue', 'ordervalueinr', 'totalamount', 'totalvalue', 'amount', 'price', 'totalprice');
      const rawLiftAmount = getVal('liftamount', 'liftamountinr', 'liftprice');
      const rawLiftBaseAmount = getVal('liftbaseamount', 'liftbaseamountinr', 'liftbase');
      const rawLiftDiscountAmount = getVal('liftdiscountamount', 'liftdiscountamountinr', 'liftdiscount');
      const rawShaftAmount = getVal('shaftamount', 'shaftamountinr', 'shaftprice');
      const rawShaftBaseAmount = getVal('shaftbaseamount', 'shaftbaseamountinr', 'shaftbase');
      const rawShaftDiscountAmount = getVal('shaftdiscountamount', 'shaftdiscountamountinr', 'shaftdiscount');
      const rawAdvanceAmount = getVal('advanceamount', 'advanceamountinr', 'advancepaid', 'paidamount', 'advance', 'initialpayment');
      const rawAdvancePct = getVal('advancepercentage', 'advancepercent', 'advancepct', 'adv%');
      const rawTotalPaid = getVal('totalpaid', 'totalpaidinr', 'paidtotal');
      const rawBalanceAmount = getVal('balanceamount', 'balanceamountinr', 'balance', 'dueamount');
      const rawPaymentStatus = getVal('paymentstatus', 'paystatus');
      const rawProductionPercent = getVal('productionpaymentpercent', 'productionpayment', 'productionpercent', 'production%');
      const rawReadinessPercent = getVal('readinessnotificationpercent', 'readinesspaymentpercent', 'readinessnotification', 'readiness%');
      const rawDispatchPercent = getVal('dispatchmaterialspercent', 'dispatchmaterials', 'dispatchpercent', 'dispatch%');
      const rawAfterInstallPercent = getVal('afterinstallationpercent', 'afterinstallation', 'afterinstallpercent', 'afterinstall%');
      const rawCurrentStage = getVal('currentstage', 'stage', 'status', 'projectstatus', 'milestone');
      const rawOrderDate = getVal('orderdate', 'bookingdate', 'contractdate', 'date');
      const rawDeliveryDate = getVal('expecteddeliverydate', 'deliverydate', 'targetdate', 'estdelivery');
      const rawActualDeliveryDate = getVal('actualdeliverydate', 'delivereddate');
      const rawInstallationDate = getVal('installationdate', 'installdate');
      const rawExecutive = getVal(
        'assignedexecutive',
        'assignedemployee',
        'salesexecutive',
        'projectexecutive',
        'bdm',
        'executive',
        'employee'
      );
      const rawProjectManager = getVal('projectmanager', 'pm');
      const rawProjectExecutive = getVal('projectexecutive', 'pe');
      const rawAssignedTl = getVal('assignedtl', 'tl', 'teamlead', 'assignedteamlead');
      const rawTracking = getVal('trackingnumber', 'lrnumber', 'vrllrnumber', 'vrllrtrackingnumber', 'tracking', 'lrno', 'vrlno');
      const rawWhatsappGroup = getVal('whatsappgroupid', 'groupid', 'wagroup', 'group');
      const rawWhatsappGroupName = getVal('whatsappgroupname', 'groupname', 'wagroupname');
      const rawAutomationEnabled = getVal('whatsappautomationenabled', 'automationenabled', 'automation');
      const rawUpdateFreq = getVal('updatefrequencydays', 'updatefrequency', 'frequencydays', 'frequency');
      const rawProductionStage = getVal('productionstage');
      const rawProductionTimelineDays = getVal('productiontimelinedays', 'productiontimeline');
      const rawProjectNotes = getVal('projectnotes', 'projectnote');
      const rawNotes = getVal('notes', 'remarks', 'comments', 'description');

      // Check if row has meaningful data
      const hasCustomerData = Boolean(rawCustomerName || rawPhone || rawEmail || rawCustomerCode);
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
      const city = String(rawCity || 'Chennai').trim();
      const state = String(rawState || 'Tamil Nadu').trim();
      const pincode = String(rawPincode || '').trim();
      const doorNo = String(rawDoorNo || '').trim();
      const streetName = String(rawStreetName || '').trim();
      const landmark = String(rawLandmark || '').trim();

      const addressFallback = [doorNo, streetName, landmark].filter(Boolean).join(', ') || `${city}, ${state}`;
      const customerAddress = String(rawCustomerAddress || rawSiteAddress || addressFallback).trim();
      const siteAddress = String(rawSiteAddress || rawCustomerAddress || addressFallback).trim();

      const customerMapsLink = String(
        rawCustomerMapsLink ||
        (customerAddress.startsWith('http') || customerAddress.includes('maps') ? customerAddress : '')
      ).trim();

      const siteMapsLink = String(
        rawSiteMapsLink ||
        rawCustomerMapsLink ||
        (siteAddress.startsWith('http') || siteAddress.includes('maps') ? siteAddress : '')
      ).trim();

      // Find matching user for BDM / Assigned Employee
      let matchedUser: any = null;
      const execToMatch = rawExecutive || rawCustomerAssignedEmp || rawProjectExecutive;
      if (execToMatch) {
        const execClean = normalizeKey(execToMatch);
        matchedUser = allUsers.find((u) => {
          const uClean = normalizeKey(u.name);
          return uClean.includes(execClean) || execClean.includes(uClean);
        });
      }

      // Resolve Assigned TL (Srinivasan, Sundaram, Bala)
      let resolvedAssignedTl: string | undefined = undefined;
      let resolvedAssignedTlId: any = undefined;
      if (rawAssignedTl) {
        const tlStr = String(rawAssignedTl).trim();
        if (/srinivasan/i.test(tlStr)) {
          resolvedAssignedTl = 'Srinivasan (TL)';
        } else if (/sundaram/i.test(tlStr)) {
          resolvedAssignedTl = 'Sundaram';
        } else if (/bala/i.test(tlStr)) {
          resolvedAssignedTl = 'Bala';
        } else {
          resolvedAssignedTl = tlStr;
        }

        const tlUser = allUsers.find((u) => {
          if (resolvedAssignedTl && (u.role === 'LOGISTICS_TL' || u.role === 'TECHNICAL_LEAD')) {
            const uClean = normalizeKey(u.name);
            const tlClean = normalizeKey(resolvedAssignedTl);
            return uClean.includes(tlClean) || tlClean.includes(uClean);
          }
          return false;
        });
        if (tlUser) {
          resolvedAssignedTlId = tlUser._id;
          resolvedAssignedTl = tlUser.name;
        }
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

      const parsedOptIn = rawWhatsappOptIn !== '' ? parseExcelBoolean(rawWhatsappOptIn, true) : true;
      const parsedIsOld = rawIsOldCustomer !== '' ? parseExcelBoolean(rawIsOldCustomer, false) : false;
      const parsedOptInDate = parseExcelDate(rawOptInDate) || new Date();
      const customerNotes = rawCustomerNotes || (rawNotes ? `Imported from Excel: ${rawNotes}` : 'Imported from Excel spreadsheet');

      if (customer) {
        // Existing customer: update missing or modified details
        let changed = false;
        if (!customer.phoneNumber && phone) { customer.phoneNumber = phone; changed = true; }
        if (!customer.whatsappNumber && whatsapp) { customer.whatsappNumber = whatsapp; changed = true; }
        if (!customer.email && email) { customer.email = email; changed = true; }
        if (doorNo && !customer.doorNo) { customer.doorNo = doorNo; changed = true; }
        if (streetName && !customer.streetName) { customer.streetName = streetName; changed = true; }
        if (landmark && !customer.landmark) { customer.landmark = landmark; changed = true; }
        if (customerAddress && (!customer.address || customer.address === 'Bengaluru, Karnataka' || customer.address === 'Chennai, Tamil Nadu' || customer.address === 'Site Address')) {
          customer.address = customerAddress;
          changed = true;
        }
        if (customerMapsLink && !customer.googleMapsLink) { customer.googleMapsLink = customerMapsLink; changed = true; }
        if (city && (!customer.city || customer.city === 'Bengaluru' || customer.city === 'Mumbai')) { customer.city = city; changed = true; }
        if (state && (!customer.state || customer.state === 'Karnataka' || customer.state === 'Maharashtra')) { customer.state = state; changed = true; }
        if (pincode && !customer.pincode) { customer.pincode = pincode; changed = true; }
        if (rawCustomerType && customer.customerType !== rawCustomerType) { customer.customerType = rawCustomerType; changed = true; }
        if (rawLeadSource && (!customer.leadSource || customer.leadSource === 'Referral')) { customer.leadSource = rawLeadSource; changed = true; }
        if (rawIsOldCustomer !== '') {
          if (customer.isOldCustomer !== parsedIsOld) { customer.isOldCustomer = parsedIsOld; changed = true; }
        }
        if (rawWhatsappOptIn !== '') {
          if (customer.whatsappOptIn !== parsedOptIn) { customer.whatsappOptIn = parsedOptIn; changed = true; }
        }
        if (matchedUser && !customer.bdmId) {
          customer.bdmId = matchedUser._id;
          customer.bdmPhone = matchedUser.phone;
          customer.assignedEmployee = matchedUser.name;
          changed = true;
        } else if (rawCustomerAssignedEmp && !customer.assignedEmployee) {
          customer.assignedEmployee = rawCustomerAssignedEmp;
          changed = true;
        }
        if (rawBdmPhone && !customer.bdmPhone) { customer.bdmPhone = rawBdmPhone; changed = true; }
        if (resolvedAssignedTl && !customer.assignedTl) {
          customer.assignedTl = resolvedAssignedTl;
          customer.assignedTlId = resolvedAssignedTlId;
          changed = true;
        }
        if (rawCustomerNotes && (!customer.notes || customer.notes === 'Imported from Excel spreadsheet')) {
          customer.notes = rawCustomerNotes;
          changed = true;
        }
        if (changed) {
          await customer.save();
          summary.customersUpdated++;
        }
      } else {
        // Create new Customer
        const newCustomerId = rawCustomerCode ? String(rawCustomerCode).trim().toUpperCase() : await getNextCustomerId();
        customer = await Customer.create({
          customerId: newCustomerId,
          fullName: customerName,
          phoneNumber: phone || '9999999999',
          whatsappNumber: whatsapp || phone || '9999999999',
          email: email || undefined,
          doorNo: doorNo || undefined,
          streetName: streetName || undefined,
          landmark: landmark || undefined,
          address: customerAddress || siteAddress || 'Site Address',
          googleMapsLink: customerMapsLink || undefined,
          city: city || 'Chennai',
          state: state || 'Tamil Nadu',
          pincode: pincode || '',
          customerType: rawCustomerType || 'Residential',
          leadSource: rawLeadSource || 'Excel Import',
          assignedEmployee: rawCustomerAssignedEmp || matchedUser?.name || rawExecutive || currentUser?.name || 'CRM Team',
          bdmId: matchedUser?._id,
          bdmPhone: rawBdmPhone || matchedUser?.phone,
          whatsappOptIn: parsedOptIn,
          optInDate: parsedOptInDate,
          optInSource: rawOptInSource || 'EXCEL_IMPORT',
          notes: customerNotes,
          isOldCustomer: parsedIsOld,
          assignedTl: resolvedAssignedTl || undefined,
          assignedTlId: resolvedAssignedTlId || undefined,
        });
        isNewCustomer = true;
        summary.customersCreated++;
      }

      // 2. Resolve or Create Project
      let project: any = null;
      let isNewProject = false;
      const projectName = String(rawProjectName || `${customer.fullName} Residence`).trim();
      const liftModel = resolveLiftModel(rawLiftModel);
      const liftType = String(rawLiftType || 'Home Lift').trim();
      const numberOfFloors = String(rawFloors || 'G+1').trim();
      const shaftModel = resolveShaftModel(rawShaftModel);

      // Financial figures
      const parsedLiftAmount = rawLiftAmount !== '' ? parseExcelNumber(rawLiftAmount, 0) : 0;
      const parsedShaftAmount = rawShaftAmount !== '' ? parseExcelNumber(rawShaftAmount, 0) : 0;
      const parsedLiftBaseAmount = rawLiftBaseAmount !== '' ? parseExcelNumber(rawLiftBaseAmount, 0) : undefined;
      const parsedLiftDiscountAmount = rawLiftDiscountAmount !== '' ? parseExcelNumber(rawLiftDiscountAmount, 0) : undefined;
      const parsedShaftBaseAmount = rawShaftBaseAmount !== '' ? parseExcelNumber(rawShaftBaseAmount, 0) : undefined;
      const parsedShaftDiscountAmount = rawShaftDiscountAmount !== '' ? parseExcelNumber(rawShaftDiscountAmount, 0) : undefined;

      let orderValue = rawOrderValue !== '' ? parseExcelNumber(rawOrderValue, 0) : 0;
      if (orderValue <= 0) {
        orderValue = parsedLiftAmount + (shaftModel === 'Customer Scope' ? 0 : parsedShaftAmount);
      }
      if (orderValue <= 0) {
        orderValue = 1000000;
      }

      const liftAmount = parsedLiftAmount > 0 ? parsedLiftAmount : (parsedShaftAmount > 0 ? Math.max(0, orderValue - parsedShaftAmount) : orderValue);
      const shaftAmount = parsedShaftAmount > 0 ? parsedShaftAmount : Math.max(0, orderValue - liftAmount);

      let advanceAmount = 0;
      let advancePercentage = 30;

      if (rawAdvanceAmount !== '') {
        advanceAmount = parseExcelNumber(rawAdvanceAmount, 0);
        advancePercentage = orderValue > 0 ? Math.round((advanceAmount / orderValue) * 100) : 30;
      } else if (rawAdvancePct !== '') {
        advancePercentage = parseExcelNumber(rawAdvancePct, 30);
        advanceAmount = Math.round((orderValue * advancePercentage) / 100);
      } else {
        advancePercentage = 30;
        advanceAmount = Math.round((orderValue * 30) / 100);
      }

      const totalPaid = rawTotalPaid !== '' ? parseExcelNumber(rawTotalPaid, advanceAmount) : advanceAmount;
      const balanceAmount = rawBalanceAmount !== '' ? parseExcelNumber(rawBalanceAmount, Math.max(0, orderValue - totalPaid)) : Math.max(0, orderValue - totalPaid);
      const paymentStatus = resolvePaymentStatus(rawPaymentStatus, totalPaid, advanceAmount, orderValue);

      const productionPaymentPercent = rawProductionPercent !== '' ? parseExcelNumber(rawProductionPercent, 40) : 40;
      const readinessNotificationPercent = rawReadinessPercent !== '' ? parseExcelNumber(rawReadinessPercent, 30) : 30;
      const dispatchMaterialsPercent = rawDispatchPercent !== '' ? parseExcelNumber(rawDispatchPercent, 0) : 0;
      const afterInstallationPercent = rawAfterInstallPercent !== '' ? parseExcelNumber(rawAfterInstallPercent, 0) : 0;

      const projectStatus = resolveProjectStage(rawCurrentStage);
      const parsedOrderDate = parseExcelDate(rawOrderDate) || new Date();
      const parsedDeliveryDate = parseExcelDate(rawDeliveryDate);
      const parsedActualDeliveryDate = parseExcelDate(rawActualDeliveryDate);
      const parsedInstallationDate = parseExcelDate(rawInstallationDate);
      const projectNotes = rawProjectNotes || (rawNotes ? `Excel Import: ${rawNotes}` : 'Imported from Excel spreadsheet');

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
        if (orderValue > 0) project.orderValue = orderValue;
        if (liftAmount > 0) project.liftAmount = liftAmount;
        if (parsedLiftBaseAmount !== undefined) project.liftBaseAmount = parsedLiftBaseAmount;
        if (parsedLiftDiscountAmount !== undefined) project.liftDiscountAmount = parsedLiftDiscountAmount;
        if (shaftAmount >= 0 && rawShaftAmount !== '') project.shaftAmount = shaftAmount;
        if (parsedShaftBaseAmount !== undefined) project.shaftBaseAmount = parsedShaftBaseAmount;
        if (parsedShaftDiscountAmount !== undefined) project.shaftDiscountAmount = parsedShaftDiscountAmount;
        if (rawAdvanceAmount !== '') project.advanceAmount = advanceAmount;
        if (rawAdvancePct !== '') project.advancePercentage = advancePercentage;
        if (rawProductionPercent !== '') project.productionPaymentPercent = productionPaymentPercent;
        if (rawReadinessPercent !== '') project.readinessNotificationPercent = readinessNotificationPercent;
        if (rawDispatchPercent !== '') project.dispatchMaterialsPercent = dispatchMaterialsPercent;
        if (rawAfterInstallPercent !== '') project.afterInstallationPercent = afterInstallationPercent;
        if (rawTotalPaid !== '') project.totalPaid = totalPaid;
        if (rawBalanceAmount !== '') project.balanceAmount = balanceAmount;
        if (rawPaymentStatus !== '') project.paymentStatus = paymentStatus;
        if (rawLiftModel) project.liftModel = liftModel;
        if (rawLiftType) project.liftType = liftType;
        if (rawShaftModel) project.shaftModel = shaftModel;
        if (rawFloors) project.numberOfFloors = numberOfFloors;
        if (rawCurrentStage) project.projectStatus = projectStatus;
        if (siteAddress && (!project.siteAddress || project.siteAddress === 'Bengaluru, Karnataka' || project.siteAddress === 'Chennai, Tamil Nadu' || project.siteAddress === 'Site Address')) {
          project.siteAddress = siteAddress;
        }
        if (siteMapsLink && !project.googleMapsLink) project.googleMapsLink = siteMapsLink;
        if (rawDrawingUrl) project.drawingUrl = rawDrawingUrl;
        if (rawOrderDate && parsedOrderDate) project.orderDate = parsedOrderDate;
        if (parsedDeliveryDate) project.expectedDeliveryDate = parsedDeliveryDate;
        if (parsedActualDeliveryDate) project.actualDeliveryDate = parsedActualDeliveryDate;
        if (parsedInstallationDate) project.installationDate = parsedInstallationDate;
        if (rawExecutive) project.assignedEmployee = rawExecutive;
        if (rawProjectManager) project.projectManager = rawProjectManager;
        if (rawProjectExecutive) project.projectExecutive = rawProjectExecutive;
        if (resolvedAssignedTl) {
          project.assignedTl = resolvedAssignedTl;
          project.assignedTlId = resolvedAssignedTlId;
        } else if (customer.assignedTl && !project.assignedTl) {
          project.assignedTl = customer.assignedTl;
          project.assignedTlId = customer.assignedTlId;
        }
        if (rawTracking) {
          project.vrlLrNumber = rawTracking;
          project.trackingNumber = rawTracking;
        }
        if (rawWhatsappGroup) project.whatsappGroupId = String(rawWhatsappGroup).trim();
        if (rawWhatsappGroupName) project.whatsappGroupName = rawWhatsappGroupName;
        if (rawAutomationEnabled !== '') project.automationEnabled = parseExcelBoolean(rawAutomationEnabled, true);
        if (rawUpdateFreq !== '') project.updateFrequencyDays = parseExcelNumber(rawUpdateFreq, 20);
        if (rawProductionStage !== '') project.productionStage = parseExcelNumber(rawProductionStage, 1);
        if (rawProductionTimelineDays !== '') project.productionTimelineDays = parseExcelNumber(rawProductionTimelineDays, 0);
        if (projectNotes) project.notes = projectNotes;
        await project.save();
        summary.projectsUpdated++;
      } else {
        // Create new Project
        const newProjectId = rawProjectCode ? String(rawProjectCode).trim().toUpperCase() : await getNextProjectId();
        const nextUpdate = calculateNextUpdateDate(rawUpdateFreq ? parseExcelNumber(rawUpdateFreq, 20) : 20, new Date());

        project = await Project.create({
          projectId: newProjectId,
          customerId: customer._id,
          customerCode: customer.customerId,
          projectName,
          siteAddress,
          googleMapsLink: siteMapsLink || undefined,
          liftModel,
          liftType,
          numberOfFloors,
          shaftModel,
          liftAmount,
          liftBaseAmount: parsedLiftBaseAmount,
          liftDiscountAmount: parsedLiftDiscountAmount,
          shaftAmount,
          shaftBaseAmount: parsedShaftBaseAmount,
          shaftDiscountAmount: parsedShaftDiscountAmount,
          orderValue,
          advancePercentage,
          advanceAmount,
          productionPaymentPercent,
          readinessNotificationPercent,
          dispatchMaterialsPercent,
          afterInstallationPercent,
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
          actualDeliveryDate: parsedActualDeliveryDate,
          installationDate: parsedInstallationDate,
          projectStatus,
          assignedEmployee: rawExecutive || customer.assignedEmployee || matchedUser?.name || currentUser?.name || 'CRM Team',
          projectManager: rawProjectManager || undefined,
          projectExecutive: rawProjectExecutive || rawExecutive || undefined,
          bdmId: customer.bdmId || matchedUser?._id,
          bdmPhone: customer.bdmPhone || rawBdmPhone || matchedUser?.phone,
          assignedTl: resolvedAssignedTl || customer.assignedTl || undefined,
          assignedTlId: resolvedAssignedTlId || customer.assignedTlId || undefined,
          vrlLrNumber: rawTracking || undefined,
          trackingNumber: rawTracking || undefined,
          drawingUrl: rawDrawingUrl || undefined,
          whatsappGroupId: rawWhatsappGroup ? String(rawWhatsappGroup).trim() : undefined,
          whatsappGroupName: rawWhatsappGroupName || (rawWhatsappGroup ? `${projectName} — Alpha Updates` : undefined),
          automationEnabled: parseExcelBoolean(rawAutomationEnabled, true),
          updateFrequencyDays: rawUpdateFreq ? parseExcelNumber(rawUpdateFreq, 20) : 20,
          productionStage: rawProductionStage ? parseExcelNumber(rawProductionStage, 1) : undefined,
          productionTimelineDays: rawProductionTimelineDays ? parseExcelNumber(rawProductionTimelineDays, 0) : undefined,
          nextUpdateAt: nextUpdate,
          notes: projectNotes,
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
    // Customer Details
    'Customer Code',
    'Customer Name *',
    'Phone Number *',
    'WhatsApp Number',
    'Email',
    'Door No',
    'Street Name',
    'Landmark',
    'City',
    'State',
    'Pincode',
    'Customer Address',
    'Customer Google Maps Link',
    'Customer Type',
    'Lead Source',
    'WhatsApp Opt-In',
    'Old Customer',
    'Customer Notes',
    // Project Details
    'Project Code',
    'Project Name *',
    'Site Address *',
    'Site Google Maps Link',
    'Lift Model',
    'Lift Type',
    'Number of Floors',
    'Shaft Model',
    'Drawing URL',
    'Order Value (INR) *',
    'Lift Amount (INR)',
    'Lift Base Amount (INR)',
    'Lift Discount Amount (INR)',
    'Shaft Amount (INR)',
    'Shaft Base Amount (INR)',
    'Shaft Discount Amount (INR)',
    'Advance Percentage (%)',
    'Advance Amount (INR)',
    'Total Paid (INR)',
    'Balance Amount (INR)',
    'Payment Status',
    'Production Payment (%)',
    'Readiness Notification (%)',
    'Dispatch Materials (%)',
    'After Installation (%)',
    'Current Stage',
    'Order Date (DD/MM/YYYY)',
    'Expected Delivery Date (DD/MM/YYYY)',
    'Actual Delivery Date (DD/MM/YYYY)',
    'Installation Date (DD/MM/YYYY)',
    'Assigned Executive',
    'Project Manager',
    'Project Executive',
    'Assigned TL',
    'BDM Phone',
    'VRL LR Tracking Number',
    'WhatsApp Group ID',
    'WhatsApp Group Name',
    'WhatsApp Automation Enabled',
    'Update Frequency (Days)',
    'Project Notes',
  ];

  const sampleRows = [
    [
      'CUST-001',
      'Rajesh Kumar',
      '9876543210',
      '9876543210',
      'rajesh.kumar@gmail.com',
      'Flat 402',
      '100 Feet Road',
      'Near Metro Station',
      'Bengaluru',
      'Karnataka',
      '560038',
      '#42, Flat 402, 100 Feet Road, Indiranagar, Bengaluru, Karnataka - 560038',
      'https://maps.google.com/?q=12.9716,77.5946',
      'Residential',
      'Architect Referral',
      'Yes',
      'No',
      'Client prefers weekend phone calls only',
      'ALP-001',
      'Kumar Residence',
      '#42, 100 Feet Road, Indiranagar, Bengaluru',
      'https://maps.google.com/?q=12.9716,77.5946',
      'AE 01 Home Series',
      'Home Lift',
      'G+2',
      'Civil Shaft',
      '',
      1250000,
      1250000,
      1200000,
      0,
      0,
      0,
      0,
      30,
      375000,
      375000,
      875000,
      'ADVANCE_PAID',
      40,
      30,
      0,
      0,
      'Site Visit',
      '10/01/2026',
      '15/04/2026',
      '',
      '',
      'Srinivasan (TL)',
      'Srinivasan (TL)',
      'Srinivasan (TL)',
      'Srinivasan (TL)',
      '9876500001',
      '',
      '120363024888123456@g.us',
      'Kumar Residence — Alpha Updates',
      'Yes',
      20,
      'Hydraulic Home Elevator for private villa, cabin design approved',
    ],
    [
      'CUST-002',
      'Priya Sharma',
      '9845123456',
      '9845123456',
      'priya.sharma@outlook.com',
      'Villa 18',
      'Palm Meadows Avenue',
      'Opposite Clubhouse',
      'Bengaluru',
      'Karnataka',
      '560066',
      'Villa 18, Palm Meadows, Whitefield, Bengaluru, Karnataka - 560066',
      'https://maps.google.com/?q=12.9698,77.7499',
      'Villa',
      'Digital Ad',
      'Yes',
      'No',
      'Requires silent motor specifications',
      'ALP-002',
      'Sharma Villa',
      'Villa 18, Palm Meadows, Whitefield, Bengaluru',
      'https://maps.google.com/?q=12.9698,77.7499',
      'Alpha EV',
      'Villa Elevator',
      'G+1',
      'ACP Shaft',
      '',
      1400000,
      1100000,
      1100000,
      0,
      300000,
      300000,
      0,
      30,
      420000,
      420000,
      980000,
      'ADVANCE_PAID',
      40,
      30,
      0,
      0,
      'Advance Payment Received',
      '15/02/2026',
      '20/05/2026',
      '',
      '',
      'Sundaram',
      'Sundaram',
      'Sundaram',
      'Sundaram',
      '9876500002',
      '',
      '',
      '',
      'Yes',
      20,
      '3 passenger panoramic cabin finish with glass shaft',
    ],
    [
      'CUST-003',
      'Venkat Raman',
      '9900112233',
      '9900112233',
      'venkat@ramangroup.in',
      'No. 88',
      '2nd Main Road',
      'Anna Nagar West Extension',
      'Chennai',
      'Tamil Nadu',
      '600040',
      'No. 88, 2nd Main Road, Anna Nagar West, Chennai, Tamil Nadu - 600040',
      'https://maps.google.com/?q=13.0850,80.2101',
      'Commercial',
      'Direct',
      'Yes',
      'No',
      'Commercial office building with high traffic',
      'ALP-003',
      'Raman Commercial Center',
      'No. 88, Anna Nagar West, Chennai',
      'https://maps.google.com/?q=13.0850,80.2101',
      'AE 02 Gearless Rope Home Series',
      'Commercial',
      'G+4',
      'Glass Shaft',
      '',
      2200000,
      1700000,
      1700000,
      0,
      500000,
      500000,
      0,
      30,
      660000,
      1540000,
      660000,
      'PARTIAL_PAID',
      40,
      20,
      5,
      5,
      'Material in transit',
      '01/12/2025',
      '10/03/2026',
      '',
      '',
      'Bala',
      'Bala',
      'Bala',
      'Bala',
      '9876500003',
      'VRL-BLR-884920',
      '120363024888789012@g.us',
      'Raman Commercial — Alpha Updates',
      'Yes',
      15,
      '6 passenger MRL gearless lift in transit via VRL Logistics',
    ],
  ];

  const wsData = [templateHeaders, ...sampleRows];
  const ws1 = XLSX.utils.aoa_to_sheet(wsData);

  // Set column widths dynamically
  ws1['!cols'] = templateHeaders.map((h) => ({
    wch: Math.min(Math.max(h.length + 4, 14), 50),
  }));

  XLSX.utils.book_append_sheet(wb, ws1, 'Data Import');

  // Sheet 2: Guidelines & Allowed Values
  const guideData = [
    ['Alpha CRM Excel Import Comprehensive Reference Guide', ''],
    ['Field Name', 'Description, Permitted Formats & Default Values'],
    ['--- CUSTOMER FIELDS ---', '---------------------------------------------------------------------------------'],
    ['Customer Code', 'e.g. CUST-001. If provided, updates existing or sets customer code. If left blank, continuous sequential code is generated.'],
    ['Customer Name *', 'Full name of customer or project owner (Mandatory).'],
    ['Phone Number *', '10-digit primary contact mobile number (Mandatory).'],
    ['WhatsApp Number', '10-digit mobile number for milestone group automation (Defaults to Phone Number).'],
    ['Email', 'Customer email address for proposal and invoice dispatches.'],
    ['Door No / Street / Landmark', 'Flat, door, street, and landmark details for precise dispatch address.'],
    ['City / State / Pincode', 'Customer residential or billing location (Defaults to Chennai, Tamil Nadu).'],
    ['Customer Address', 'Full customer mailing address or Google Maps location link.'],
    ['Customer Google Maps Link', 'Direct Google Maps web link (https://maps.google.com/...) for location routing.'],
    ['Customer Type', 'Residential | Villa | Commercial | Builder (Default: Residential)'],
    ['Lead Source', 'Architect Referral | Digital Ad | Website | Walk-in | Direct | Referral (Default: Excel Import)'],
    ['WhatsApp Opt-In', 'Yes | No | true | false (Default: Yes). Enables Meta WhatsApp notifications.'],
    ['Old Customer', 'Yes | No | true | false (Default: No). Designates historical pre-existing accounts.'],
    ['Customer Notes', 'Special customer preferences, gate access rules, or interaction history.'],
    ['--- ELEVATOR PROJECT FIELDS ---', '---------------------------------------------------------------------------------'],
    ['Project Code', 'e.g. ALP-001. If provided, updates existing project; if left blank, next sequential ALP-XXX is created.'],
    ['Project Name *', 'Project identification title (e.g. "Kumar Residence"). Defaults to "<Customer Name> Residence".'],
    ['Site Address *', 'Physical elevator installation site address (Mandatory). Defaults to Customer Address.'],
    ['Site Google Maps Link', 'Direct Google Maps web URL pointing to the exact installation site gate.'],
    ['Lift Model', 'AE 01 Home Series | AE 02 Gearless Rope Home Series | AE 03 Gearless Belt Home series | Alpha EV | Alpha Premier | Alpha Luxe | Hydraulic Home Series'],
    ['Lift Type', 'Home Lift | Villa Elevator | Glass Panoramic | Commercial | Dumbwaiter (Default: Home Lift)'],
    ['Number of Floors', 'e.g. G+1, G+2, G+3, 2 Stops, 3 Stops, 4 Stops (Default: G+1)'],
    ['Shaft Model', 'Civil Shaft | ACP Shaft | Glass Shaft | MS Structure | Customer Scope (Default: Civil Shaft)'],
    ['Drawing URL', 'URL or path to uploaded technical elevator CAD/PDF drawing.'],
    ['Order Value (INR) *', 'Total contracted elevator project amount in INR (e.g. 1250000).'],
    ['Lift Amount (INR)', 'Portion of order value attributable to the lift machine & cabin.'],
    ['Lift Base Amount / Discount', 'Base catalog price and discount amount for lift component.'],
    ['Shaft Amount (INR)', 'Portion of order value attributable to external elevator shaft.'],
    ['Shaft Base Amount / Discount', 'Base catalog price and discount amount for shaft structure.'],
    ['Advance Percentage (%)', 'Advance booking percentage (Default: 30%).'],
    ['Advance Amount (INR)', 'Initial advance payment amount (calculated from Advance % if left empty).'],
    ['Total Paid (INR)', 'Total cumulative amount received to date (Defaults to Advance Amount).'],
    ['Balance Amount (INR)', 'Remaining unpaid balance (Defaults to Order Value minus Total Paid).'],
    ['Payment Status', 'PENDING | ADVANCE_PAID | PARTIAL_PAID | FULLY_PAID (Auto-calculated if blank).'],
    ['Stage Payment Percentages (%)', 'Production Payment % (default 40), Readiness Notification % (default 30), Dispatch Materials % (default 0), After Installation % (default 0).'],
    ['Current Stage', 'Any milestone stage name:\n• Advance Payment Received\n• Site Visit\n• Drawing and Cabin\n• Drawing and Cabin Design Approval\n• Production Payment\n• Production in progress\n• Readiness Payment\n• Material ready to Dispatch\n• Material in transit\n• Pre Site Visit\n• Material Delivered\n• Installation in Progress\n• Handover - Payment Pending\n• Project Completed'],
    ['Order Date / Delivery Dates', 'Order Date, Expected Delivery Date, Actual Delivery Date, Installation Date (DD/MM/YYYY).'],
    ['Team Assignments', 'Assigned Executive, Project Manager, Project Executive (e.g. Srinivasan (TL), Sundaram, Bala, etc.).'],
    ['Assigned TL', 'Assigned Team Lead: Srinivasan (TL) | Sundaram | Bala. Restricts visibility so only the assigned TL can access this customer and their projects.'],
    ['BDM Phone', '10-digit WhatsApp number of assigned Business Development Manager.'],
    ['VRL LR Tracking Number', 'VRL Logistics LR tracking number for transit status tracking.'],
    ['WhatsApp Group ID / Name', 'WATI WhatsApp Group ID (e.g. 120363024888123456@g.us) and Group Name.'],
    ['WhatsApp Automation Enabled', 'Yes | No (Default: Yes). Enables automated scheduled updates to client WhatsApp group.'],
    ['Update Frequency (Days)', 'Periodic frequency for automated status dispatch (Default: 20 days; 10, 15, 20).'],
    ['Project Notes', 'Engineering site notes, shaft preparation remarks, or project milestone updates.'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(guideData);
  ws2['!cols'] = [{ wch: 32 }, { wch: 85 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Reference Guide');

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}
