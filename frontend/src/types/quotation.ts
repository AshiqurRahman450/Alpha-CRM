export interface QuotationData {
  // Template Format (11-page standard vs 5-page circle presentation)
  templateType?: 'standard' | 'circle';

  // General & Client Information
  clientName: string;
  projectCity: string;
  model: string;
  seriesTitle: string;
  offerNo: string;
  offerDate: string;
  subject: string;
  representativeName: string;
  representativePhone: string;
  representativeEmail: string;
  customerPhone?: string;
  siteAddress?: string;
  clientEmail?: string;
  billingAddress?: string;
  shippingAddress?: string;
  sameAsBilling?: boolean;
  hasGst?: boolean;
  gstNumber?: string;
  existingCustomerId?: string;

  // Introduction & Vision (Page 2)
  salutation: string;
  introParagraph1: string;
  introParagraph2: string;
  introParagraph3: string;
  visionText: string;

  // Civil Specifications (Page 3)
  hoistWayShaftSize: string;
  pitDepth: string;
  minFloorHeight: string;
  finalStop: string;
  lockableStorageRoom: string;
  shaftScope?: string; // 'Customer scope' | 'Alpha Elevators scope'

  // Cabin Specifications (Page 3)
  cabinWalls: string;
  cabinFloor: string;
  ceiling: string;
  copAndLop: string;

  // Elevator Specifications (Page 4)
  ratedLoad: string;
  noOfStops: string;
  noOfOpenings: string;
  floorNumbering: string;
  doorOpening?: string;
  doorAccess: string;
  doorAccessFloors?: Record<string, string[]>;
  totalTravelHeight: string;
  controller: string;
  speed: string;
  machine: string;
  powerSupply: string;
  carSize: string;
  battery: string;
  clearOpening: string;
  customerSpecificRequirements?: string;

  // Door Specifications (Page 4)
  doorSpecifications: string;

  // Shaft Specifications & Features (Page 5)
  shaftType: string;
  accessoriesFeatures: string[];

  // Terms of Sale / Commercials (Page 5)
  elevatorPrice: number;
  specialElevatorPrice?: number;
  elevatorDiscountPrice?: number;
  elevatorDiscountLocked?: boolean;
  shaftPrice: number;
  specialShaftPrice?: number;
  shaftDiscountPrice?: number;
  shaftDiscountLocked?: boolean;
  gstRate: number; // percentage (e.g. 18)
  warranty: string;
  motorWarranty?: string;
  manufacturingWarranty?: string;
  freeMaintenance?: string;
  deliveryTime: string;
  deliveryDays?: number | string;
  deliveryApprovalStatus?: 'NOT_REQUESTED' | 'PENDING' | 'APPROVED' | 'REJECTED';
  deliveryApprovalDays?: number;
  deliveryApprovalBy?: string;
  deliveryApprovalAt?: string;
  deliveryApprovalRequestedAt?: string;
  deliveryApprovedForOfferNo?: string;
  deliveryApprovedForClientName?: string;
  paymentTerms: {
    booking: string;
    production: string;
    readiness: string;
  };

  // Bank Details (Page 5)
  companyName: string;
  accountNumber: string;
  ifsc: string;
  swiftCode: string;
  bankName: string;
  branch: string;

  // Signatures (Page 9)
  clientSignatoryName: string;
  clientSignDate: string;
  clientSignature?: string; // Digital signature image data URL / PNG
  alphaSignatoryName: string;
  alphaSignDate: string;
  alphaSignature?: string;
}

export function getTodayDateParts(date: Date = new Date()): {
  dd: string;
  mm: string;
  yy: string;
  yyyy: string;
  ddmmyy: string;
  formattedDate: string;
} {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = String(date.getFullYear());
  const yy = yyyy.slice(-2);
  return {
    dd,
    mm,
    yy,
    yyyy,
    ddmmyy: `${dd}${mm}${yy}`,
    formattedDate: `${dd}/${mm}/${yyyy}`,
  };
}

export function formatAutomatedOfferNo(
  count: number = 1,
  stage: number = 1,
  date: Date = new Date()
): string {
  const { ddmmyy } = getTodayDateParts(date);
  const validCount = Math.max(1, Math.floor(Number(count) || 1));
  const validStage = [1, 2, 3, 4].includes(Number(stage)) ? Number(stage) : 1;
  return `AE/QTN/ AE-${ddmmyy}-${validCount}-${validStage}`;
}

