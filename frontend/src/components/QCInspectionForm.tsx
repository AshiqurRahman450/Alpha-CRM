'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Building2,
  Calendar,
  MapPin,
  User,
  Phone,
  Hash,
  Mail,
  ShieldCheck,
  Ruler,
  Layers,
  Users,
  MessageSquare,
  Camera,
  Video,
  FileText,
  Download,
  Printer,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Search,
  Sparkles,
  ChevronRight,
  ChevronDown,
  UploadCloud,
  X,
  FileCheck2,
  Smartphone,
  Eye,
  Check,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../lib/api';

const TAMIL_NADU_REGIONS = [
  'Tamil Nadu — Chennai',
  'Tamil Nadu — Coimbatore',
  'Tamil Nadu — Madurai',
  'Tamil Nadu — Tiruchirappalli',
  'Tamil Nadu — Salem',
  'Tamil Nadu — Tiruppur',
  'Tamil Nadu — Erode',
  'Tamil Nadu — Vellore',
  'Tamil Nadu — Thoothukudi',
  'Tamil Nadu — Tirunelveli',
  'Tamil Nadu — Dindigul',
  'Tamil Nadu — Thanjavur',
  'Tamil Nadu — Ranipet',
  'Tamil Nadu — Sivakasi',
  'Tamil Nadu — Karur',
  'Tamil Nadu — Hosur',
  'Tamil Nadu — Nagercoil',
  'Tamil Nadu — Kanchipuram',
  'Tamil Nadu — Cuddalore',
  'Tamil Nadu — Kumbakonam',
  'Tamil Nadu — Tiruvannamalai',
  'Tamil Nadu — Pollachi',
  'Tamil Nadu — Rajapalayam',
  'Tamil Nadu — Krishnagiri',
  'Tamil Nadu — Namakkal',
  'Tamil Nadu — Dharmapuri',
  'Tamil Nadu — Villupuram',
  'Tamil Nadu — Nagapattinam',
  'Tamil Nadu — Mayiladuthurai',
  'Tamil Nadu — Pudukkottai',
  'Tamil Nadu — Ramanathapuram',
  'Tamil Nadu — Sivaganga',
  'Tamil Nadu — Virudhunagar',
  'Tamil Nadu — Perambalur',
  'Tamil Nadu — Ariyalur',
  'Tamil Nadu — Tenkasi',
  'Tamil Nadu — Tirupattur',
  'Tamil Nadu — Kallakurichi',
  'Tamil Nadu — Nilgiris (Ooty)',
  'Tamil Nadu — Theni',
  'Tamil Nadu — Tiruvallur',
  'Tamil Nadu — Chengalpattu',
  'Tamil Nadu — Kanyakumari',
  'Tamil Nadu — Other Tamil Nadu Location',
];

const PROPERTY_STAGES = [
  'Planning',
  'Under-Construction',
  'Structure Completed',
  'Finishing Work',
  'Ready for Installation',
  'Completed / Existing Building',
];

const INSTALLATION_AREAS = ['Indoor', 'Outdoor', 'Indoor / Outdoor'];

const PRODUCT_SERIES = [
  'Hydraulic Home Series',
  'Gearless Belt Home Series',
  'Gearless Belt Home Series EV',
  'Semi Home Lift',
  'Circle Lift',
  'Circle Max Lift',
  'Other',
];

const WALL_OPTIONS = [
  '9-inch Brick Wall',
  '4.5-inch Brick Wall',
  'RCC / Concrete Wall',
  'Steel Structure',
  'Glass',
  'Existing Wall',
  'Client to Provide',
  'Opening',
  'Not Applicable',
  'Other',
];

const ATTENDEE_ROLES = [
  'End Client (Owner)',
  'Architect',
  'Electrician',
  'Fabricator / Civil Person',
  'Client Representative',
  'Sales Person',
  'Technical Team / Person',
];

const ACCURACY_OPTIONS = ['Approximate', 'Confirmed / Final', 'Pending'];
const SIDE_OPTIONS = ['A', 'B', 'C', 'G', 'Multiple sides', 'Not confirmed'];
const HINGE_OPTIONS = ['LH (Left Hand)', 'RH (Right Hand)', 'Centre', 'Not applicable', 'Not confirmed'];

interface QCInspectionFormProps {
  initialReport?: any;
  onSaved?: () => void;
}