export function parseOfferNoParts(offerNo?: string): {
  ddmmyy: string;
  count: number;
  stage: 1 | 2 | 3 | 4;
} {
  const { ddmmyy: todayDdmmyy } = getTodayDateParts();
  if (!offerNo) {
    return { ddmmyy: todayDdmmyy, count: 1, stage: 1 };
  }
  const trimmed = offerNo.trim();
  const match = trimmed.match(/AE-(\d{6})-(\d+)(?:-([1234]))?$/i);
  if (match) {
    const s = match[3] ? parseInt(match[3], 10) : 1;
    const stage = (s === 2 ? 2 : s === 3 ? 3 : s === 4 ? 4 : 1) as 1 | 2 | 3 | 4;
    return {
      ddmmyy: match[1],
      count: Math.max(1, parseInt(match[2], 10) || 1),
      stage,
    };
  }
  const stageMatch = trimmed.match(/-([1234])$/);
  const fallbackStage = (stageMatch ? parseInt(stageMatch[1], 10) : 1) as 1 | 2 | 3 | 4;
  return { ddmmyy: todayDdmmyy, count: 1, stage: fallbackStage };
}

const QUOTATION_COUNT_STORAGE_KEY = 'alpha_quotation_count_seq_v1';

export function getCurrentQuotationCount(): number {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(QUOTATION_COUNT_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(QUOTATION_COUNT_STORAGE_KEY, '1');
      return 1;
    }
    const parsed = parseInt(raw, 10);
    if (isNaN(parsed) || parsed < 1) {
      localStorage.setItem(QUOTATION_COUNT_STORAGE_KEY, '1');
      return 1;
    }
    return parsed;
  } catch {
    return 1;
  }
}

export function incrementQuotationCount(currentOfferNo?: string): number {
  const stored = getCurrentQuotationCount();
  let currentFromOffer = 0;
  if (currentOfferNo && !currentOfferNo.includes('261026-131')) {
    currentFromOffer = parseOfferNoParts(currentOfferNo).count;
  }
  const base = Math.max(1, stored, currentFromOffer);
  const next = base + 1;
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(QUOTATION_COUNT_STORAGE_KEY, String(next));
    } catch {}
  }
  return next;
}

export function getEffectiveSpecialElevatorPrice(data?: Partial<QuotationData>): number {
  if (!data) return 0;
  if (data.specialElevatorPrice !== undefined && data.specialElevatorPrice !== null) {
    return Math.max(0, Number(data.specialElevatorPrice) || 0);
  }
  return 0;
}

export function getEffectiveElevatorPrice(data?: Partial<QuotationData>): number {
  if (!data) return 0;
  const base = Math.max(0, Number(data.elevatorPrice || 0));
  const discount =
    data.elevatorDiscountPrice !== undefined &&
    data.elevatorDiscountPrice !== null &&
    Number(data.elevatorDiscountPrice) > 0
      ? Number(data.elevatorDiscountPrice)
      : 0;
  if (discount > 0) {
    return Math.max(0, base - discount);
  }
  const special = getEffectiveSpecialElevatorPrice(data);
  if (special > 0) return special;
  return base;
}

export function isCustomerScopeShaft(data?: Partial<QuotationData>): boolean {
  if (!data) return false;
  const scope = String(data.shaftScope || '').trim();
  const type = String(data.shaftType || '').trim();
  return /^customer\s*scope/i.test(scope) || /^customer\s*scope/i.test(type);
}

export function getEffectiveSpecialShaftPrice(data?: Partial<QuotationData>): number {
  if (!data || isCustomerScopeShaft(data)) return 0;
  if (data.specialShaftPrice !== undefined && data.specialShaftPrice !== null) {
    return Math.max(0, Number(data.specialShaftPrice) || 0);
  }
  return 0;
}

export function getEffectiveShaftPrice(data?: Partial<QuotationData>): number {
  if (!data || isCustomerScopeShaft(data)) return 0;
  const base = Math.max(0, Number(data.shaftPrice || 0));
  const discount =
    data.shaftDiscountPrice !== undefined &&
    data.shaftDiscountPrice !== null &&
    Number(data.shaftDiscountPrice) > 0
      ? Number(data.shaftDiscountPrice)
      : 0;
  if (discount > 0) {
    return Math.max(0, base - discount);
  }
  const special = getEffectiveSpecialShaftPrice(data);
  if (special > 0) return special;
  return base;
}

export const DEFAULT_QUOTATION_DATA: QuotationData = {
  templateType: 'standard',
  clientName: 'Mr. Rathish Rajakumar',
  projectCity: 'Chennai',
  model: 'AE 03 Gearless Belt Home series EV',
  seriesTitle: 'Alpha Home Series: AE 03 Gearless Belt Home series EV',
  offerNo: formatAutomatedOfferNo(1, 1),
  offerDate: getTodayDateParts().formattedDate,
  subject: 'Supply, Install, test and commission of one Belt Type Home Elevator EV',
  representativeName: 'Thirunavukarasu',
  representativePhone: '+91 80151 29224',
  representativeEmail: 'info@alphaelevators.in',
  customerPhone: '9820011101',
  siteAddress: '124 Anna Nagar Main Rd, Chennai',
  clientEmail: 'info@rathishelevators.com',
  billingAddress: 'No. 42, 2nd Avenue, Anna Nagar East, Chennai - 600102, Tamil Nadu',
  shippingAddress: 'No. 42, 2nd Avenue, Anna Nagar East, Chennai - 600102, Tamil Nadu',
  sameAsBilling: true,
  hasGst: false,
  gstNumber: '',

  salutation: 'Dear Mr. Rathish Rajakumar',
  introParagraph1:
    'At Alpha Elevators, we are redefining vertical mobility through innovative technology, precision engineering, and refined craftsmanship. We combine Indian ingenuity with Italian expertise to deliver elevator solutions that bring together luxury, safety, and reliability.',
  introParagraph2:
    'With over 8 years of industry experience, our team is committed to delivering seamless installations, dependable servicing, and exceptional customer experiences. From elegant residential spaces to modern commercial environments, we create elevator solutions tailored to diverse needs.',
  introParagraph3:
    'Thank you for choosing Alpha Elevators. We look forward to elevating your expectations and creating new possibilities together.',
  visionText: 'Elevating possibilities and building lasting bonds — one lift at a time.',

  hoistWayShaftSize: '1450mm X 1800mm',
  pitDepth: '250mm',
  minFloorHeight: '3000mm',
  finalStop: '3300mm',
  lockableStorageRoom: 'To be Located In the Top Floor',
  shaftScope: 'Alpha Elevators scope',

  cabinWalls: 'Premium Glass Cabin - SS Finish',
  cabinFloor: "Vinyl or Client's own Flooring",
  ceiling: 'As per cabin design',
  copAndLop: 'Touch ( TFT Display)',

  ratedLoad: 'Upto 5 Passengers /408 kgs',
  noOfStops: 'G+2',
  noOfOpenings: '3 Openings',
  floorNumbering: 'G,1,2',
  doorOpening: 'inline',
  doorAccess: 'G - A, 1 - A, 2 - A',
  doorAccessFloors: { G: ['A'], '1': ['A'], '2': ['A'] },
  totalTravelHeight: '7000mm',
  controller: 'Imported',
  speed: 'Up to 1 m/s',
  machine: 'Imported',
  powerSupply: 'Single phase',
  carSize: 'TBC*',
  battery: 'Lithium-ion',
  clearOpening: 'TBC*',
  customerSpecificRequirements: 'Nil',

  doorSpecifications: 'Telescopic Doors- SS 304 Grade',

  shaftType: 'Glass Shaft',
  accessoriesFeatures: [
    'Imported Controller',
    'Extra Soft Start & Landing',
    'Supports up to 100 operating cycles during a power failure',
    'Multi-beam Light Curtains',
    'Single Phase Protection',
    'Interlocking Switches',
    'Imported Motor',
    'Reverse Phase Protection',
    'Digital Display - Up & Down + Floor',
    'Anti-Squeeze Door system',
    'Self Diagnostic Control System',
    'Alarm with SOS + Phone',
  ],

  elevatorPrice: 1600000,
  shaftPrice: 400000,
  gstRate: 18,
  warranty:
    'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance , 5 years Battery warranty ( 3 Years replaceable and 2 years service.',
  motorWarranty: 'Lifetime',
  manufacturingWarranty: '5 years',
  freeMaintenance: '1 Years',
  deliveryTime: '120 days post confirmation on drawings and finishes.',
  deliveryDays: 120,
  paymentTerms: {
    booking: '1. Booking – 30%',
    production: '2. Production Amount - 40%',
    readiness: '3. Readiness notification-30%',
  },

  companyName: 'RANALPHA ELEVATORS PVT LTD',
  accountNumber: '70070070031',
  ifsc: 'IDFB0080106',
  swiftCode: 'IDFBINBBMUM',
  bankName: 'IDFC FIRST',
  branch: 'Anna Nagar Branch',

  clientSignatoryName: 'Mr. Rathish Rajakumar',
  clientSignDate: '26/10/2026',
  clientSignature: '',
  alphaSignatoryName: 'For Alpha Elevators',
  alphaSignDate: '26/10/2026',
  alphaSignature: '',
};