export default function QCInspectionForm({ initialReport, onSaved }: QCInspectionFormProps) {
  // Form State
  const [reportDate, setReportDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [region, setRegion] = useState<string>('');
  const [jobNo, setJobNo] = useState<string>('');
  const [clientName, setClientName] = useState<string>('');
  const [clientPhone, setClientPhone] = useState<string>('');
  const [visitCount, setVisitCount] = useState<string>('1');
  const [technician, setTechnician] = useState<string>('Dinesh Kumar S (8232)');
  const [technicianEmail, setTechnicianEmail] = useState<string>('technician@alphaelevators.com');
  const [quotationNo, setQuotationNo] = useState<string>('');

  // Property Details
  const [propertyStage, setPropertyStage] = useState<string>('Under-Construction');
  const [installationArea, setInstallationArea] = useState<string>('Indoor');
  const [product, setProduct] = useState<string>('Hydraulic Home Series');
  const [floorConfig, setFloorConfig] = useState<number>(3); // Stops, default 3 (G+2)
  const [doorClosing, setDoorClosing] = useState<string>('LH (Left Hand)');
  const [clientSignatureType, setClientSignatureType] = useState<string>('Confirmed');

  // Shaft Dimensions
  const [shaftG, setShaftG] = useState<string>('1850');
  const [shaftA, setShaftA] = useState<string>('1700');
  const [shaftB, setShaftB] = useState<string>('');
  const [shaftC, setShaftC] = useState<string>('');
  const [shaftAccuracy, setShaftAccuracy] = useState<string>('Approximate');
  const [plasterStatus, setPlasterStatus] = useState<string>('Without plaster');

  // Dynamic Floor Measurements map
  const [floorMeasurements, setFloorMeasurements] = useState<Record<string, any>>({
    pitHeight: '300',
    pitAccuracy: 'Approximate',
    pitDoorSide: 'A',
    pitDoor1Hinge: 'LH (Left Hand)',
    pitDoor2Hinge: 'Not applicable',
    pitDoor1DO: '',
    pitDoor2DO: '',
    headroomHeight: '2800',
    headroomAccuracy: 'Approximate',
    headroomDoorSide: 'A',
    headroomDoor1Hinge: 'LH (Left Hand)',
    headroomDoor2Hinge: 'Not applicable',
    headroomDoor1DO: '',
    headroomDoor2DO: '',
  });

  const [totalTravel, setTotalTravel] = useState<string>('6000');
  const [totalShaft, setTotalShaft] = useState<string>('');
  const [pitClient, setPitClient] = useState<string>('300');

  // Wall Specs map
  const [wallSpecs, setWallSpecs] = useState<Record<string, string>>({});

  // Attendees
  const [attendees, setAttendees] = useState<
    Array<{ role: string; present: boolean; name: string; phone: string }>
  >(
    ATTENDEE_ROLES.map((role) => ({
      role,
      present: role.includes('Client') || role.includes('Technical'),
      name: '',
      phone: '',
    }))
  );

  // Remarks & Confirmation
  const [clientRepName, setClientRepName] = useState<string>('');
  const [clientRepPhone, setClientRepPhone] = useState<string>('');
  const [timeIn, setTimeIn] = useState<string>('10:00');
  const [timeOut, setTimeOut] = useState<string>('12:30');
  const [technicianSignature, setTechnicianSignature] = useState<string>('Dinesh Kumar S');
  const [clientSign, setClientSign] = useState<string>('');
  const [remarks, setRemarks] = useState<string>('');

  // Photos State: base64 JPEG strings for high-res embedding in generated PDF
  const [photos, setPhotos] = useState<Record<string, string[]>>({});
  const [supportPhotos, setSupportPhotos] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const [supportFiles, setSupportFiles] = useState<string[]>([]);
  const [processingPhotos, setProcessingPhotos] = useState<boolean>(false);

  // CRM Autofill Data State
  const [crmCustomers, setCrmCustomers] = useState<any[]>([]);
  const [crmProjects, setCrmProjects] = useState<any[]>([]);
  const [loadingCrm, setLoadingCrm] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCrmDropdownOpen, setIsCrmDropdownOpen] = useState<boolean>(false);
  const [isCrmModalOpen, setIsCrmModalOpen] = useState<boolean>(false);
  const [selectedCrmItem, setSelectedCrmItem] = useState<any>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [activeFloorTab, setActiveFloorTab] = useState<number>(0);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);
  const [savingReport, setSavingReport] = useState<boolean>(false);
  const [validationModalOpen, setValidationModalOpen] = useState<boolean>(false);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [lastGeneratedPdfUrl, setLastGeneratedPdfUrl] = useState<string | null>(null);

  // Load CRM Customers & Projects for autofill
  useEffect(() => {
    const fetchCrmData = async () => {
      try {
        setLoadingCrm(true);
        const [custRes, projRes] = await Promise.all([
          api.getCustomers().catch(() => ({ data: [] })),
          api.getProjects().catch(() => ({ data: [] })),
        ]);
        setCrmCustomers(custRes.data || []);
        setCrmProjects(projRes.data || []);
      } catch (err) {
        console.warn('Could not load CRM customers for autofill:', err);
      } finally {
        setLoadingCrm(false);
      }
    };
    fetchCrmData();
  }, []);

  // Set default wall specs on stops change
  useEffect(() => {
    setWallSpecs((prev) => {
      const next = { ...prev };
      ['G', 'A', 'B', 'C'].forEach((side) => {
        for (let i = 0; i < floorConfig; i++) {
          const key = `wallFloor${i}${side}`;
          if (!next[key]) next[key] = '9-inch Brick Wall';
        }
      });
      return next;
    });
  }, [floorConfig]);

  // Recalculate Total Travel & Suggested Total Shaft
  useEffect(() => {
    let travelSum = 0;
    let hasValues = false;
    for (let i = 0; i < floorConfig - 1; i++) {
      const val = Number(floorMeasurements[`travel${i}Height`]);
      if (val > 0) {
        travelSum += val;
        hasValues = true;
      }
    }
    if (hasValues) {
      setTotalTravel(String(travelSum));
    }

    const t = Number(totalTravel) || travelSum;
    const p = Number(floorMeasurements['pitHeight']) || Number(pitClient) || 0;
    const h = Number(floorMeasurements['headroomHeight']) || 0;
    if (t > 0 || h > 0) {
      setTotalShaft(String(t + p + h));
    }
  }, [floorMeasurements, floorConfig, totalTravel, pitClient]);

  // Filtered CRM search items
  const filteredCrmItems = useMemo(() => {
    if (!searchQuery.trim()) return crmCustomers.slice(0, 10);
    const q = searchQuery.toLowerCase().trim();
    return crmCustomers
      .filter(
        (c) =>
          c.fullName?.toLowerCase().includes(q) ||
          c.phoneNumber?.includes(q) ||
          c.city?.toLowerCase().includes(q) ||
          c.customerId?.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [crmCustomers, searchQuery]);

  // Handle CRM Customer Autofill selection
  const handleSelectCrmCustomer = (customer: any) => {
    setSelectedCrmItem(customer);
    setIsCrmDropdownOpen(false);
    setSearchQuery('');

    // Autofill Client Name & Phone
    setClientName(customer.fullName || '');
    setClientPhone(customer.phoneNumber || customer.whatsappNumber || '');
    setClientRepName(customer.fullName || '');
    setClientRepPhone(customer.phoneNumber || '');

    // Autofill Region / City
    if (customer.city) {
      const matched = TAMIL_NADU_REGIONS.find((r) =>
        r.toLowerCase().includes(customer.city.toLowerCase())
      );
      if (matched) {
        setRegion(matched);
      } else {
        setRegion(`Tamil Nadu — ${customer.city}`);
      }
    }

    // Find associated Project if any
    const associatedProject = crmProjects.find(
      (p) =>
        (p.customerId?._id && p.customerId._id === customer._id) ||
        p.customerId === customer._id ||
        p.customerCode === customer.customerId
    );

    if (associatedProject) {
      setJobNo(associatedProject.projectId || `ALP-${customer.customerId}`);
      if (associatedProject.liftModel) {
        const foundProduct = PRODUCT_SERIES.find((p) =>
          associatedProject.liftModel.toLowerCase().includes(p.toLowerCase())
        );
        if (foundProduct) setProduct(foundProduct);
      }
      if (associatedProject.numberOfFloors) {
        const match = associatedProject.numberOfFloors.match(/\d+/);
        if (match) {
          const stops = parseInt(match[0], 10);
          if (stops >= 2 && stops <= 7) setFloorConfig(stops);
        }
      }
    } else {
      setJobNo(customer.customerId || `X-${Math.floor(10000 + Math.random() * 90000)}`);
    }

    toast.success(`Autofilled CRM details for ${customer.fullName}!`, {
      icon: '✨',
      style: { borderRadius: '12px', background: '#0F2744', color: '#fff' },
    });
  };

  const handleClearAutofill = () => {
    setSelectedCrmItem(null);
    setClientName('');
    setClientPhone('');
    setJobNo('');
    setRegion('');
    setQuotationNo('');
  };

  // Helper for dynamic floor measurements change
  const handleFloorMeasurementChange = (key: string, value: any) => {
    setFloorMeasurements((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Helper for wall specs change
  const handleWallSpecChange = (key: string, value: string) => {
    setWallSpecs((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  // Helper for attendee update
  const handleAttendeeChange = (index: number, field: string, value: any) => {
    setAttendees((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // Helper to read and optimize image file to standard JPEG base64 for PDF embedding
  const processImageFile = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = (e.target?.result as string) || '';
        if (!file.type.startsWith('image/')) {
          resolve(result);
          return;
        }

        const img = new Image();
        img.onload = () => {
          // Normalize to max 1280px for high-res PDF embedding with compact payload
          const maxDim = 1280;
          let width = img.width;
          let height = img.height;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(result);
            return;
          }

          // Solid white background in case of transparent PNG/alpha
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);

          // Standard high-quality JPEG (0.82)
          const jpegDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          resolve(jpegDataUrl);
        };
        img.onerror = () => resolve(result);
        img.src = result;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  // Handle image file selection & auto compression to base64
  const handlePhotoUpload = async (fieldId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    setProcessingPhotos(true);
    const toastId = toast.loading(`Attaching & preparing ${fileArray.length} photo(s) for PDF...`);

    try {
      const processedUrls: string[] = [];
      for (const file of fileArray) {
        const dataUrl = await processImageFile(file);
        if (dataUrl) {
          processedUrls.push(dataUrl);
        }
      }

      setPhotos((prev) => ({
        ...prev,
        [fieldId]: [...(prev[fieldId] || []), ...processedUrls],
      }));

      toast.success(`Attached ${processedUrls.length} photo(s)! Ready for PDF generation.`, { id: toastId });
    } catch (err: any) {
      console.error('Photo processing error:', err);
      toast.error('Failed to process image file(s)', { id: toastId });
    } finally {
      setProcessingPhotos(false);
    }
  };

  const handleRemovePhoto = (fieldId: string, index: number) => {
    setPhotos((prev) => {
      const list = [...(prev[fieldId] || [])];
      list.splice(index, 1);
      return { ...prev, [fieldId]: list };
    });
  };

  // Handle supporting files & photos in Section 8
  const handleSupportFilesUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files);

    setProcessingPhotos(true);
    const toastId = toast.loading(`Attaching ${fileArray.length} file(s)...`);

    try {
      const newSupportPhotos: Array<{ name: string; dataUrl: string }> = [];
      const newNames: string[] = [];

      for (const file of fileArray) {
        newNames.push(file.name);
        if (file.type.startsWith('image/')) {
          const dataUrl = await processImageFile(file);
          if (dataUrl) {
            newSupportPhotos.push({ name: file.name, dataUrl });
          }
        }
      }

      setSupportFiles((prev) => [...prev, ...newNames]);
      if (newSupportPhotos.length > 0) {
        setSupportPhotos((prev) => [...prev, ...newSupportPhotos]);
      }

      toast.success(`Attached ${fileArray.length} supporting file(s) for PDF report!`, { id: toastId });
    } catch (err) {
      toast.error('Error attaching supporting files', { id: toastId });
    } finally {
      setProcessingPhotos(false);
    }
  };

  // Prepare full form payload
  const getFormData = () => {
    return {
      reportDate,
      region,
      jobNo,
      clientName,
      clientPhone,
      visitCount,
      technician,
      technicianEmail,
      quotationNo,
      automationCode: quotationNo,

      propertyStage,
      installationArea,
      product,
      floorConfig,
      doorClosing,
      clientSignatureType,

      shaftG: Number(shaftG) || undefined,
      shaftA: Number(shaftA) || undefined,
      shaftB: Number(shaftB) || undefined,
      shaftC: Number(shaftC) || undefined,
      shaftAccuracy,
      plasterStatus,

      floorMeasurements,
      totalTravel: Number(totalTravel) || undefined,
      totalShaft: Number(totalShaft) || undefined,
      pitClient: Number(pitClient) || undefined,

      wallSpecifications: wallSpecs,
      attendees,

      clientRepName,
      clientRepPhone,
      timeIn,
      timeOut,
      technicianSignature,
      clientSign,
      remarks,

      photos,
      supportPhotos,
    };
  };

  // Form Validation
  const validateForm = (): string[] => {
    const missing: string[] = [];
    if (!reportDate) missing.push('Report Date');
    if (!region) missing.push('Region / Service Location (Tamil Nadu)');
    if (!jobNo.trim()) missing.push('Job No. / Order Name');
    if (!clientName.trim()) missing.push('Client Name');
    if (!clientPhone.trim()) missing.push('Client Contact Number');
    if (!propertyStage) missing.push('Property Stage');
    if (!installationArea) missing.push('Installation Area');
    if (!product) missing.push('Product Series');
    return missing;
  };

  // Trigger PDF Generation & Direct Download
  const handleGeneratePdf = async (skipValidationCheck = false) => {
    const missing = validateForm();
    if (!skipValidationCheck && missing.length > 0) {
      setMissingFields(missing);
      setValidationModalOpen(true);
      return;
    }

    try {
      setGeneratingPdf(true);
      const data = getFormData();

      toast.loading('Compiling inspection report & generating PDF...', { id: 'pdf-toast' });
      const blob = await api.generateQCPdf(data);

      const downloadUrl = window.URL.createObjectURL(blob);
      setLastGeneratedPdfUrl(downloadUrl);

      const a = document.createElement('a');
      a.href = downloadUrl;
      const cleanJob = (jobNo || 'SITE-REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanName = (clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
      a.download = `Alpha-Elevators-SiteReport-${cleanJob}-${cleanName}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      toast.success('Official Pre-Production PDF generated and downloaded!', {
        id: 'pdf-toast',
        duration: 5000,
      });

      // Also auto-save report to CRM database in background
      api.saveQCReport(data).catch(() => {});
    } catch (err: any) {
      console.error('PDF Generation Error:', err);
      toast.error(`PDF generation error: ${err.message || 'Please try again'}`, { id: 'pdf-toast' });
    } finally {
      setGeneratingPdf(false);
      setValidationModalOpen(false);
    }
  };

  // Save report to database
  const handleSaveReport = async () => {
    try {
      setSavingReport(true);
      const data = getFormData();
      const res = await api.saveQCReport(data);
      toast.success(res.message || 'QC Report saved to Alpha CRM system!');
      if (onSaved) onSaved();
    } catch (err: any) {
      toast.error(err.message || 'Failed to save report');
    } finally {
      setSavingReport(false);
    }
  };

  // Download JSON
  const handleDownloadJson = () => {
    const data = getFormData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `elevator-site-report-${jobNo || 'data'}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success('Form JSON downloaded');
  };

  // Reset form
  const handleReset = () => {
    if (confirm('Are you sure you want to reset all fields in this inspection form?')) {
      setClientName('');
      setClientPhone('');
      setJobNo('');
      setRegion('');
      setRemarks('');
      setSelectedCrmItem(null);
      setPhotos({});
      setSupportPhotos([]);
      setSupportFiles([]);
      toast.success('Form reset to default values');
    }
  };

  // Dynamic floor stops list
  const floorStopsList = useMemo(() => {
    const list = [{ label: 'Pit Height', key: 'pit' }];
    for (let i = 0; i < floorConfig - 1; i++) {
      list.push({
        label: i === 0 ? 'Floor-0 to Floor-1' : `Floor-${i} to Floor-${i + 1}`,
        key: `travel${i}`,
      });
    }
    list.push({ label: 'Headroom / Overhead', key: 'headroom' });
    return list;
  }, [floorConfig]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6 pb-28 text-slate-900 font-sans antialiased">
      {/* ============================================================== */}
      {/* TOP HEADER: Alpha Elevators Pre-Production Site Report */}
      {/* ============================================================== */}
      <div className="bg-gradient-to-br from-[#0F2744] via-[#163861] to-[#1E497C] text-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-sky-950/20 border border-sky-800/40 relative">
        <div className="absolute right-0 top-0 translate-x-8 -translate-y-8 w-64 h-64 bg-sky-500/10 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
          <div className="flex items-center space-x-4">
            <div className="h-16 w-16 sm:h-20 sm:w-20 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20 p-2.5 flex items-center justify-center shrink-0 shadow-lg">
              <img src="/logo.png" alt="Alpha Elevators Logo" className="h-full w-full object-contain" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2 mb-1.5">
                <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-[11px] font-bold tracking-wide uppercase flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  QC Role Active
                </span>
                <span className="px-3 py-1 bg-sky-400/20 text-sky-200 border border-sky-300/30 rounded-full text-[11px] font-semibold">
                  Official Technical Site Inspection
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-black tracking-tight text-white font-poppins">
                Pre-Production Site Report
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 mt-1 max-w-2xl font-normal leading-relaxed">
                Elevator site inspection • Shaft millimeter measurements • Wall specifications • Client confirmation
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 sm:self-center">
            <button
              type="button"
              onClick={() => handleGeneratePdf(false)}
              disabled={generatingPdf}
              className="px-4 py-2.5 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-sky-900/40 active:scale-95 transition-all flex items-center gap-2"
            >
              <Download className={`w-4 h-4 ${generatingPdf ? 'animate-bounce' : ''}`} />
              <span>{generatingPdf ? 'Generating PDF...' : 'Generate PDF'}</span>
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white border border-white/20 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span className="hidden sm:inline">Print / Save PDF</span>
            </button>
          </div>
        </div>

        {/* CRM Quick Autofill Banner */}
        <div className="mt-6 pt-5 border-t border-white/15">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-2xl p-4 border border-sky-500/30">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>CRM Client Data Autofill</span>
                    <span className="text-[10px] bg-sky-500/30 text-sky-200 px-2 py-0.5 rounded-full font-mono">
                      Fast Auto-Fill
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300">
                    Select any client or project from CRM to autofill client name, phone number, city, and job order.
                  </p>
                </div>
              </div>

              {/* CRM Search Popup Button */}
              <button
                id="btn-open-crm-modal"
                type="button"
                onClick={() => {
                  console.log('[QC] Opening CRM client selection modal');
                  setSearchQuery('');
                  setIsCrmModalOpen(true);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-sky-500 via-sky-600 to-blue-600 hover:from-sky-400 hover:to-blue-500 text-white rounded-xl text-xs font-bold shadow-lg shadow-sky-950/60 active:scale-95 transition-all flex items-center justify-center gap-2 border border-sky-400/30 cursor-pointer"
              >
                <Search className="w-4 h-4" />
                <span>{selectedCrmItem ? `Linked: ${selectedCrmItem.fullName} (Change)` : 'Search & Select CRM Client'}</span>
              </button>
            </div>

            {/* Selected CRM Indicator Chip */}
            {selectedCrmItem && (
              <div className="mt-3 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center space-x-2 text-emerald-400 font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    Linked to CRM Client:{' '}
                    <strong className="text-white underline">{selectedCrmItem.fullName}</strong> ({selectedCrmItem.city || 'Tamil Nadu'})
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setIsCrmModalOpen(true);
                    }}
                    className="text-xs text-sky-400 hover:text-sky-300 font-semibold underline"
                  >
                    Change Client
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAutofill}
                    className="text-xs text-rose-400 hover:text-rose-300 font-semibold"
                  >
                    Clear Autofill ✕
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* SECTION 1: Job & Client Details */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            1
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Job & Client Details
            </h2>
            <p className="text-xs text-slate-500">Site location, client contact & technician assignment</p>
          </div>
        </div>

        {/* Section 1 CRM Autofill Banner */}
        <div className="mb-6 p-4 bg-gradient-to-r from-sky-50 via-blue-50/60 to-indigo-50/50 border border-sky-200/90 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0 shadow-md shadow-sky-900/20">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                <span>Auto-Fill Client Data from CRM</span>
                <span className="text-[10px] bg-sky-200/80 text-sky-900 px-2 py-0.5 rounded-full font-bold">
                  {crmCustomers.length} Clients
                </span>
              </div>
              <p className="text-[11px] text-slate-600 mt-0.5">
                {selectedCrmItem ? (
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" />
                    Autofilled from: <strong className="underline">{selectedCrmItem.fullName}</strong> ({selectedCrmItem.city || 'Tamil Nadu'})
                  </span>
                ) : (
                  'Click to search and select any customer from Alpha CRM to instantly populate client name, contact, city, and job order.'
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            {selectedCrmItem && (
              <button
                type="button"
                onClick={handleClearAutofill}
                className="px-3 py-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-rose-200 rounded-xl text-xs font-semibold transition-colors"
              >
                Clear
              </button>
            )}
            <button
              id="btn-open-crm-modal-section1"
              type="button"
              onClick={() => {
                console.log('[QC] Opening CRM modal from section 1');
                setSearchQuery('');
                setIsCrmModalOpen(true);
              }}
              className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-900/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Search className="w-3.5 h-3.5" />
              <span>{selectedCrmItem ? 'Change Client' : 'Search & Select Client'}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Report Date */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-sky-600" />
              <span>Report Date *</span>
            </label>
            <input
              type="date"
              required
              value={reportDate}
              onChange={(e) => setReportDate(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Region / Tamil Nadu City */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-sky-600" />
              <span>Region / Service Location (Tamil Nadu) *</span>
            </label>
            <select
              required
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Select Tamil Nadu region / city</option>
              {TAMIL_NADU_REGIONS.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-slate-400 mt-1 block">Nearest service region in Tamil Nadu.</span>
          </div>

          {/* Job No. / Order Name */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5 text-sky-600" />
                <span>Job No. / Order Name *</span>
              </label>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setIsCrmModalOpen(true);
                }}
                className="text-[10px] text-sky-600 hover:text-sky-700 font-bold hover:underline flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Pick Project</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={jobNo}
              onChange={(e) => setJobNo(e.target.value)}
              placeholder="e.g. X-31183 or ALP-001"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Client Name with Quick Autofill Button */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[11px] font-bold text-slate-700 flex items-center gap-1">
                <User className="w-3.5 h-3.5 text-sky-600" />
                <span>Client Name *</span>
              </label>
              <button
                id="btn-pick-crm-client-name"
                type="button"
                onClick={() => {
                  console.log('[QC] Opening CRM modal from client name field');
                  setSearchQuery('');
                  setIsCrmModalOpen(true);
                }}
                className="text-[10px] text-sky-600 hover:text-sky-700 font-bold hover:underline flex items-center gap-1 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Search CRM</span>
              </button>
            </div>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Customer Full Name"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Client Contact Phone */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5 text-sky-600" />
              <span>Client Contact Number *</span>
            </label>
            <input
              type="tel"
              required
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="+91..."
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Site Visit Count */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Site Visit Count</label>
            <select
              value={visitCount}
              onChange={(e) => setVisitCount(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="1">1 (Initial Visit)</option>
              <option value="2">2 (Follow-up)</option>
              <option value="3">3</option>
              <option value="4">4</option>
              <option value="5+">5+</option>
            </select>
          </div>

          {/* Technician Name */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Technician Name</label>
            <input
              type="text"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              placeholder="Dinesh Kumar S (8232)"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Technician Email */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5 flex items-center gap-1">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>Technician Email ID</span>
            </label>
            <input
              type="email"
              value={technicianEmail}
              onChange={(e) => setTechnicianEmail(e.target.value)}
              placeholder="technician@alphaelevators.com"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {/* Quotation Number */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Quotation Number</label>
            <input
              type="text"
              value={quotationNo}
              onChange={(e) => setQuotationNo(e.target.value)}
              placeholder="e.g. QTN-2026-001"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 2: Property & Elevator Details */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            2
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Property & Elevator Details
            </h2>
            <p className="text-xs text-slate-500">Civil stage, elevator product series & stops configuration</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          {/* Current Stage of Property */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Current Stage of Property *</label>
            <select
              required
              value={propertyStage}
              onChange={(e) => setPropertyStage(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {PROPERTY_STAGES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>

          {/* Installation Area */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Installation Area *</label>
            <select
              required
              value={installationArea}
              onChange={(e) => setInstallationArea(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {INSTALLATION_AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>

          {/* Product Series */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Product Series *</label>
            <select
              required
              value={product}
              onChange={(e) => setProduct(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              {PRODUCT_SERIES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Floor Configuration */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Floor Configuration *</label>
            <select
              required
              value={floorConfig}
              onChange={(e) => setFloorConfig(Number(e.target.value))}
              className="w-full px-3.5 py-2.5 bg-sky-50 border border-sky-300 text-sky-900 rounded-xl font-bold focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="2">G+1 (2 Stops)</option>
              <option value="3">G+2 (3 Stops)</option>
              <option value="4">G+3 (4 Stops)</option>
              <option value="5">G+4 (5 Stops)</option>
              <option value="6">G+5 (6 Stops)</option>
              <option value="7">G+6 (7 Stops)</option>
            </select>
            <span className="text-[10px] text-sky-700 mt-1 block">
              Dynamically updates floor measurements and wall spec tables below.
            </span>
          </div>

          {/* Door Closing Side */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Door Closing Side</label>
            <select
              value={doorClosing}
              onChange={(e) => setDoorClosing(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="LH (Left Hand)">LH (Left Hand)</option>
              <option value="RH (Right Hand)">RH (Right Hand)</option>
              <option value="Not confirmed">Not confirmed</option>
            </select>
          </div>

          {/* Client Confirmation */}
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1.5">Client Confirmation</label>
            <select
              value={clientSignatureType}
              onChange={(e) => setClientSignatureType(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="Confirmed">Confirmed</option>
              <option value="Pending">Pending</option>
              <option value="Online signature">Online signature</option>
            </select>
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 3: Shaft & Floor Measurements */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-4 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            3
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Shaft & Floor Measurements
            </h2>
            <p className="text-xs text-slate-500">Millimeter dimensions, accuracy, doors & travel heights</p>
          </div>
        </div>

        {/* Notice Info Box */}
        <div className="p-3.5 bg-sky-50/80 border border-sky-200 rounded-2xl text-sky-900 text-xs flex items-start gap-2.5 mb-5 leading-relaxed">
          <AlertCircle className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
          <span>
            Enter all dimensions in <strong>millimeters (mm)</strong>. Choose whether each measurement is approximate or
            confirmed. Totals are automatically calculated from the floor measurements; verify all site dimensions
            before production.
          </span>
        </div>

        {/* Shaft Overall Box */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Shaft width — G-Side (mm)</label>
            <input
              type="number"
              min="0"
              value={shaftG}
              onChange={(e) => setShaftG(e.target.value)}
              placeholder="e.g. 1850"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Shaft depth — A-Side (mm)</label>
            <input
              type="number"
              min="0"
              value={shaftA}
              onChange={(e) => setShaftA(e.target.value)}
              placeholder="e.g. 1700"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Shaft B-Side (mm)</label>
            <input
              type="number"
              min="0"
              value={shaftB}
              onChange={(e) => setShaftB(e.target.value)}
              placeholder="mm"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Shaft C-Side (mm)</label>
            <input
              type="number"
              min="0"
              value={shaftC}
              onChange={(e) => setShaftC(e.target.value)}
              placeholder="mm"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Shaft Accuracy</label>
            <select
              value={shaftAccuracy}
              onChange={(e) => setShaftAccuracy(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="Approximate">Approximate</option>
              <option value="Confirmed / Final">Confirmed / Final</option>
              <option value="Pending site completion">Pending site completion</option>
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Includes Plaster?</label>
            <select
              value={plasterStatus}
              onChange={(e) => setPlasterStatus(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 font-medium focus:bg-white focus:ring-2 focus:ring-sky-500"
            >
              <option value="Without plaster">Without plaster</option>
              <option value="With plaster">With plaster</option>
              <option value="Not confirmed">Not confirmed</option>
            </select>
          </div>
        </div>

        {/* ============================================================== */}
        {/* MOBILE VIEW vs DESKTOP VIEW FOR MEASUREMENTS */}
        {/* ============================================================== */}
        <div className="block lg:hidden mb-4">
          <div className="flex items-center justify-between text-xs font-bold text-slate-700 mb-2">
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-4 h-4 text-sky-600" />
              <span>Mobile Floor Selector ({floorStopsList.length} sections)</span>
            </span>
            <span className="text-[10px] text-sky-600 font-normal">Tap tab to inspect</span>
          </div>

          {/* Interactive Mobile Tabs */}
          <div className="flex space-x-1 overflow-x-auto pb-2 scrollbar-thin">
            {floorStopsList.map((m, idx) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setActiveFloorTab(idx)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  activeFloorTab === idx
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-900/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Active Mobile Floor Card */}
          {floorStopsList[activeFloorTab] && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-3 mt-2 animate-fade-in text-xs">
              <div className="font-bold text-sky-900 flex items-center justify-between border-b border-slate-200 pb-2">
                <span>{floorStopsList[activeFloorTab].label}</span>
                <span className="text-[10px] bg-sky-200/60 text-sky-800 px-2 py-0.5 rounded-full font-mono">
                  {activeFloorTab + 1} of {floorStopsList.length}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Height (mm)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="Height in mm"
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}Height`] || ''}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}Height`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Measurement Accuracy</label>
                  <select
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}Accuracy`] || 'Approximate'}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}Accuracy`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  >
                    {ACCURACY_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Door Opening Side</label>
                  <select
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}DoorSide`] || 'A'}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}DoorSide`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  >
                    {SIDE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Door-1 Hinges</label>
                  <select
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}Door1Hinge`] || 'LH (Left Hand)'}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}Door1Hinge`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  >
                    {HINGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Door-2 Hinges</label>
                  <select
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}Door2Hinge`] || 'Not applicable'}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}Door2Hinge`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  >
                    {HINGE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Door-1 DO (mm)</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="e.g. 700"
                    value={floorMeasurements[`${floorStopsList[activeFloorTab].key}Door1DO`] || ''}
                    onChange={(e) =>
                      handleFloorMeasurementChange(`${floorStopsList[activeFloorTab].key}Door1DO`, e.target.value)
                    }
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Desktop / Full Tablet Transposed Measurements Table */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs text-left border-collapse min-w-[700px]">
            <thead>
              <tr className="bg-[#12243E] text-white">
                <th className="p-3 font-bold border-b border-slate-700 w-44">Measurement Detail</th>
                {floorStopsList.map((m) => (
                  <th key={m.key} className="p-3 font-bold border-b border-slate-700 text-center">
                    {m.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {/* Row 1: Height */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Height (mm)</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <input
                      type="number"
                      min="0"
                      value={floorMeasurements[`${m.key}Height`] || ''}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Height`, e.target.value)}
                      placeholder="mm"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-bold text-slate-900 focus:ring-2 focus:ring-sky-500"
                    />
                  </td>
                ))}
              </tr>

              {/* Row 2: Accuracy */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Measurement Accuracy</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <select
                      value={floorMeasurements[`${m.key}Accuracy`] || 'Approximate'}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Accuracy`, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      {ACCURACY_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Row 3: Door Opening Side */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Door Opening Side</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <select
                      value={floorMeasurements[`${m.key}DoorSide`] || 'A'}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}DoorSide`, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      {SIDE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Row 4: Door-1 Hinges */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Door-1 Hinges</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <select
                      value={floorMeasurements[`${m.key}Door1Hinge`] || 'LH (Left Hand)'}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Door1Hinge`, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      {HINGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Row 5: Door-2 Hinges */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Door-2 Hinges</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <select
                      value={floorMeasurements[`${m.key}Door2Hinge`] || 'Not applicable'}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Door2Hinge`, e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                    >
                      {HINGE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  </td>
                ))}
              </tr>

              {/* Row 6: Door-1 DO */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Door-1 DO (mm)</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <input
                      type="number"
                      min="0"
                      value={floorMeasurements[`${m.key}Door1DO`] || ''}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Door1DO`, e.target.value)}
                      placeholder="mm"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-medium"
                    />
                  </td>
                ))}
              </tr>

              {/* Row 7: Door-2 DO */}
              <tr className="hover:bg-slate-50/70">
                <th className="p-2.5 font-bold text-slate-800 bg-slate-50/80">Door-2 DO (mm)</th>
                {floorStopsList.map((m) => (
                  <td key={m.key} className="p-2">
                    <input
                      type="number"
                      min="0"
                      value={floorMeasurements[`${m.key}Door2DO`] || ''}
                      onChange={(e) => handleFloorMeasurementChange(`${m.key}Door2DO`, e.target.value)}
                      placeholder="mm"
                      className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-center font-medium"
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        {/* Calculated Totals Box */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-5 p-4 bg-emerald-50/80 border border-emerald-200 rounded-2xl text-xs">
          <div>
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">
              Total Travel (mm) — Auto-calculated
            </label>
            <input
              type="number"
              min="0"
              value={totalTravel}
              onChange={(e) => setTotalTravel(e.target.value)}
              placeholder="Total travel height"
              className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-bold text-emerald-950"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">Total Shaft Height (mm)</label>
            <input
              type="number"
              min="0"
              value={totalShaft}
              onChange={(e) => setTotalShaft(e.target.value)}
              placeholder="Suggested total shaft"
              className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-bold text-emerald-950"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-emerald-900 mb-1">
              Pit Height Client Will Provide (mm)
            </label>
            <input
              type="number"
              min="0"
              value={pitClient}
              onChange={(e) => setPitClient(e.target.value)}
              placeholder="e.g. 300"
              className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-xl font-bold text-emerald-950"
            />
          </div>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 4: Shaft Wall Construction Specifications */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-4 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            4
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Shaft Wall Construction Specifications
            </h2>
            <p className="text-xs text-slate-500">Wall material/structure client agrees to provide per side and floor</p>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="w-full text-xs text-left border-collapse min-w-[650px]">
            <thead>
              <tr className="bg-[#12243E] text-white">
                <th className="p-3 font-bold border-b border-slate-700 w-36">Wall Side</th>
                {Array.from({ length: floorConfig }, (_, i) => (
                  <th key={i} className="p-3 font-bold border-b border-slate-700 text-center">
                    {i === 0 ? 'Floor "0"' : `Floor "${i}"`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {['G', 'A', 'B', 'C'].map((side) => {
                const sideName: Record<string, string> = {
                  G: 'G-Side (Front/Door)',
                  A: 'A-Side (Back)',
                  B: 'B-Side (Right)',
                  C: 'C-Side (Left)',
                };
                return (
                  <tr key={side} className="hover:bg-slate-50/70">
                    <th className="p-3 font-bold text-slate-800 bg-slate-50/80">{sideName[side]}</th>
                    {Array.from({ length: floorConfig }, (_, i) => {
                      const key = `wallFloor${i}${side}`;
                      return (
                        <td key={i} className="p-2">
                          <select
                            value={wallSpecs[key] || '9-inch Brick Wall'}
                            onChange={(e) => handleWallSpecChange(key, e.target.value)}
                            className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                          >
                            {WALL_OPTIONS.map((w) => (
                              <option key={w} value={w}>
                                {w}
                              </option>
                            ))}
                          </select>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 5: Attendees During Site Visit */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            5
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Attendees During Site Visit
            </h2>
            <p className="text-xs text-slate-500">Record attendance, designated representatives & contact numbers</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          {attendees.map((attendee, idx) => (
            <div
              key={attendee.role}
              className={`p-3.5 rounded-2xl border transition-all ${
                attendee.present
                  ? 'bg-sky-50/60 border-sky-300 shadow-sm'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              <label className="flex items-center space-x-2.5 font-bold text-slate-800 cursor-pointer mb-2.5 select-none">
                <input
                  type="checkbox"
                  checked={attendee.present}
                  onChange={(e) => handleAttendeeChange(idx, 'present', e.target.checked)}
                  className="w-4 h-4 text-sky-600 rounded focus:ring-sky-500 border-slate-300"
                />
                <span className={attendee.present ? 'text-sky-900 font-bold' : 'text-slate-600'}>
                  {attendee.role}
                </span>
              </label>

              <div className="grid grid-cols-2 gap-2 mt-2">
                <input
                  type="text"
                  placeholder="Name"
                  value={attendee.name}
                  onChange={(e) => handleAttendeeChange(idx, 'name', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
                <input
                  type="tel"
                  placeholder="Contact no."
                  value={attendee.phone}
                  onChange={(e) => handleAttendeeChange(idx, 'phone', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 6: Remarks & Site Confirmation */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-5 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            6
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Remarks & Site Confirmation
            </h2>
            <p className="text-xs text-slate-500">Civil commitments, inspection timings & client signatures</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Client / Rep Name</label>
            <input
              type="text"
              value={clientRepName}
              onChange={(e) => setClientRepName(e.target.value)}
              placeholder="Representative name"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Client / Rep Phone</label>
            <input
              type="tel"
              value={clientRepPhone}
              onChange={(e) => setClientRepPhone(e.target.value)}
              placeholder="Phone number"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Time In</label>
            <input
              type="time"
              value={timeIn}
              onChange={(e) => setTimeIn(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Time Out</label>
            <input
              type="time"
              value={timeOut}
              onChange={(e) => setTimeOut(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs mb-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Technician Signature / Name</label>
            <input
              type="text"
              value={technicianSignature}
              onChange={(e) => setTechnicianSignature(e.target.value)}
              placeholder="Type technician name for confirmation"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">Client Signature / Confirmation Name</label>
            <input
              type="text"
              value={clientSign}
              onChange={(e) => setClientSign(e.target.value)}
              placeholder="Type name or confirmed by owner"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="block text-[11px] font-bold text-slate-700 mb-1.5">
            Remarks / Pending Work / Client Commitments
          </label>
          <textarea
            rows={3}
            value={remarks}
            onChange={(e) => setRemarks(e.target.value)}
            placeholder="Enter site observations, pending civil work, door opening details, electrical points, pit requirements, etc."
            className="w-full p-3 bg-slate-50 border border-slate-200 rounded-2xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
          ></textarea>
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 7: Photos of Current Building (Required Views) */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-4 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            7
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Photos of Current Building (Site Inspection)
            </h2>
            <p className="text-xs text-slate-500">Upload site photos for each required technical angle</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
          {[
            { id: 'photoOutside', label: '1. Outside from property *' },
            { id: 'photoGroundFloor', label: '2. From ground floor *' },
            { id: 'photoAllLandings', label: '3. All Landing Floor *' },
            { id: 'photoPit', label: '4. Showing the pit *' },
            { id: 'photoShaftTop', label: '5. Inside shaft top view *' },
            { id: 'photoShaftDown', label: '6. Top shaft down view *' },
            { id: 'photoPowerPack', label: '7. Power Pack Area *' },
            { id: 'videoObstacles', label: '8. Video of obstacles *', isVideo: true },
          ].map((item) => (
            <div key={item.id} className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-2xl space-y-2">
              <label className="block text-[11px] font-bold text-slate-800 flex items-center justify-between">
                <span>{item.label}</span>
                {item.isVideo ? (
                  <Video className="w-3.5 h-3.5 text-rose-500" />
                ) : (
                  <Camera className="w-3.5 h-3.5 text-sky-600" />
                )}
              </label>

              <label className="flex flex-col items-center justify-center p-3 border-2 border-dashed border-slate-300 rounded-xl hover:border-sky-500 hover:bg-sky-50/40 transition-colors cursor-pointer text-center relative overflow-hidden">
                {processingPhotos && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
                    <span className="text-[10px] text-sky-600 font-bold animate-pulse">Processing...</span>
                  </div>
                )}
                <UploadCloud className="w-5 h-5 text-slate-400 mb-1" />
                <span className="text-[11px] font-semibold text-slate-600">Choose photo(s)</span>
                <span className="text-[9px] text-slate-400">or take picture</span>
                <input
                  type="file"
                  accept={item.isVideo ? 'video/*,image/*' : 'image/*'}
                  multiple
                  capture="environment"
                  onChange={(e) => handlePhotoUpload(item.id, e.target.files)}
                  className="hidden"
                />
              </label>

              {/* Thumbnails preview */}
              {photos[item.id] && photos[item.id].length > 0 && (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="text-emerald-700 font-bold bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                      ✓ {photos[item.id].length} in PDF
                    </span>
                    <span className="text-[9px] text-slate-400">Embedded</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {photos[item.id].map((url, pIdx) => (
                      <div key={pIdx} className="relative group w-14 h-14 rounded-lg overflow-hidden border border-slate-200 shadow-xs">
                        <img src={url} alt="Site" className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleRemovePhoto(item.id, pIdx)}
                          className="absolute inset-0 bg-rose-900/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-bold text-xs"
                          title="Remove Photo"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ============================================================== */}
      {/* SECTION 8: Supporting Photos & Documents */}
      {/* ============================================================== */}
      <section className="bg-white rounded-3xl p-6 sm:p-7 border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center space-x-3 mb-4 border-b border-slate-100 pb-4">
          <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 font-bold flex items-center justify-center text-sm shadow-inner">
            8
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 font-poppins">
              Supporting Photos & Technical Documents
            </h2>
            <p className="text-xs text-slate-500">Upload additional drawing sketches, CAD markups or site agreements (embeds photos into PDF)</p>
          </div>
        </div>

        <label className="flex flex-col items-center justify-center p-6 border-2 border-dashed border-slate-300 rounded-2xl hover:border-sky-500 hover:bg-sky-50/30 transition-colors cursor-pointer text-center relative overflow-hidden">
          {processingPhotos && (
            <div className="absolute inset-0 bg-white/80 backdrop-blur-xs flex items-center justify-center z-10">
              <span className="text-xs text-sky-600 font-bold animate-pulse">Processing file(s)...</span>
            </div>
          )}
          <FileText className="w-8 h-8 text-sky-500 mb-2" />
          <span className="text-xs font-bold text-slate-700">Upload site drawings, PDFs or extra photos</span>
          <span className="text-[11px] text-slate-400 mt-0.5">Select multiple files (PNG, JPG, PDF)</span>
          <input
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            multiple
            onChange={(e) => handleSupportFilesUpload(e.target.files)}
            className="hidden"
          />
        </label>

        {supportFiles.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            {supportFiles.map((name, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-full text-slate-700 text-[11px]"
              >
                <FileCheck2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setSupportFiles((prev) => prev.filter((_, i) => i !== idx));
                    setSupportPhotos((prev) => prev.filter((p) => p.name !== name));
                  }}
                  className="text-slate-400 hover:text-rose-500"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </section>

      {/* ============================================================== */}
      {/* FLOATING ACTION BAR: Fixed Bottom for Desktop & Phone View */}
      {/* ============================================================== */}
      <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-200/90 shadow-2xl py-3 px-4 sm:px-8">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
            <div className="text-xs">
              <span className="font-bold text-slate-800">Job: </span>
              <span className="font-mono text-sky-700">{jobNo || 'Draft'}</span>
              <span className="text-slate-400 mx-1.5">•</span>
              <span className="text-slate-600">{clientName || 'Client Not Selected'}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadJson}
              className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-all flex items-center gap-1"
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Download JSON</span>
            </button>

            <button
              type="button"
              onClick={handleSaveReport}
              disabled={savingReport}
              className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95 disabled:opacity-50 flex items-center gap-1.5"
            >
              <Check className="w-3.5 h-3.5 text-emerald-400" />
              <span>{savingReport ? 'Saving...' : 'Save to CRM'}</span>
            </button>

            <button
              type="button"
              onClick={() => handleGeneratePdf(false)}
              disabled={generatingPdf}
              className="px-5 py-2.5 bg-gradient-to-r from-blue-600 via-sky-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-xl text-xs sm:text-sm font-bold shadow-lg shadow-sky-900/30 active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Download className={`w-4 h-4 ${generatingPdf ? 'animate-bounce' : ''}`} />
              <span>{generatingPdf ? 'Generating PDF...' : 'Generate Official PDF'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VALIDATION WARNING MODAL */}
      {/* ============================================================== */}
      {validationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-100 flex items-center justify-center shrink-0">
                <AlertCircle className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Incomplete Required Fields</h3>
                <p className="text-xs text-slate-500">Please review before generating official report</p>
              </div>
            </div>

            <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3 text-xs space-y-1 max-h-48 overflow-y-auto">
              <span className="font-semibold text-amber-900 block mb-1">Missing required fields:</span>
              {missingFields.map((field) => (
                <div key={field} className="text-amber-800 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-500"></span>
                  <span>{field}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setValidationModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold"
              >
                Fill Missing Fields
              </button>
              <button
                type="button"
                onClick={() => handleGeneratePdf(true)}
                className="px-4 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-xl text-xs font-bold shadow-md shadow-sky-900/20"
              >
                Generate Draft PDF Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* CRM CLIENT SEARCH POPUP MODAL: Always 100% visible, centered, unclipped */}
      {/* ============================================================== */}
      {isCrmModalOpen && (
        <div
          id="crm-client-modal"
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-sm animate-fade-in"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsCrmModalOpen(false);
          }}
        >
          <div className="bg-white rounded-3xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 sm:p-5 bg-gradient-to-r from-[#0F2744] to-[#1A3A60] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 border border-sky-400/30 text-sky-300 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-poppins">Select Client from CRM</h3>
                  <p className="text-[11px] text-slate-300">
                    Click any client to autofill name, phone, city & order details
                  </p>
                </div>
              </div>
              <button
                id="btn-close-crm-modal"
                type="button"
                onClick={() => setIsCrmModalOpen(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Search Input Bar */}
            <div className="p-4 bg-slate-50 border-b border-slate-200 shrink-0 space-y-2">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  id="crm-search-input"
                  ref={searchInputRef}
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by client name, city, phone or ID (e.g. Ashiqur, Chennai, 98200)..."
                  className="w-full pl-9 pr-9 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-sky-500 shadow-sm"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Quick filter city pills */}
              <div className="flex items-center space-x-1.5 overflow-x-auto text-[11px] pb-1">
                <span className="text-slate-500 text-[10px] font-bold uppercase mr-1 shrink-0">Quick Filter:</span>
                {['All', 'Chennai', 'Coimbatore', 'Madurai', 'Salem'].map((city) => (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSearchQuery(city === 'All' ? '' : city)}
                    className={`px-2.5 py-1 rounded-lg font-semibold whitespace-nowrap transition-all ${
                      (city === 'All' && !searchQuery) || searchQuery.toLowerCase() === city.toLowerCase()
                        ? 'bg-sky-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {city}
                  </button>
                ))}
              </div>
            </div>

            {/* Client List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-100">
              {filteredCrmItems.length === 0 ? (
                <div className="py-12 text-center space-y-2">
                  <User className="w-10 h-10 text-slate-300 mx-auto" />
                  <div className="text-sm font-bold text-slate-700">No matching clients found</div>
                  <p className="text-xs text-slate-400 max-w-xs mx-auto">
                    No CRM client found matching "{searchQuery}". You can type details manually in the form.
                  </p>
                </div>
              ) : (
                filteredCrmItems.map((cust) => {
                  const associatedProject = crmProjects.find(
                    (p) =>
                      (p.customerId?._id && p.customerId._id === cust._id) ||
                      p.customerId === cust._id ||
                      p.customerCode === cust.customerId
                  );

                  return (
                    <button
                      id={`btn-select-client-${cust.customerId || cust._id}`}
                      key={cust._id}
                      type="button"
                      onClick={() => {
                        handleSelectCrmCustomer(cust);
                        setIsCrmModalOpen(false);
                      }}
                      className="w-full text-left p-3.5 hover:bg-sky-50/80 rounded-2xl border border-transparent hover:border-sky-200 transition-all flex items-center justify-between group cursor-pointer"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <span className="text-sm font-bold text-slate-900 group-hover:text-sky-700">
                            {cust.fullName}
                          </span>
                          {cust.customerId && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200">
                              {cust.customerId}
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            <span>{cust.phoneNumber || cust.whatsappNumber}</span>
                          </span>

                          <span className="flex items-center gap-1 font-semibold text-sky-700 bg-sky-100/60 px-2 py-0.5 rounded-md text-[11px]">
                            <MapPin className="w-3 h-3 text-sky-600" />
                            <span>{cust.city || 'Tamil Nadu'}</span>
                          </span>

                          {associatedProject && (
                            <span className="text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md text-[11px] border border-emerald-200">
                              Job: {associatedProject.projectId} ({associatedProject.liftModel || 'Elevator'})
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center space-x-1.5 text-xs font-bold text-sky-600 group-hover:text-sky-700 shrink-0">
                        <span className="hidden sm:inline">Select & Autofill</span>
                        <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
              <span>Showing {filteredCrmItems.length} of {crmCustomers.length} clients</span>
              <button
                type="button"
                onClick={() => setIsCrmModalOpen(false)}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