export const QUOTATION_PRESETS: { name: string; description: string; data: Partial<QuotationData> }[] = [
  {
    name: 'AE 01 - Hydralic Home Series',
    description: 'Compact hydraulic / villa home lift with ground-floor storage and whisper-quiet power pack',
    data: {
      model: 'AE 01 - Hydralic Home Series',
      seriesTitle: 'Alpha Home Series: AE 01 - Hydralic Home Series',
      hoistWayShaftSize: '1350mm X 1500mm',
      pitDepth: '150mm',
      minFloorHeight: '2800mm',
      finalStop: '3000mm',
      lockableStorageRoom: 'To be Located In the Ground Floor',
      cabinWalls: 'Standared Cabin- SS Finish',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Touch ( TFT Display)',
      ratedLoad: '4 Passengers / 320 kgs',
      noOfStops: 'G+1',
      noOfOpenings: '2 Openings',
      floorNumbering: 'G,1',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'] },
      totalTravelHeight: '3500mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single Phase',
      carSize: 'TBC*',
      battery: '',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Auto Swing Doors- SS 304 Grade',
      shaftScope: 'Alpha Elevators scope',
      shaftType: 'Glass Shaft',
      accessoriesFeatures: [
        'Imported Controller',
        'Extra Soft Start & Landing',
        'ARD',
        'Multi-beam Light Curtains',
        'Single Phase Protection',
        'Interlocking Switches',
        'Imported Motor and controller',
        'Reverse Phase Protection',
        'Digital Display - Up & Down + Floor',
        'Anti-Squeeze Door system',
        'Self Diagnostic Control System',
        'Alarm with SOS + Phone',
        'BCG Buttons',
      ],
      elevatorPrice: 1350000,
      shaftPrice: 350000,
      warranty: 'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
  {
    name: 'AE 02 Gearless Rope Home Series',
    description: 'Energy-efficient traction gearless counterweighted residential elevator',
    data: {
      model: 'AE 02 Gearless Rope Home Series',
      seriesTitle: 'Alpha Home Series: AE 02 Gearless Rope Home Series',
      hoistWayShaftSize: '1450mm X 1600mm',
      pitDepth: '200mm',
      minFloorHeight: '2900mm',
      finalStop: '3200mm',
      lockableStorageRoom: 'To be Located In the Top Floor',
      shaftScope: 'Alpha Elevators scope',
      cabinWalls: 'Premium Glass Cabin - SS Finish',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Touch ( TFT Display)',
      ratedLoad: '5 Passengers / 408 kgs',
      noOfStops: 'G+2',
      noOfOpenings: '3 Openings',
      floorNumbering: 'G,1,2',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A, 2 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'], '2': ['A'] },
      totalTravelHeight: '7000mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single Phase',
      carSize: 'TBC*',
      battery: '',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Telescopic Doors- SS 304 Grade',
      shaftType: 'Glass Shaft',
      accessoriesFeatures: [
        'Imported Controller',
        'Extra Soft Start & Landing',
        'ARD',
        'Multi-beam Light Curtains',
        'Single Phase Protection',
        'Interlocking Switches',
        'Imported Motor and controller',
        'Reverse Phase Protection',
        'Digital Display - Up & Down + Floor',
        'Anti-Squeeze Door system',
        'Self Diagnostic Control System',
        'Alarm with SOS + Phone',
      ],
      elevatorPrice: 1500000,
      shaftPrice: 400000,
      warranty: 'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
  {
    name: 'AE 03 Gearless Belt Home series',
    description: 'Ultra-smooth flat belt home elevator with smooth gearless PMSM machine without EV battery unit',
    data: {
      model: 'AE 03 Gearless Belt Home series',
      seriesTitle: 'Alpha Home Series: AE 03 Gearless Belt Home series',
      hoistWayShaftSize: '1450mm X 1800mm',
      pitDepth: '250mm',
      minFloorHeight: '3000mm',
      finalStop: '3300mm',
      lockableStorageRoom: 'To be Located In the Top Floor',
      shaftScope: 'Alpha Elevators scope',
      cabinWalls: 'Premium Glass Cabin - SS Finish',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Touch ( TFT Display)',
      ratedLoad: '5 Passengers / 408 kgs',
      noOfStops: 'G+2',
      noOfOpenings: '3 Openings',
      floorNumbering: 'G,1,2',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A, 2 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'], '2': ['A'] },
      totalTravelHeight: '7000mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single Phase',
      carSize: 'TBC*',
      battery: '',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Telescopic Doors- SS 304 Grade',
      shaftType: 'Glass Shaft',
      accessoriesFeatures: [
        'Imported Controller',
        'Extra Soft Start & Landing',
        'ARD',
        'Multi-beam Light Curtains',
        'Single Phase Protection',
        'Interlocking Switches',
        'Imported Motor and controller',
        'Reverse Phase Protection',
        'Digital Display - Up & Down + Floor',
        'Anti-Squeeze Door system',
        'Self Diagnostic Control System',
        'Alarm with SOS + Phone',
      ],
      elevatorPrice: 1600000,
      shaftPrice: 400000,
      warranty: 'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
  {
    name: 'AE 03 Gearless Belt Home series EV',
    description: 'Flagship residential belt-driven home elevator with integrated lithium-ion backup battery',
    data: {
      model: 'AE 03 Gearless Belt Home series EV',
      seriesTitle: 'Alpha Home Series: AE 03 Gearless Belt Home series EV',
      hoistWayShaftSize: '1450mm X 1800mm',
      pitDepth: '250mm',
      minFloorHeight: '3000mm',
      finalStop: '3300mm',
      lockableStorageRoom: 'To be Located In the Top Floor',
      shaftScope: 'Alpha Elevators scope',
      cabinWalls: 'Premium Glass Cabin - SS Finish',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Touch ( TFT Display)',
      ratedLoad: '5 Passengers / 408 kgs',
      noOfStops: 'G+2',
      noOfOpenings: '3 Openings',
      floorNumbering: 'G,1,2',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A, 2 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'], '2': ['A'] },
      totalTravelHeight: '7000mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single phase',
      carSize: 'TBC*',
      battery: 'Lithium-ion',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Telescopic Doors- SS 304 Grade',
      shaftType: 'Glass Shaft',
      accessoriesFeatures: [
        'Imported Controller',
        'Extra Soft Start & Landing',
        'Supports up to 100 operating cycles during a power failure',
        'Multi-beam Light Curtains',
        'Single Phase Protection',
        'Interlocking Switches',
        'Imported Motor',
        'Reverse Phase Protection',
        'Digital Display - Up & Down + Floor',
        'Anti-Squeeze Door system',
        'Self Diagnostic Control System',
        'Alarm with SOS + Phone',
      ],
      elevatorPrice: 1600000,
      shaftPrice: 400000,
      warranty:
        'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance , 5 years Battery warranty ( 3 Years replaceable and 2 years service.',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
  {
    name: 'Semi Home Lift',
    description: 'Cost-effective semi-automatic residential elevator with choice of Single or Third Phase',
    data: {
      model: 'Semi Home Lift',
      seriesTitle: 'Alpha Semi Series: Semi Home Lift',
      hoistWayShaftSize: '1300mm X 1400mm',
      pitDepth: '200mm',
      minFloorHeight: '2800mm',
      finalStop: '3000mm',
      lockableStorageRoom: 'To be Located In the Top Floor',
      shaftScope: 'Alpha Elevators scope',
      cabinWalls: 'MS',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Button',
      ratedLoad: '4 Passengers / 300 kgs',
      noOfStops: 'G+1',
      noOfOpenings: '2 Openings',
      floorNumbering: 'G,1',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'] },
      totalTravelHeight: '3500mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single Phase',
      carSize: 'TBC*',
      battery: '',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Manual Doors-- SS 304 Grade',
      shaftType: 'Civil Shaft',
      elevatorPrice: 1100000,
      shaftPrice: 300000,
      warranty: 'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
  {
    name: 'Alpha Circle Lift',
    description: 'Luxury circular glass panoramic home elevator (5-page presentation format)',
    data: {
      templateType: 'circle',
      model: 'Alpha Circle Lift',
      seriesTitle: 'Alpha Panoramic Series: Alpha Circle Lift',
      hoistWayShaftSize: '1150 mm',
      pitDepth: '150 mm/ Ramp',
      minFloorHeight: '2850 mm',
      finalStop: '2850 mm',
      lockableStorageRoom: 'Self-Contained / Top Floor',
      cabinWalls: 'Standard Cabin',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'COP & LOP – BCG BUTTONS',
      ratedLoad: 'Upto 180 Kgs (2 passengers)',
      noOfStops: '2 Stops/G+1',
      noOfOpenings: '2 Openings',
      floorNumbering: 'G,1',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'] },
      totalTravelHeight: '3500mm',
      controller: 'Imported Motor and controller',
      speed: 'Up to 1 m/s',
      machine: 'Hydraulic',
      powerSupply: 'Single Phase',
      carSize: '750 mm / 820 mm Diameter',
      battery: 'ARD – Automatic Rescue Device',
      clearOpening: '600 mm',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Anti-Squeeze Door system',
      shaftType: 'Panoramic Circular Glass Shaft',
      accessoriesFeatures: [
        'Imported Motor and controller',
        'ARD – Automatic Rescue Device',
        'Single Phase Protection',
        'Interlocking Switches',
        'Reverse Phase Protection',
        'Anti-Squeeze Door system',
        'BCG Buttons',
      ],
      elevatorPrice: 1100000,
      shaftPrice: 0,
      warranty: '05 years - manufacturing warranty + 1 Year Free Maintenance',
      manufacturingWarranty: '60 Months',
      freeMaintenance: '1 Year',
      deliveryTime: '120 days post confirmation on drawings and finishes',
      deliveryDays: 120,
      paymentTerms: {
        booking: '30%',
        production: '40%',
        readiness: '30%',
      },
    },
  },
  {
    name: 'Alpha Circle Max Lift',
    description: 'Grand circular panoramic glass home elevator (5-page presentation format)',
    data: {
      templateType: 'circle',
      model: 'Alpha Circle Max Lift',
      seriesTitle: 'Alpha Panoramic Series: Alpha Circle Max Lift',
      hoistWayShaftSize: '1800mm X 1800mm',
      pitDepth: '300mm',
      minFloorHeight: '3200mm',
      finalStop: '3600mm',
      lockableStorageRoom: 'To be Located In the Top Floor',
      shaftScope: 'Alpha Elevators scope',
      cabinWalls: 'Premium Glass Cabin - SS Finish',
      cabinFloor: "Vinyl or Client's own Flooring",
      copAndLop: 'Touch ( TFT Display)',
      ratedLoad: '6 Passengers / 450 kgs',
      noOfStops: 'G+3',
      noOfOpenings: '4 Openings',
      floorNumbering: 'G,1,2,3',
      doorOpening: 'inline',
      doorAccess: 'G - A, 1 - A, 2 - A, 3 - A',
      doorAccessFloors: { G: ['A'], '1': ['A'], '2': ['A'], '3': ['A'] },
      totalTravelHeight: '10500mm',
      controller: 'Imported',
      speed: 'Up to 1 m/s',
      machine: 'Imported',
      powerSupply: 'Single Phase',
      carSize: 'TBC*',
      battery: '',
      clearOpening: 'TBC*',
      customerSpecificRequirements: 'Nil',
      doorSpecifications: 'Center Door Opening - SS 304 Grade',
      shaftType: 'Glass Shaft',
      accessoriesFeatures: [
        'Imported Controller',
        'Extra Soft Start & Landing',
        'ARD',
        'Multi-beam Light Curtains',
        'Single Phase Protection',
        'Interlocking Switches',
        'Imported Motor and controller',
        'Reverse Phase Protection',
        'Digital Display - Up & Down + Floor',
        'Anti-Squeeze Door system',
        'Self Diagnostic Control System',
        'Alarm with SOS + Phone',
      ],
      elevatorPrice: 2600000,
      shaftPrice: 700000,
      warranty: 'Lifetime- MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance',
      motorWarranty: 'Lifetime',
      manufacturingWarranty: '5 years',
      freeMaintenance: '1 Years',
      deliveryTime: '120 days post confirmation on drawings and finishes.',
      deliveryDays: 120,
    },
  },
];

export function buildWarrantyText(options: {
  motorWarranty?: string;
  manufacturingWarranty?: string;
  freeMaintenance?: string;
  isEv?: boolean;
}): string {
  const motor = options.motorWarranty || 'Lifetime';
  const mfg = options.manufacturingWarranty || '5 years';
  const maint = options.freeMaintenance || '1 Years';
  const base = `${motor}- MOTOR WARRANTY, ${mfg} - manufacturing warranty + ${maint} Free Maintenance`;
  if (options.isEv) {
    return `${base} , 5 years Battery warranty ( 3 Years replaceable and 2 years service.`;
  }
  return base;
}

export function parseWarrantyText(warrantyStr?: string): {
  motorWarranty: string;
  manufacturingWarranty: string;
  freeMaintenance: string;
  hasBattery: boolean;
} {
  const text = warrantyStr || '';
  const motorMatch = text.match(/(Lifetime|\d+\s*years?)-?\s*MOTOR\s*WARRANTY/i);
  const motorWarranty = motorMatch
    ? motorMatch[1].toLowerCase().replace(/\s+/g, '') === 'lifetime'
      ? 'Lifetime'
      : motorMatch[1].replace(/\s+/g, '')
    : 'Lifetime';

  const mfgMatch = text.match(/(\d+\s*years?)\s*-\s*manufacturing\s*warranty/i);
  const manufacturingWarranty = mfgMatch
    ? mfgMatch[1].toLowerCase().includes('year')
      ? (mfgMatch[1].trim().toLowerCase().endsWith('s') ? mfgMatch[1].trim() : mfgMatch[1].trim() + 's')
      : `${mfgMatch[1]} years`
    : '5 years';

  const maintMatch = text.match(/\+\s*(\d+\s*years?)\s*Free\s*Maintenance/i);
  const freeMaintenance = maintMatch ? maintMatch[1] : '1 Years';

  const hasBattery = /battery\s*warranty/i.test(text);

  return {
    motorWarranty,
    manufacturingWarranty,
    freeMaintenance,
    hasBattery,
  };
}

export function parseDeliveryDays(deliveryTimeStr?: string): number {
  if (!deliveryTimeStr) return 120;
  const match = deliveryTimeStr.match(/(\d+)\s*days/i);
  if (match) {
    const val = parseInt(match[1], 10);
    if (!isNaN(val)) return val;
  }
  return 120;
}

export function buildPage6WarrantyParagraph(data: QuotationData): string {
  const parsed = parseWarrantyText(data.warranty);
  const motor = data.motorWarranty || parsed.motorWarranty || 'Lifetime';
  const mfg = data.manufacturingWarranty || parsed.manufacturingWarranty || '5 years';
  const maint = data.freeMaintenance || parsed.freeMaintenance || '1 Years';

  const isEv = Boolean(
    (data.model && /\bEV\b|home\s*EV|battery/i.test(data.model)) ||
    (data.battery && data.battery.trim() !== '') ||
    parsed.hasBattery
  );

  const motorText = motor.toLowerCase() === 'lifetime' ? 'lifetime' : motor.replace(/(\d+)\s*years?/i, '$1 years');
  const mfgNum = parseInt(mfg, 10) || 5;
  const mfgText = `${mfgNum < 10 ? '0' + mfgNum : mfgNum} Years`;
  const maintNum = parseInt(maint, 10) || 1;
  const maintText = `${maintNum} years`;
  const batteryText = isEv ? ', 5 years battery warranty (3 years replaceable and 2 years service)' : '';

  return `<div class="t c23" style="position:absolute;left:33.41px;top:346.51px;width:731px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:3526;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">Warranty &amp; Maintenance : </span>Your Elevator comes with ${motorText} warranty for motor &amp; ${mfgText} warranty against any manufacturing defect${batteryText}. We also Provide ${maintText} free service from the date of installation or 60 days from the date of delivery, whichever is earlier. We will provide 2 routine services in a year. From 2nd year onwards there will be option for Annual Maintenance Contract (AMC) Comprehensive AMC 5% of the Basic Cost: Routine maintenance service and Complaints will be attended wherein the parts are also covered. - Applicable after ${mfgNum} years Non-comprehensive AMC 3% of the Basic Cost: Routine maintenance service will be carried out and complaints will be attended, but any part that needs replacement will be charged. - Applicable after ${maintNum} years On-Call Basis Annual Maintenance Contract (AMC) - a convenient and cost-effective solution for all your maintenance needs. For just ₹7,000 per standard visit and ₹5,000 per emergency visit, our certified technicians provide top-notch service, ensuring your equipment and systems remain in optimal condition - Applicable after ${maintNum} years.</div>`;
}

export function formatEffectiveShaft(shaftScope?: string, shaftType?: string): string {
  let cleanType = (shaftType || 'Glass Shaft').trim();
  cleanType = cleanType.replace(/^(Customer scope|Alpha Elevators [sS]cope|Shaft)\s*[-–—:]\s*/i, '').trim();
  if (!cleanType || cleanType.toLowerCase() === 'customer scope') {
    cleanType = 'Glass Shaft';
  }

  const isCustomer = (shaftScope === 'Customer scope' || shaftType === 'Customer scope');
  if (isCustomer) {
    return `Customer scope - ${cleanType}`;
  } else {
    return `Alpha Elevators Scope - ${cleanType}`;
  }
}

export function getPresetAccessoriesFeatures(model?: string): string[] {
  const m = (model || '').toLowerCase().trim();

  // 1. Gearless Belt Home Series EV (Flagship EV)
  if (/\bev\b|battery/i.test(m) || (m.includes('belt') && m.includes('ev')) || (m.includes('ae03') && m.includes('ev')) || (m.includes('ae 03') && m.includes('ev'))) {
    return [
      'Imported Controller',
      'Extra Soft Start & Landing',
      'Supports up to 100 operating cycles during a power failure',
      'Multi-beam Light Curtains',
      'Single Phase Protection',
      'Interlocking Switches',
      'Imported Motor',
      'Reverse Phase Protection',
      'Digital Display - Up & Down + Floor',
      'Anti-Squeeze Door system',
      'Self Diagnostic Control System',
      'Alarm with SOS + Phone',
    ];
  }

  // 2. Hydraulic Home Series
  if (m.includes('hydraulic') || m.includes('ae 01') || m.includes('ae01')) {
    return [
      'Imported Controller',
      'Extra Soft Start & Landing',
      'ARD',
      'Multi-beam Light Curtains',
      'Single Phase Protection',
      'Interlocking Switches',
      'Imported Motor and controller',
      'Reverse Phase Protection',
      'Digital Display - Up & Down + Floor',
      'Anti-Squeeze Door system',
      'Self Diagnostic Control System',
      'Alarm with SOS + Phone',
      'BCG Buttons',
    ];
  }

  // 3. Circle Lift & Circle Max Lift
  if (m.includes('circle')) {
    return [
      'Imported Motor and controller',
      'ARD – Automatic Rescue Device',
      'Single Phase Protection',
      'Interlocking Switches',
      'Reverse Phase Protection',
      'Anti-Squeeze Door system',
      'BCG Buttons',
    ];
  }

  // 4. Gearless Belt Home Series (standard without EV) / AE 02 Rope
  if (m.includes('belt') || m.includes('rope') || m.includes('ae 03') || m.includes('ae03') || m.includes('ae 02')) {
    return [
      'Imported Controller',
      'Extra Soft Start & Landing',
      'ARD',
      'Multi-beam Light Curtains',
      'Single Phase Protection',
      'Interlocking Switches',
      'Imported Motor and controller',
      'Reverse Phase Protection',
      'Digital Display - Up & Down + Floor',
      'Anti-Squeeze Door system',
      'Self Diagnostic Control System',
      'Alarm with SOS + Phone',
    ];
  }

  // 5. Semi Home Lift
  if (m.includes('semi')) {
    return [
      'Imported Controller',
      'Extra Soft Start & Landing',
      'ARD',
      'Multi-beam Light Curtains',
      'Single Phase Protection',
      'Interlocking Switches',
      'Imported Motor and controller',
      'Reverse Phase Protection',
      'Anti-Squeeze Door system',
      'Self Diagnostic Control System',
      'Alarm with SOS + Phone',
    ];
  }

  // Default fallback (EV features)
  return [
    'Imported Controller',
    'Extra Soft Start & Landing',
    'Supports up to 100 operating cycles during a power failure',
    'Multi-beam Light Curtains',
    'Single Phase Protection',
    'Interlocking Switches',
    'Imported Motor',
    'Reverse Phase Protection',
    'Digital Display - Up & Down + Floor',
    'Anti-Squeeze Door system',
    'Self Diagnostic Control System',
    'Alarm with SOS + Phone',
  ];
}

/**
 * Ensures the proposal subject line always begins with a single clean "Sub: " prefix
 * and eliminates any repeated "Sub: Sub: ..." occurrences.
 */
export function formatSubjectLine(subject?: string): string {
  const defaultSubject = 'Supply, Install, test and commission of one Belt Type Home Elevator EV';
  if (!subject || !subject.trim()) {
    return `Sub: ${defaultSubject}`;
  }
  const stripped = subject.replace(/^(?:\s*sub\s*[:.-]\s*)+/gi, '').trim();
  return `Sub: ${stripped || defaultSubject}`;
}
