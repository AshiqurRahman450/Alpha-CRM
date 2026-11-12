'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Download,
  Printer,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FileText,
  Sparkles,
  Layers,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  CheckCircle2,
  Loader2,
  UploadCloud,
  FileUp,
  FileCheck,
  X,
  FileSpreadsheet,
  Edit3,
  Save,
  RotateCcw,
  Check,
  Send,
  Phone,
  UserCheck,
  ShieldAlert,
  Award,
  Search,
  ExternalLink,
  HelpCircle,
  CheckCircle,
  Briefcase,
} from 'lucide-react';
import { api, getStoredUser } from '../../lib/api';
import { QuotationData, DEFAULT_QUOTATION_DATA } from '../../types/quotation';
import QuotationLivePdf from '../../components/quotation/QuotationLivePdf';
import UploadedPdfLiveView from '../../components/quotation/UploadedPdfLiveView';
import QuotationForm from '../../components/quotation/QuotationForm';
import { renderUploadedPdfPages, DetectedTextMatch } from '../../lib/pdfRenderer';
import toast from 'react-hot-toast';

export default function QuotationCreatorPage() {
  const router = useRouter();
  const [data, setData] = useState<QuotationData>(DEFAULT_QUOTATION_DATA);
  const [activePage, setActivePage] = useState<number | null>(null); // null = all pages
  const [scale, setScale] = useState<number>(0.72);
  const [customers, setCustomers] = useState<any[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<string>('');
  const [currentUser, setCurrentUser] = useState<any>(null);

  // PDF Upload & Rendering State
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [uploadedPageImages, setUploadedPageImages] = useState<string[]>([]);
  const [uploadedMatches, setUploadedMatches] = useState<DetectedTextMatch[]>([]);
  const [isRenderingPdf, setIsRenderingPdf] = useState(false);
  const [previewSource, setPreviewSource] = useState<'uploaded' | 'template'>('template');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // In-place live PDF editing state & persistent overrides
  const [isPdfEditing, setIsPdfEditing] = useState(false);
  const [savedCustomPages, setSavedCustomPages] = useState<{ [pageNum: number]: string }>({});

  // 3-Stage Quotation Lifecycle State
  const [currentStage, setCurrentStage] = useState<1 | 2 | 3>(1);
  const [isStagePanelOpen, setIsStagePanelOpen] = useState<boolean>(true);
  const [lookupOfferNo, setLookupOfferNo] = useState<string>('');
  const [isSearchingOffer, setIsSearchingOffer] = useState<boolean>(false);
  const [stageHistory, setStageHistory] = useState<any[]>([]);

  // WhatsApp Send Modal State
  const [showWhatsAppModal, setShowWhatsAppModal] = useState<boolean>(false);
  const [whatsAppPhone, setWhatsAppPhone] = useState<string>('');
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState<boolean>(false);

  // Save Stage State
  const [isSavingStage, setIsSavingStage] = useState<boolean>(false);

  // Finalize Stage State
  const [isFinalizingStage, setIsFinalizingStage] = useState<boolean>(false);

  // CRM Approval State
  const [showCrmApproveModal, setShowCrmApproveModal] = useState<boolean>(false);
  const [isCrmApproving, setIsCrmApproving] = useState<boolean>(false);
  const [crmApproveResult, setCrmApproveResult] = useState<any>(null);
  const [approvalRequested, setApprovalRequested] = useState<boolean>(false);

  // Live PDF Document Preview Visibility (Hide / Unhide Full Screen Form)
  const [showPdfPreview, setShowPdfPreview] = useState<boolean>(true);

  // Mobile Phone Responsive View ('form' | 'preview')
  const [mobileTab, setMobileTab] = useState<'form' | 'preview'>('form');
  const [showMobileTools, setShowMobileTools] = useState<boolean>(false);

  // Auto-fit PDF preview scale dynamically to phone / tablet / desktop screen
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const updateResponsiveScale = () => {
        if (window.innerWidth < 640) {
          // Mobile Phone (360px - 480px width): fit full width inside phone screen
          const fit = Math.max(0.35, Math.min(0.60, (window.innerWidth - 24) / 793.28));
          setScale(Number(fit.toFixed(2)));
        } else if (window.innerWidth < 1024) {
          // Tablet
          setScale(0.55);
        } else {
          // Desktop split view
          setScale(0.72);
        }
      };
      updateResponsiveScale();
      window.addEventListener('resize', updateResponsiveScale);
      return () => window.removeEventListener('resize', updateResponsiveScale);
    }
  }, []);

  // Excel Export Modal State
  const [showExcelModal, setShowExcelModal] = useState<boolean>(false);
  const [excelOfferNo, setExcelOfferNo] = useState<string>('');

  const getBaseOfferNo = (raw: string): string => {
    if (!raw) return 'AE/QTN/AE-261026-131';
    return raw.replace(/-[123]$/, '').trim();
  };

  const getSuffixedOfferNo = (raw: string, stage: 1 | 2 | 3): string => {
    const base = getBaseOfferNo(raw);
    return `${base}-${stage}`;
  };

  // Switch Stage
  const handleStageSwitch = async (newStage: 1 | 2 | 3) => {
    setCurrentStage(newStage);
    const newOfferNo = getSuffixedOfferNo(data.offerNo, newStage);

    // If moving to Stage 2 or 3, attempt to load previous stage data
    if (newStage === 2 || newStage === 3) {
      const prevStage = newStage === 2 ? 1 : 2;
      try {
        const res = await api.quotations.getByOfferNo(data.offerNo, prevStage);
        if (res?.success && res.data?.data) {
          setData({
            ...res.data.data,
            offerNo: newOfferNo,
          });
          if (res.data.customerPhone) setWhatsAppPhone(res.data.customerPhone);
          toast.success(`Switched to Stage ${newStage}! Auto-filled details from Stage ${prevStage}.`);
          return;
        }
      } catch (e) {
        // Fallback to changing offerNo suffix
      }
    }

    setData((prev) => ({
      ...prev,
      offerNo: newOfferNo,
    }));
    toast.success(`Stage ${newStage} active (${newOfferNo})`);
  };

  // Lookup / Auto-fill from Entered Offer Number
  const handleLookupOffer = async () => {
    const target = (lookupOfferNo || data.offerNo).trim();
    if (!target) {
      toast.error('Please enter an offer number to look up');
      return;
    }

    setIsSearchingOffer(true);
    try {
      // 1. Fetch stage history
      const historyRes = await api.quotations.getStageHistory(target);
      if (historyRes?.success && Array.isArray(historyRes.data) && historyRes.data.length > 0) {
        setStageHistory(historyRes.data);
        const prevStage = currentStage === 3 ? 2 : currentStage === 2 ? 1 : 1;
        let match =
          historyRes.data.find((s: any) => s.stage === prevStage) ||
          historyRes.data.find((s: any) => s.stage === currentStage) ||
          historyRes.data[historyRes.data.length - 1];

        if (match && match.data) {
          const newOfferNo = getSuffixedOfferNo(target, currentStage);
          setData({
            ...match.data,
            offerNo: newOfferNo,
          });
          if (match.customerPhone) {
            setWhatsAppPhone(match.customerPhone);
          }
          toast.success(
            `Loaded Stage ${match.stage} data for ${match.customerName || 'customer'}! Form set to Stage ${currentStage} (${newOfferNo})`
          );
          return;
        }
      }

      // 2. Direct lookup
      const res = await api.quotations.getByOfferNo(target);
      if (res?.success && res.data?.data) {
        const newOfferNo = getSuffixedOfferNo(target, currentStage);
        setData({
          ...res.data.data,
          offerNo: newOfferNo,
        });
        if (res.data.customerPhone) {
          setWhatsAppPhone(res.data.customerPhone);
        }
        toast.success(`Loaded quotation ${target}! Form updated for Stage ${currentStage}.`);
      } else {
        toast.error(`No quotation record found for "${target}".`);
      }
    } catch (err: any) {
      toast.error(`Lookup error: ${err.message || 'Could not find quotation'}`);
    } finally {
      setIsSearchingOffer(false);
    }
  };

  // Finalize Current Stage
  const handleFinalizeCurrentStage = async () => {
    setIsFinalizingStage(true);
    try {
      const finalOfferNo = getSuffixedOfferNo(data.offerNo, currentStage);
      const updatedData = { ...data, offerNo: finalOfferNo };
      setData(updatedData);

      const res = await api.quotations.finalizeStage({
        offerNo: finalOfferNo,
        stage: currentStage,
        data: updatedData,
        customerPhone: whatsAppPhone || data.customerPhone,
      });

      if (res?.success) {
        toast.success(
          `Stage ${currentStage} Finalized! Offer No updated: ${finalOfferNo}. Data submitted for CRM review.`,
          { duration: 5000 }
        );
        api.quotations.getStageHistory(finalOfferNo).then((hRes: any) => {
          if (hRes?.data) setStageHistory(hRes.data);
        });
      } else {
        toast.error(res?.message || 'Failed to finalize stage');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error finalizing quotation stage');
    } finally {
      setIsFinalizingStage(false);
    }
  };

  // Save Current Stage Draft / Progress to BDM Pipeline
  const handleSaveCurrentStage = async () => {
    setIsSavingStage(true);
    try {
      const finalOfferNo = getSuffixedOfferNo(data.offerNo, currentStage);
      const updatedData = { ...data, offerNo: finalOfferNo };
      setData(updatedData);

      const res = await api.quotations.saveStage({
        baseOfferNo: getBaseOfferNo(finalOfferNo),
        offerNo: finalOfferNo,
        stage: currentStage,
        data: updatedData,
        customerName: data.clientName || 'Valued Customer',
        customerPhone: whatsAppPhone || data.customerPhone || data.representativePhone || '',
        customerCity: data.projectCity || '',
        status: 'DRAFT',
      });

      if (res?.success) {
        toast.success(`Stage ${currentStage} progress saved to BDM Pipeline! (${finalOfferNo})`);
        api.quotations.getStageHistory(finalOfferNo).then((hRes: any) => {
          if (hRes?.data) setStageHistory(hRes.data);
        });
      } else {
        toast.error(res?.message || 'Failed to save stage');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving quotation stage');
    } finally {
      setIsSavingStage(false);
    }
  };

  // Send WhatsApp to Customer with PDF attached
  const handleSendWhatsApp = async () => {
    const phone = (whatsAppPhone || data.customerPhone || '').trim();
    if (!phone || phone.length < 10) {
      toast.error('Please enter a valid 10-digit WhatsApp number');
      return;
    }

    setIsSendingWhatsApp(true);
    const toastId = toast.loading('Preparing quotation PDF attachment...');
    try {
      const finalOfferNo = getSuffixedOfferNo(data.offerNo, currentStage);

      // 1. Generate client-side PDF document snapshot
      let pdfBase64: string | undefined = undefined;
      const previousScale = scale;
      const previousActivePage = activePage;

      try {
        if (activePage !== null) setActivePage(null);
        setScale(1.0);
        await new Promise((r) => setTimeout(r, 200));

        const { jsPDF } = await import('jspdf');
        const html2canvas = (await import('html2canvas')).default;
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4', compress: true });
        const totalPages = previewSource === 'uploaded' && uploadedPageImages.length > 0
          ? uploadedPageImages.length
          : (data.templateType === 'circle' ? 5 : 11);

        for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
          const pageEl = document.getElementById(`quotation-page-${pageNum}`);
          if (pageEl) {
            const canvas = await html2canvas(pageEl, {
              scale: 1.5,
              useCORS: true,
              allowTaint: true,
              logging: false,
              backgroundColor: '#ffffff',
            });
            const imgData = canvas.toDataURL('image/png');
            if (pageNum > 1) pdf.addPage('a4', 'p');
            pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
          }
        }
        pdfBase64 = pdf.output('datauristring');
      } catch (renderErr: any) {
        console.warn('Client-side PDF render fallback to server-side PDFKit generator:', renderErr.message);
      } finally {
        setScale(previousScale);
        if (previousActivePage !== null) setActivePage(previousActivePage);
      }

      toast.loading(`Dispatching Stage ${currentStage} PDF to WhatsApp (+${phone})...`, { id: toastId });

      // 2. Dispatch to backend which attaches PDF directly via WhatsApp Web Bot or WATI
      const res = await api.quotations.sendWhatsApp({
        offerNo: finalOfferNo,
        stage: currentStage,
        customerPhone: phone,
        customerName: data.clientName,
        pdfBase64,
        data,
      });

      if (res?.success) {
        if (res.botSent) {
          toast.success(`Quotation PDF attached and sent directly to +${res.phone} via WhatsApp!`, { id: toastId, duration: 5000 });
        } else {
          toast.success('Quotation PDF attached! WhatsApp link generated with PDF download.', { id: toastId, duration: 5000 });
          if (res.directWaUrl) {
            window.open(res.directWaUrl, '_blank');
          }
        }
        setShowWhatsAppModal(false);
      } else {
        toast.error(res?.message || 'WhatsApp dispatch failed', { id: toastId });
      }
    } catch (err: any) {
      toast.error(err.message || 'WhatsApp sending failed', { id: toastId });
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  // CRM Approve (Stage 3) / BDM Request Approval
  const handleCrmApprove = async () => {
    setIsCrmApproving(true);
    try {
      const finalOfferNo = getSuffixedOfferNo(data.offerNo, 3);
      const isBdm = currentUser?.role === 'BDM';

      if (isBdm) {
        const res = await api.quotations.requestApproval({
          offerNo: finalOfferNo,
          bdmId: currentUser?.id || currentUser?._id,
          bdmName: currentUser?.name,
          bdmPhone: currentUser?.phone,
        });

        if (res?.success) {
          setApprovalRequested(true);
          toast.success(
            'Stage 3 Approval Request sent to CRM & Admin! The Customer and Project will be auto-created once approved on Reminders.',
            { duration: 6000 }
          );
        } else {
          toast.error(res?.message || 'Failed to submit approval request');
        }
      } else {
        const res = await api.quotations.crmApprove({
          offerNo: finalOfferNo,
        });

        if (res?.success) {
          if (res.requestSent) {
            setApprovalRequested(true);
            toast.success('Approval request sent to CRM & Admin on Reminders!');
          } else {
            setCrmApproveResult(res);
            setShowCrmApproveModal(true);
            toast.success('Stage 3 Approved! New Customer and Project successfully created in CRM.');
          }
        } else {
          toast.error(res?.message || 'Failed to approve quotation on CRM');
        }
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setIsCrmApproving(false);
    }
  };

  // Export Excel
  const handleExportExcel = (targetOffer?: string) => {
    const offer = (targetOffer || excelOfferNo || data.offerNo).trim();
    if (!offer) {
      toast.error('Please enter an offer number to export');
      return;
    }
    const url = api.quotations.getExportExcelUrl(offer);
    window.open(url, '_blank');
    toast.success(`Exporting stage-wise comparison for ${offer}...`);
    setShowExcelModal(false);
  };

  useEffect(() => {
    try {
      const key = data.templateType === 'circle'
        ? `alpha_pdf_edits_circle_${data.offerNo || 'default'}`
        : `alpha_pdf_edits_${data.offerNo || 'default'}`;
      const stored = localStorage.getItem(key);
      if (stored) {
        setSavedCustomPages(JSON.parse(stored));
      } else {
        setSavedCustomPages({});
      }
    } catch (e) {}
  }, [data.offerNo, data.templateType]);

  // Clamp activePage if switching between 11-page and 5-page formats
  useEffect(() => {
    if (data.templateType === 'circle' && activePage !== null && activePage > 5) {
      setActivePage(null);
    }
  }, [data.templateType, activePage]);

  const handleSavePdfContent = () => {
    const totalPages = previewSource === 'uploaded' && uploadedPageImages.length > 0
      ? uploadedPageImages.length
      : (data.templateType === 'circle' ? 5 : 11);
    const updated: { [pageNum: number]: string } = { ...savedCustomPages };
    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
      const pageEl = document.getElementById(`quotation-page-${pageNum}`);
      if (pageEl) {
        updated[pageNum] = pageEl.innerHTML;
      }
    }
    setSavedCustomPages(updated);
    try {
      const key = data.templateType === 'circle'
        ? `alpha_pdf_edits_circle_${data.offerNo || 'default'}`
        : `alpha_pdf_edits_${data.offerNo || 'default'}`;
      localStorage.setItem(key, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save custom PDF pages:', e);
    }
    setIsPdfEditing(false);
    toast.success('Live preview edits saved successfully!');
  };

  const handleResetPdfContent = () => {
    if (confirm('Reset live preview back to default template? Any manual in-preview text edits will be removed.')) {
      setSavedCustomPages({});
      try {
        const key = data.templateType === 'circle'
          ? `alpha_pdf_edits_circle_${data.offerNo || 'default'}`
          : `alpha_pdf_edits_${data.offerNo || 'default'}`;
        localStorage.removeItem(key);
      } catch (e) {}
      setIsPdfEditing(false);
      toast.success('Reset live preview to default template.');
    }
  };

  // Load user and saved quotation data or populate with current BDM
  useEffect(() => {
    const user = getStoredUser();
    setCurrentUser(user);

    // Check URL query parameters for direct loading from BDM Pipeline
    let loadedFromQuery = false;
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const queryOfferNo = searchParams.get('offerNo');
      const queryStage = searchParams.get('stage');

      if (queryOfferNo) {
        loadedFromQuery = true;
        const targetStage = queryStage ? (Number(queryStage) as 1 | 2 | 3) : undefined;
        api.quotations
          .getByOfferNo(queryOfferNo, targetStage)
          .then((res: any) => {
            if (res?.success && res.data?.data) {
              const loadedData = res.data.data;
              const resolvedStage = targetStage || res.data.stage || 1;
              const suffixedOffer = getSuffixedOfferNo(queryOfferNo, resolvedStage);
              setData({
                ...loadedData,
                offerNo: suffixedOffer,
              });
              setCurrentStage(resolvedStage);
              if (res.data.customerPhone) setWhatsAppPhone(res.data.customerPhone);
              toast.success(`Loaded quotation ${suffixedOffer} in Studio!`);

              api.quotations.getStageHistory(queryOfferNo).then((hRes: any) => {
                if (hRes?.data) setStageHistory(hRes.data);
              });
            }
          })
          .catch((e: any) => {
            console.warn('Could not load query quotation:', e);
          });
      }
    }

    if (!loadedFromQuery) {
      // Check localStorage for saved draft
      const saved = localStorage.getItem('alpha_quotation_draft');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setData(parsed);
          if (parsed.offerNo) {
            if (parsed.offerNo.endsWith('-2')) setCurrentStage(2);
            else if (parsed.offerNo.endsWith('-3')) setCurrentStage(3);
            else setCurrentStage(1);
          }
          if (parsed.customerPhone) {
            setWhatsAppPhone(parsed.customerPhone);
          }
          if (parsed.offerNo && parsed.deliveryApprovalStatus === 'PENDING') {
            api.checkDeliveryApprovalStatus(parsed.offerNo)
              .then((statusRes: any) => {
                if (statusRes?.status === 'APPROVED') {
                  const days = Number(statusRes.deliveryDays) || 60;
                  setData((prev) => {
                    const updated = {
                      ...prev,
                      deliveryDays: days,
                      deliveryTime: statusRes.deliveryTime || `${days} days post confirmation on drawings and finishes.`,
                      deliveryApprovalStatus: 'APPROVED' as const,
                      deliveryApprovalDays: days,
                      deliveryApprovalBy: statusRes.approvedBy || 'Nithesh Babu (Admin)',
                      deliveryApprovalAt: statusRes.approvedAt || new Date().toISOString(),
                    };
                    try {
                      localStorage.setItem('alpha_quotation_draft', JSON.stringify(updated));
                    } catch (e) {}
                    return updated;
                  });
                  toast.success(
                    `🎉 Nithesh Babu (Admin) has APPROVED expedited delivery of ${days} Days! Automatically updated on Form and PDF.`,
                    { duration: 9000, id: 'init-delivery-approved-toast', icon: '⚡' }
                  );
                }
              })
              .catch(() => {});
          }
        } catch (e) {
          // use default
        }
      } else {
        // Default initial offer with -1 suffix
        const initialOffer = getSuffixedOfferNo(DEFAULT_QUOTATION_DATA.offerNo, 1);
        setData((prev) => ({
          ...prev,
          offerNo: initialOffer,
          representativeName: user?.name || prev.representativeName,
          alphaSignatoryName: user?.name ? `For Alpha Elevators (${user.name})` : prev.alphaSignatoryName,
        }));
      }
    }

    // Fetch customers for auto-fill dropdown
    api
      .getCustomers()
      .then((res: any) => {
        if (res?.data && Array.isArray(res.data)) {
          setCustomers(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not load customers for quotation:', err);
      });
  }, []);

  // Save to localStorage on change
  const handleDataChange = (newData: QuotationData) => {
    setData(newData);
    try {
      localStorage.setItem('alpha_quotation_draft', JSON.stringify(newData));
    } catch (e) {
      // ignore
    }
  };

  // Auto-fill from selected CRM customer
  const handleSelectCustomer = (customer: any) => {
    if (!customer) return;
    const phone = customer.whatsappNumber || customer.phone || customer.phoneNumber || '';
    if (phone) {
      setWhatsAppPhone(phone);
    }
    const custName = customer.fullName || customer.name || data.clientName;
    const cleanSalutation = custName ? custName.replace(/^Dear\s*/i, '').trim() : 'Client';
    setData((prev) => ({
      ...prev,
      clientName: custName,
      projectCity: customer.city || prev.projectCity,
      customerPhone: phone || prev.customerPhone,
      siteAddress: customer.address || prev.siteAddress,
      salutation: `Dear ${cleanSalutation}`,
      clientSignatoryName: custName,
      existingCustomerId: customer.customerId || customer._id,
    }));
    toast.success(`Loaded details for customer: ${custName} (${customer.customerId || ''})`);
  };

  // Zoom controls
  const handleZoomIn = () => setScale((prev) => Math.min(prev + 0.1, 1.3));
  const handleZoomOut = () => setScale((prev) => Math.max(prev - 0.1, 0.4));
  const handleFit = () => setScale(0.7);

  // PDF File Upload Handler: Renders the PDF directly below WITHOUT overwriting user form data
  const processUploadedPdf = async (file: File) => {
    if (!file || file.type !== 'application/pdf') {
      toast.error('Please upload a valid PDF document.');
      return;
    }

    setIsRenderingPdf(true);
    setUploadedFile(file);

    try {
      toast.loading(`Rendering ${file.name} for live editing...`, { id: 'pdf-render' });
      const result = await renderUploadedPdfPages(file);

      setUploadedPageImages(result.pageImages);
      setUploadedMatches(result.matches);
      setPreviewSource('uploaded');

      toast.success(
        `PDF rendered! Type in the input fields on the right to see the name & details reflected on the uploaded PDF.`,
        { id: 'pdf-render', duration: 4500 }
      );
    } catch (err: any) {
      console.error('PDF render error:', err);
      toast.error('Failed to render uploaded PDF. Showing live template instead.', { id: 'pdf-render' });
    } finally {
      setIsRenderingPdf(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processUploadedPdf(file);
    }
  };

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processUploadedPdf(file);
    }
  };

  const handleRemoveUploadedPdf = () => {
    setUploadedFile(null);
    setUploadedPageImages([]);
    setUploadedMatches([]);
    setPreviewSource('template');
    toast.success('Uploaded PDF removed. Showing live proposal template.');
  };

  // Multi-page PDF Download using jsPDF and html2canvas with full text visibility and exact live preview alignment
  const handleDownloadPdf = async () => {
    setIsDownloading(true);
    setDownloadProgress('Preparing high-resolution PDF with your updated name & details...');

    const previousActivePage = activePage;
    const previousScale = scale;

    try {
      // 1. Switch to all pages if viewing single page
      if (activePage !== null) {
        setActivePage(null);
      }

      // 2. Temporarily reset zoom to 1.0 and disable CSS transitions to prevent scaling distortion
      setScale(1.0);
      const printContainer = document.getElementById('quotation-print-container');
      if (printContainer) {
        printContainer.style.transition = 'none';
      }

      // Brief tick to let DOM repaint without scale and let React re-render
      await new Promise((r) => setTimeout(r, 250));

      // Ensure all browser fonts are ready
      if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }

      // Preload CSS text with all embedded @font-face rules
      const isCircle = data.templateType === 'circle';
      const styleId = isCircle ? 'alpha-circle-stylesheet' : 'alpha-exact-stylesheet';
      let baseCssText = '';
      try {
        const existingStyle = document.getElementById(styleId);
        if (existingStyle && existingStyle.innerHTML) {
          baseCssText = existingStyle.innerHTML;
        } else {
          const res = await fetch(isCircle ? '/quotation/circle/circle.css' : '/quotation/exact/pdf2html.css');
          baseCssText = await res.text();
        }
      } catch (e) {
        console.warn('Could not read base PDF css:', e);
      }

      const proposalOverrides = `
        #p0 .c1 { color: #0f4b31 !important; }
        #p0 .im[style*="714.6"] { display: none !important; }
        #p0::after {
          content: '';
          position: absolute;
          left: 530px;
          top: 960px; 
          width: 260px;
          height: 155px;
          background: #ffffff;
          z-index: 10;
          pointer-events: none;
        }
        #p1 .c9 { color: #0e4b31 !important; }
        #p2 .c9, #p2 .c17 { color: #1a3f2e !important; }
        #p5 .customer-scope-underline-remover {
          position: absolute;
          left: 32px;
          top: 517.5px;
          width: 150px;
          height: 4.5px;
          background: #ffffff;
          z-index: 9;
          pointer-events: none;
        }
        #p9 .c3, #p9 .c10 { color: #000000 !important; }
        #p9 .billing-page-container { color: #000000 !important; }
        #p10 .c35, #p10 .c37 { color: #000000 !important; }
        #p0 .client-signature-box, #p1 .client-signature-box, #p8 .client-signature-box, #p10 .client-signature-box { display: none !important; }
        .mrp-strikethrough-line {
          position: absolute !important;
          left: 0 !important;
          width: 100% !important;
          top: 50% !important;
          transform: translateY(-50%) !important;
          height: 1.5px !important;
          background: #718096 !important;
          pointer-events: none !important;
        }
        .page::before {
          content: '';
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          width: 520px;
          height: 290px;
          background-image: url('/logo-black.png');
          background-size: contain;
          background-repeat: no-repeat;
          background-position: center;
          opacity: 0.08;
          mix-blend-mode: multiply;
          pointer-events: none;
          z-index: 5;
        }
        .page:not(#p0):not(#p1):not(#p10)::after {
          content: '';
          position: absolute;
          top: 50px;
          right: 20px;
          width: 140px;
          height: 65px;
          background: #ffffff;
          z-index: 10;
          pointer-events: none;
        }
        .page {
          margin: 0 !important;
          box-shadow: none !important;
          border-radius: 0 !important;
        }
        * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: geometricPrecision;
        }
      `;

      // Dynamic import of jspdf and html2canvas
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
        compress: true,
      });

      const totalPages = previewSource === 'uploaded' && uploadedPageImages.length > 0
        ? uploadedPageImages.length
        : (isCircle ? 5 : 11);

      const pageWidth = isCircle ? 720 : 793.28;
      const pageHeight = isCircle ? 1040 : 1122.72;

      for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setDownloadProgress(`Rendering Page ${pageNum} of ${totalPages} (exact alignment)...`);
        const pageEl = document.getElementById(`quotation-page-${pageNum}`);

        if (pageEl) {
          // Identify exact page container (.page) or fallback to pageEl
          const targetEl = (pageEl.querySelector('.page') as HTMLElement) || pageEl;

          // Capture with exact dimensions matching the live preview and embedded fonts
          const canvas = await html2canvas(targetEl, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: pageWidth,
            height: pageHeight,
            windowWidth: 1200,
            windowHeight: 1600,
            scrollX: 0,
            scrollY: 0,
            onclone: async (clonedDoc, clonedElement) => {
              // Ensure full base stylesheet with all embedded fonts is injected into clone
              if (baseCssText || proposalOverrides) {
                const styleEl = clonedDoc.createElement('style');
                styleEl.id = 'alpha-pdf-cloned-styles';
                styleEl.innerHTML = (baseCssText || '') + '\n' + proposalOverrides;
                clonedDoc.head.appendChild(styleEl);
              }

              // Normalize cloned target element to match exact preview box
              clonedElement.style.margin = '0';
              clonedElement.style.padding = '0';
              clonedElement.style.borderRadius = '0';
              clonedElement.style.boxShadow = 'none';
              clonedElement.style.transform = 'none';
              clonedElement.style.position = 'relative';
              clonedElement.style.left = '0';
              clonedElement.style.top = '0';

              if (clonedDoc.fonts && clonedDoc.fonts.ready) {
                await clonedDoc.fonts.ready;
              }
            },
          });

          // Lossless PNG data URL ensures text never blurs or gets compression artifacts
          const imgData = canvas.toDataURL('image/png');

          if (pageNum > 1) {
            pdf.addPage('a4', 'p');
          }

          // A4 dimensions in mm: 210 x 297
          pdf.addImage(imgData, 'PNG', 0, 0, 210, 297, undefined, 'FAST');
        }
      }

      setDownloadProgress('Saving updated PDF document...');
      const cleanOfferNo = (data.offerNo || 'AE-261026-131').replace(/[^a-zA-Z0-9_-]/g, '_');
      const cleanClient = (data.clientName || 'Quotation').replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `Alpha_Proposal_${cleanClient}_${cleanOfferNo}.pdf`;
      pdf.save(filename);

      toast.success(`Downloaded ${filename} successfully!`);
    } catch (err: any) {
      console.error('PDF generation error:', err);
      toast.error('Direct download failed. Falling back to browser Print to PDF.');
      window.print();
    } finally {
      // Restore transition, scale, and active page preference
      const printContainer = document.getElementById('quotation-print-container');
      if (printContainer) {
        printContainer.style.transition = 'transform 0.15s ease-out';
      }
      setScale(previousScale);
      if (previousActivePage !== null) {
        setActivePage(previousActivePage);
      }
      setIsDownloading(false);
      setDownloadProgress('');
    }
  };

  const handlePrint = () => {
    // If a single page is active, switch to all pages before printing
    if (activePage !== null) {
      setActivePage(null);
      setTimeout(() => {
        window.print();
      }, 250);
    } else {
      window.print();
    }
  };

  const totalPageCount = previewSource === 'uploaded' && uploadedPageImages.length > 0
    ? uploadedPageImages.length
    : (data.templateType === 'circle' ? 5 : 11);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-[calc(100vh-4rem)] animate-fade-in w-full max-w-full overflow-x-hidden">
      {/* Hidden PDF file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* TOP HEADER / ACTION BAR */}
      <div
        id="quotation-top-bar"
        className="no-print bg-[#0A192F] text-white px-3 py-2 sm:px-4 sm:py-2.5 border-b border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-2.5 shrink-0 shadow-md z-20 w-full flex-wrap overflow-hidden"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
            <Link
              href="/"
              className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors shrink-0"
              title="Back to Dashboard"
            >
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex items-center space-x-2 min-w-0">
              <div className="h-6 sm:h-7 w-16 sm:w-20 flex items-center justify-center shrink-0">
                <img src="/logo.png" alt="Alpha Elevators" className="h-full object-contain" />
              </div>
              <div className="h-4 w-px bg-slate-700 hidden sm:block shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <h1 className="text-xs sm:text-sm font-extrabold text-white truncate max-w-[130px] sm:max-w-none">
                    Quotation Studio
                  </h1>
                  <span className="text-[9px] sm:text-[10px] font-mono font-bold bg-teal-500/20 text-teal-300 px-1.5 py-0.5 rounded-full border border-teal-500/30 truncate max-w-[140px] sm:max-w-none">
                    {data.offerNo}
                  </span>
                </div>
                <p className="text-[9px] sm:text-[10px] text-slate-400 truncate max-w-[200px] sm:max-w-none hidden xs:block">
                  Live 2-Way Sync • {data.clientName || 'Unassigned'}
                </p>
              </div>
            </div>
          </div>

          {/* Mobile Phone Segmented Mode Switcher: Form vs Preview */}
          <div className="flex lg:hidden bg-slate-900/90 rounded-xl p-0.5 border border-slate-700/80 shrink-0 shadow-inner">
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileTab === 'form'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Form</span>
            </button>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                mobileTab === 'preview'
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Preview</span>
            </button>
          </div>
        </div>

        {/* Mobile secondary toolstrip (shown on small screens) */}
        <div className="flex lg:hidden items-center justify-between gap-1.5 pt-1.5 border-t border-slate-800/80">
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            <button
              type="button"
              onClick={handleSaveCurrentStage}
              disabled={isSavingStage}
              className="px-2.5 py-1 bg-blue-600/90 hover:bg-blue-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingStage ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
              <span>Save</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading || isRenderingPdf}
              className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1 shadow-xs active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
              <span>Download PDF</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setWhatsAppPhone(data.customerPhone || '');
                setShowWhatsAppModal(true);
              }}
              className="px-2 py-1 bg-emerald-800/80 hover:bg-emerald-700 text-emerald-200 rounded-lg text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
            >
              <Send className="w-3 h-3" />
              <span>WhatsApp</span>
            </button>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowMobileTools((prev) => !prev)}
              className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-semibold border border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <span>More</span>
              {showMobileTools ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
          </div>
        </div>

        {/* Collapsible Mobile Extra Tools Bar */}
        {showMobileTools && (
          <div className="lg:hidden flex flex-wrap items-center gap-2 p-2 bg-slate-900/95 rounded-xl border border-slate-700/80 mt-1 animate-fade-in text-xs">
            <button
              type="button"
              onClick={handlePrint}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Printer className="w-3 h-3 text-sky-400" />
              <span>Print / Vector</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setExcelOfferNo(data.offerNo);
                setShowExcelModal(true);
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-emerald-300 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <FileSpreadsheet className="w-3 h-3 text-emerald-400" />
              <span>Export Excel</span>
            </button>
            <Link
              href="/quotations/bdm"
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded-lg flex items-center gap-1"
            >
              <Briefcase className="w-3 h-3 text-sky-400" />
              <span>BDM Pipeline</span>
            </Link>
            <button
              type="button"
              onClick={() => setIsPdfEditing(!isPdfEditing)}
              className="px-2.5 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded-lg flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3 h-3" />
              <span>{isPdfEditing ? 'Stop PDF Edit' : 'Edit on PDF'}</span>
            </button>
            <div className="flex items-center gap-1 ml-auto">
              <button
                type="button"
                onClick={handleZoomOut}
                className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded cursor-pointer"
              >
                <ZoomOut className="w-3 h-3" />
              </button>
              <span className="text-[10px] font-mono text-slate-300">{Math.round(scale * 100)}%</span>
              <button
                type="button"
                onClick={handleZoomIn}
                className="p-1 text-slate-400 hover:text-white bg-slate-800 rounded cursor-pointer"
              >
                <ZoomIn className="w-3 h-3" />
              </button>
            </div>
          </div>
        )}

        {/* Desktop Page Switcher, Zoom Controls & Action Buttons */}
        <div className="hidden lg:flex items-center gap-1.5 xl:gap-2 flex-wrap justify-end">
          {/* Page Selector Pills */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={() => setActivePage(null)}
              className={`px-2 py-1 rounded-lg font-semibold transition-all ${
                activePage === null
                  ? 'bg-teal-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              All ({totalPageCount})
            </button>
            {Array.from({ length: totalPageCount }).map((_, idx) => {
              const num = idx + 1;
              return (
                <button
                  key={num}
                  type="button"
                  onClick={() => setActivePage(num)}
                  className={`w-6 h-6 rounded-lg font-semibold text-[11px] transition-all flex items-center justify-center ${
                    activePage === num
                      ? 'bg-teal-600 text-white shadow-xs'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Jump to Page ${num}`}
                >
                  {num}
                </button>
              );
            })}
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center bg-slate-900/90 rounded-xl p-1 border border-slate-700/60 text-xs">
            <button
              type="button"
              onClick={handleZoomOut}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom Out"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="px-1.5 text-[11px] font-mono text-slate-300 select-none">
              {Math.round(scale * 100)}%
            </span>
            <button
              type="button"
              onClick={handleZoomIn}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Zoom In"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleFit}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition-colors"
              title="Fit to Screen"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Hide / Unhide Live PDF Preview Toggle Button */}
          <button
            type="button"
            onClick={() => setShowPdfPreview((prev) => !prev)}
            className={`px-3 py-1.5 rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer ${
              showPdfPreview
                ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                : 'bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white border border-teal-400 ring-2 ring-teal-400/40 shadow-teal-900/40 animate-pulse'
            }`}
            title={
              showPdfPreview
                ? 'Hide Live PDF Document Preview to expand Quotation Form full screen'
                : 'Unhide Live PDF Document Preview to restore split view'
            }
          >
            {showPdfPreview ? (
              <>
                <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                <span className="hidden sm:inline">Hide Preview</span>
              </>
            ) : (
              <>
                <Eye className="w-3.5 h-3.5 text-white" />
                <span>Show Preview (Split View)</span>
              </>
            )}
          </button>

          {/* Edit on PDF & Save Content Buttons on Top Header Bar */}
          {isPdfEditing ? (
            <div className="flex items-center gap-1.5 bg-emerald-950/90 p-1 rounded-xl border border-emerald-500 shadow-md">
              <button
                type="button"
                onClick={handleSavePdfContent}
                className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer ring-1 ring-emerald-400/50"
                title="Save edited text into live preview"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Content</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPdfEditing(false)}
                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Cancel without saving"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setIsPdfEditing(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-amber-950/40 transition-all active:scale-95 cursor-pointer ring-1 ring-amber-300/60"
                title="Edit words, letters, and spaces directly on the live preview PDF"
              >
                <Edit3 className="w-3.5 h-3.5 text-slate-950" />
                <span>Edit on PDF</span>
              </button>
              {Object.keys(savedCustomPages).length > 0 && (
                <button
                  type="button"
                  onClick={handleResetPdfContent}
                  className="px-2 py-1.5 bg-slate-850 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700/80 rounded-xl text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                  title="Reset preview back to original template"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          )}

          {/* Print Button */}
          <button
            type="button"
            onClick={handlePrint}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
            title="Print or Save as Vector PDF"
          >
            <Printer className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden sm:inline">Print / Vector</span>
          </button>

          {/* Export Data (Excel) Button on Top Bar */}
          <button
            type="button"
            onClick={() => {
              setExcelOfferNo(data.offerNo);
              setShowExcelModal(true);
            }}
            className="px-3 py-1.5 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-950/40 active:scale-95 transition-all cursor-pointer"
            title="Export Stage 1 vs 2 vs 3 Comparison in Excel (.xlsx) format"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-200" />
            <span className="hidden sm:inline">Export Excel</span>
          </button>

          {/* Save Stage Progress Button */}
          <button
            type="button"
            onClick={handleSaveCurrentStage}
            disabled={isSavingStage}
            className="px-3.5 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-blue-950/40 active:scale-95 transition-all disabled:opacity-70 cursor-pointer"
            title="Save current stage quotation progress to BDM Pipeline"
          >
            {isSavingStage ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span>Save Stage</span>
          </button>

          {/* BDM Pipeline Navigation Button */}
          <Link
            href="/quotations/bdm"
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="View Stage-Wise Quotations per Customer in BDM Pipeline"
          >
            <Briefcase className="w-3.5 h-3.5 text-sky-400" />
            <span className="hidden md:inline">BDM Pipeline</span>
          </Link>

          {/* Download PDF Button */}
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={isDownloading || isRenderingPdf}
            className="px-4 py-1.5 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md shadow-teal-900/40 active:scale-95 transition-all disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
          >
            {isDownloading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Downloading...</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Downloading / Rendering Banner */}
      {isDownloading && (
        <div className="no-print bg-teal-900/90 text-teal-100 px-4 py-2 text-xs flex items-center justify-center gap-2.5 border-b border-teal-700/60 shadow-inner z-30 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-teal-300" />
          <span className="font-semibold">{downloadProgress || 'Generating proposal PDF...'}</span>
        </div>
      )}
      {isRenderingPdf && (
        <div className="no-print bg-sky-900/90 text-sky-100 px-4 py-2 text-xs flex items-center justify-center gap-2.5 border-b border-sky-700/60 shadow-inner z-30 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin text-sky-300" />
          <span className="font-semibold">Rendering uploaded PDF pages for live editing below...</span>
        </div>
      )}

      {/* MAIN TWO-COLUMN SPLIT LAYOUT */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative w-full max-w-full">
        {/* LEFT COLUMN: LIVE PDF PREVIEW & UPLOAD ZONE */}
        {showPdfPreview && (
          <div
            className={`flex-1 bg-[#1e293b]/90 overflow-y-auto overflow-x-auto p-2 sm:p-4 md:p-6 flex-col items-center custom-scrollbar ${
              mobileTab === 'preview' ? 'flex w-full h-full pb-24' : 'hidden lg:flex'
            }`}
          >
            {/* Preview Navigation Notice */}
            <div className="no-print mb-3 px-3 py-1.5 bg-slate-800/80 rounded-full border border-slate-700/80 text-[11px] text-slate-300 flex items-center gap-2 shadow-sm">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>
                Live PDF Document Preview •{' '}
                {activePage ? `Viewing Page ${activePage} of ${totalPageCount}` : `Viewing All ${totalPageCount} Pages`}
              </span>
              {activePage !== null && (
                <button
                  type="button"
                  onClick={() => setActivePage(null)}
                  className="text-teal-400 hover:underline font-bold text-[10px] ml-1"
                >
                  (View All)
                </button>
              )}
              <span className="text-slate-600 mx-1">|</span>
              <button
                type="button"
                onClick={() => setShowPdfPreview(false)}
                className="text-amber-300 hover:text-amber-200 hover:underline font-bold text-[10px] flex items-center gap-1 cursor-pointer"
                title="Hide Live PDF Preview to view Quotation Form in full screen"
              >
                <EyeOff className="w-3 h-3 text-amber-400" />
                <span>Hide Preview (Full Screen Form)</span>
              </button>
            </div>

          {/* UPLOAD OPTION FOR PDF (Placed directly after the line requested by user) */}
          {!uploadedFile ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleFileDrop}
              style={{ maxWidth: scale !== 1 ? Math.round(793.28 * scale) : 793.28 }}
              className={`no-print w-full mb-5 p-3.5 rounded-2xl border-2 border-dashed transition-all cursor-pointer flex flex-col sm:flex-row items-center justify-between gap-3 shadow-md ${
                isDragging
                  ? 'border-teal-400 bg-teal-500/10 scale-[1.01]'
                  : 'border-slate-700 hover:border-teal-500/60 bg-slate-850/80 hover:bg-slate-800/90'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center shrink-0">
                  <UploadCloud className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-2">
                    <span>Upload Proposal PDF to Preview & Edit Live</span>
                    <span className="text-[10px] bg-teal-500/30 text-teal-300 px-2 py-0.5 rounded-full font-mono">
                      .pdf
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Upload your PDF below: any name or details changed in the right-side form will be reflected directly on the uploaded PDF!
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="px-3.5 py-1.5 bg-teal-600 hover:bg-teal-500 text-white rounded-xl text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 shadow-sm"
              >
                <FileUp className="w-3.5 h-3.5" />
                <span>Upload PDF</span>
              </button>
            </div>
          ) : (
            <div
              style={{ maxWidth: scale !== 1 ? Math.round(793.28 * scale) : 793.28 }}
              className="no-print w-full mb-5 bg-slate-850/95 border border-teal-500/40 rounded-2xl p-3 shadow-lg space-y-2.5"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 flex items-center justify-center shrink-0">
                    <FileCheck className="w-4 h-4 text-teal-400" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white flex items-center gap-2">
                      <span className="truncate max-w-[240px]">{uploadedFile.name}</span>
                      <span className="text-[10px] text-teal-300 font-mono">
                        ({(uploadedFile.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>
                        PDF Active below: changing the name or fields on the right reflects live on this PDF!
                      </span>
                    </div>
                  </div>
                </div>

                {/* Switch between Uploaded PDF with live name reflection and standard 10-page template */}
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setPreviewSource('uploaded')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      previewSource === 'uploaded'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                    title="View uploaded PDF with live reflected name"
                  >
                    <FileText className="w-3 h-3" />
                    <span>Uploaded PDF (Live Reflected)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewSource('template')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                      previewSource === 'template'
                        ? 'bg-teal-600 text-white shadow-sm'
                        : 'text-slate-400 hover:text-white bg-slate-800'
                    }`}
                    title="View built-in quotation template"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>{data.templateType === 'circle' ? 'Circle Presentation (5 Pgs)' : 'Proposal Template (11 Pgs)'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs rounded-lg font-semibold transition-colors"
                    title="Upload different PDF"
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={handleRemoveUploadedPdf}
                    className="p-1 text-slate-400 hover:text-rose-400 rounded-lg hover:bg-slate-800 transition-colors"
                    title="Remove uploaded file"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Direct PDF Editing Active Banner */}
          {isPdfEditing && (
            <div
              className="no-print w-full mb-4 p-3.5 bg-gradient-to-r from-amber-500/25 via-amber-500/15 to-transparent border-2 border-amber-500/80 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-xl z-20"
              style={{ maxWidth: scale !== 1 ? Math.round(793.28 * scale) : 793.28, margin: '0 auto' }}
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/30 text-amber-300 flex items-center justify-center font-bold">
                  <Edit3 className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-xs font-black text-amber-200 uppercase tracking-wider">
                    Direct PDF Editing Active
                  </div>
                  <p className="text-[11px] text-amber-100/90 mt-0.5">
                    Click anywhere on the preview pages below to type, delete unwanted spaces, or fix letters. When finished, click Save Content!
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSavePdfContent}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-lg shadow-emerald-950/40 cursor-pointer active:scale-95 transition-all ring-2 ring-emerald-400"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Content</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsPdfEditing(false)}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold cursor-pointer transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* DOCUMENT PREVIEW BELOW: Either the Uploaded PDF with Live Reflected Name or the 10-Page Template */}
          <div className="w-full flex flex-col items-center justify-center">
            {previewSource === 'uploaded' && uploadedPageImages.length > 0 ? (
              <UploadedPdfLiveView
                pageImages={uploadedPageImages}
                matches={uploadedMatches}
                data={data}
                activePage={activePage}
                scale={scale}
              />
            ) : (
              <QuotationLivePdf
                data={data}
                activePage={activePage}
                scale={scale}
                isEditing={isPdfEditing}
                onToggleEdit={() => setIsPdfEditing(!isPdfEditing)}
                onSaveContent={handleSavePdfContent}
                onResetContent={handleResetPdfContent}
                savedPages={savedCustomPages}
              />
            )}
          </div>
        </div>
        )}

        {/* RIGHT COLUMN: 3-STAGE LIFECYCLE CONTROLS & EDITABLE FORM */}
        <div
          id="quotation-form-column"
          className={`no-print border-t lg:border-t-0 ${
            showPdfPreview ? 'lg:border-l w-full lg:w-[500px] xl:w-[560px] shrink-0' : 'w-full flex-1 max-w-full'
          } border-slate-200 bg-slate-50 shadow-xl flex flex-col h-full overflow-hidden z-10 transition-all duration-200 ${
            mobileTab === 'form' ? 'flex w-full h-full pb-24 lg:pb-0' : 'hidden lg:flex'
          }`}
        >
          {/* Full Screen Form Banner when PDF preview is hidden */}
          {!showPdfPreview && (
            <div className="no-print bg-slate-900 border-b border-teal-500/40 text-white px-4 py-2 flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-ping"></span>
                <span className="text-xs font-black tracking-wide text-teal-300">
                  Quotation Form • Full Screen View
                </span>
                <span className="text-[11px] text-slate-400 hidden sm:inline">
                  (Live PDF Document Preview is hidden)
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowPdfPreview(true)}
                className="px-3 py-1 bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-400 hover:to-emerald-500 text-white rounded-lg text-xs font-black flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer ring-1 ring-teal-300/40"
                title="Unhide Live PDF Document Preview and restore split view"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Unhide PDF Preview</span>
              </button>
            </div>
          )}
          {/* ================= OUTSIDE OF FORM: 3 STAGES LIFECYCLE CONTROLLER ================= */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-3 border-b border-slate-800 shrink-0 shadow-md transition-all">
            {/* Stage Selector Header / Dropdown Toggle Button */}
            <div
              onClick={() => setIsStagePanelOpen((prev) => !prev)}
              className="flex items-center justify-between gap-2 cursor-pointer select-none group"
              title={isStagePanelOpen ? 'Click to close stage options' : 'Click to open stage options'}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse"></span>
                <span className="text-[11px] font-black uppercase tracking-wider text-slate-200 group-hover:text-teal-300 transition-colors">
                  Quotation Stage Lifecycle
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border ${
                    currentStage === 1
                      ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      : currentStage === 2
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  }`}
                >
                  Stage {currentStage} ({currentStage === 1 ? 'Initial: -1' : currentStage === 2 ? 'Negotiation: -2' : 'Final Commercial: -3'})
                </span>

                {/* Dropdown toggle button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsStagePanelOpen((prev) => !prev);
                  }}
                  className="p-1 rounded-lg text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 border border-slate-700/80 transition-all flex items-center justify-center cursor-pointer shadow-xs"
                  title={isStagePanelOpen ? 'Click to close options' : 'Click to open options'}
                  aria-label={isStagePanelOpen ? 'Close stage options' : 'Open stage options'}
                >
                  {isStagePanelOpen ? (
                    <ChevronUp className="w-4 h-4 text-slate-300" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-teal-400" />
                  )}
                </button>
              </div>
            </div>

            {/* Collapsible Content Options */}
            {isStagePanelOpen && (
              <div className="space-y-3 pt-3 border-t border-slate-800/80 mt-2.5">
                {/* Stage Switcher Pills */}
                <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-950/80 rounded-xl border border-slate-800 text-xs">
                  <button
                    type="button"
                    onClick={() => handleStageSwitch(1)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all flex flex-col items-center gap-0.5 ${
                      currentStage === 1
                        ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-[11px]">Stage 1</span>
                    <span className="text-[9px] font-mono opacity-80">Initial (-1)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSwitch(2)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all flex flex-col items-center gap-0.5 ${
                      currentStage === 2
                        ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-[11px]">Stage 2</span>
                    <span className="text-[9px] font-mono opacity-80">Negotiation (-2)</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleStageSwitch(3)}
                    className={`py-1.5 px-2 rounded-lg font-bold text-center transition-all flex flex-col items-center gap-0.5 ${
                      currentStage === 3
                        ? 'bg-emerald-600 text-white shadow-sm ring-1 ring-emerald-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                    }`}
                  >
                    <span className="text-[11px]">Stage 3</span>
                    <span className="text-[9px] font-mono opacity-80">Final CRM (-3)</span>
                  </button>
                </div>

                {/* Offer Lookup & Auto-fill Previous Stage */}
                <div className="flex gap-1.5 pt-0.5">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={lookupOfferNo}
                      onChange={(e) => setLookupOfferNo(e.target.value)}
                      placeholder={`Enter offer no to load Stage ${currentStage === 1 ? '1' : currentStage === 2 ? '1' : '2'} data...`}
                      className="w-full text-xs bg-slate-950 border border-slate-700/80 rounded-xl px-3 py-1.5 text-white font-mono placeholder:text-slate-500 focus:outline-none focus:border-teal-400"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleLookupOffer}
                    disabled={isSearchingOffer}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-teal-300 rounded-xl text-xs font-bold border border-slate-700 flex items-center gap-1 transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
                    title="Search and auto-fill form from previous stage"
                  >
                    {isSearchingOffer ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5" />
                    )}
                    <span>Load Data</span>
                  </button>
                </div>

                {/* STAGE-SPECIFIC ACTION BUTTONS (OUTSIDE OF FORM) */}
                <div className="space-y-2 pt-1 border-t border-slate-800/80">
                  {currentStage === 1 && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppPhone(data.customerPhone || '');
                          setShowWhatsAppModal(true);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Send initial quotation PDF to customer via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Send to Customer</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleFinalizeCurrentStage}
                        disabled={isFinalizingStage}
                        className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        title="Finalize Stage 1 (appends -1 to offer no) and send data for CRM role"
                      >
                        {isFinalizingStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Finalize (-1) to CRM</span>
                      </button>
                    </div>
                  )}

                  {currentStage === 2 && (
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setWhatsAppPhone(data.customerPhone || '');
                          setShowWhatsAppModal(true);
                        }}
                        className="px-3 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                        title="Send negotiated quotation to customer via WhatsApp"
                      >
                        <Send className="w-3.5 h-3.5" />
                        <span>Negotiation: Send PDF</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleFinalizeCurrentStage}
                        disabled={isFinalizingStage}
                        className="px-3 py-2 bg-amber-700 hover:bg-amber-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                        title="Finalize Stage 2 (appends -2 to offer no) and send to CRM role"
                      >
                        {isFinalizingStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        <span>Finalize (-2) to CRM</span>
                      </button>
                    </div>
                  )}

                  {currentStage === 3 && (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setWhatsAppPhone(data.customerPhone || '');
                            setShowWhatsAppModal(true);
                          }}
                          className="px-3 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all cursor-pointer"
                          title="Send final negotiation revision to customer"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Send to Customer</span>
                        </button>

                        <button
                          type="button"
                          onClick={handleFinalizeCurrentStage}
                          disabled={isFinalizingStage}
                          className="px-3 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                          title="Finalize Stage 3 (appends -3 to offer no) and send to CRM role"
                        >
                          {isFinalizingStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                          <span>Finalize (-3) to CRM</span>
                        </button>
                      </div>

                      {/* CRM Role Approval / BDM Request Action Button */}
                      {currentUser?.role === 'BDM' ? (
                        <button
                          type="button"
                          onClick={handleCrmApprove}
                          disabled={isCrmApproving || approvalRequested}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-sky-600 via-indigo-600 to-blue-700 hover:from-sky-500 hover:to-indigo-600 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-sky-950/50 active:scale-95 transition-all ring-1 ring-sky-400 disabled:opacity-60 cursor-pointer"
                          title="Submit Stage 3 quotation for CRM Approval and Project Auto-Creation"
                        >
                          {isCrmApproving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Send className="w-4 h-4 text-sky-200" />
                          )}
                          <span>
                            {approvalRequested
                              ? '⏳ Approval Requested — Awaiting CRM Review'
                              : '📤 Send for CRM Approval (Auto-Create Customer + Project)'}
                          </span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCrmApprove}
                          disabled={isCrmApproving}
                          className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 via-emerald-600 to-teal-600 hover:from-amber-400 hover:to-emerald-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-2 shadow-md shadow-emerald-950/50 active:scale-95 transition-all ring-1 ring-emerald-400 disabled:opacity-50 cursor-pointer"
                          title="CRM Approval: Automatically creates new Customer and new Project on CRM!"
                        >
                          {isCrmApproving ? (
                            <Loader2 className="w-4 h-4 animate-spin text-white" />
                          ) : (
                            <Award className="w-4 h-4 text-amber-300" />
                          )}
                          <span>👑 CRM Role: Approve & Auto-Create Customer + Project</span>
                        </button>
                      )}
                    </div>
                  )}

                  {/* Save Draft Progress & BDM Pipeline View */}
                  <div className="pt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSaveCurrentStage}
                      disabled={isSavingStage}
                      className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
                      title="Save quotation progress to BDM Pipeline"
                    >
                      {isSavingStage ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 text-sky-400" />}
                      <span>Save Stage {currentStage} Progress</span>
                    </button>

                    <Link
                      href="/quotations/bdm"
                      className="py-2 px-3 bg-sky-950/60 hover:bg-sky-900/80 text-sky-300 border border-sky-800/80 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm transition-all"
                      title="View all customer quotation stages in BDM Pipeline"
                    >
                      <Briefcase className="w-3.5 h-3.5 text-sky-400" />
                      <span>BDM View</span>
                    </Link>
                  </div>

                  {/* Excel Comparison Export Button */}
                  <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400">
                    <span>Stage-wise Excel Changes:</span>
                    <button
                      type="button"
                      onClick={() => {
                        setExcelOfferNo(data.offerNo);
                        setShowExcelModal(true);
                      }}
                      className="text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 underline underline-offset-2 cursor-pointer"
                    >
                      <FileSpreadsheet className="w-3.5 h-3.5" />
                      <span>Export Data (Excel)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form scrollable body */}
          <div className="flex-1 overflow-y-auto">
            <QuotationForm
              data={data}
              onChange={handleDataChange}
              customers={customers}
              onSelectCustomer={handleSelectCustomer}
            />
          </div>
        </div>
      </div>

      {/* MOBILE FLOATING STICKY ACTION BAR */}
      <div className="lg:hidden no-print fixed bottom-0 left-0 right-0 bg-[#0A192F]/95 backdrop-blur-md border-t border-slate-800 p-2.5 px-3 flex items-center justify-between gap-2 z-40 shadow-2xl">
        {mobileTab === 'form' ? (
          <>
            <button
              type="button"
              onClick={() => setMobileTab('preview')}
              className="flex-1 py-2 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Eye className="w-4 h-4 text-teal-400" />
              <span>Preview PDF</span>
            </button>

            <button
              type="button"
              onClick={handleSaveCurrentStage}
              disabled={isSavingStage}
              className="py-2 px-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isSavingStage ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading || isRenderingPdf}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-teal-950/40 active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download PDF</span>
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setMobileTab('form')}
              className="flex-1 py-2 px-3 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
            >
              <Edit3 className="w-4 h-4" />
              <span>Back to Form</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setWhatsAppPhone(data.customerPhone || '');
                setShowWhatsAppModal(true);
              }}
              className="py-2 px-3 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              title="Send to WhatsApp"
            >
              <Send className="w-4 h-4" />
              <span>WhatsApp</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isDownloading || isRenderingPdf}
              className="flex-1 py-2 px-3 bg-teal-500 hover:bg-teal-400 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              {isDownloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              <span>Download PDF</span>
            </button>
          </>
        )}
      </div>

      {/* 1. WHATSAPP SEND MODAL (GET NUMBER VIA POPUP) */}
      {showWhatsAppModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto m-2 sm:m-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  <Send className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Send Quotation PDF to Customer
                  </h3>
                  <p className="text-[11px] text-emerald-700 font-semibold">
                    Stage {currentStage} ({currentStage === 1 ? 'Initial Proposal' : currentStage === 2 ? 'Negotiation Revision' : 'Final Commercial'})
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Customer WhatsApp Phone Number: <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={whatsAppPhone}
                  onChange={(e) => setWhatsAppPhone(e.target.value)}
                  placeholder="e.g. 9820011101 or +919820011101"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-bold text-slate-800"
                />
              </div>

              {customers.length > 0 && (
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                    Or select from existing customer:
                  </label>
                  <select
                    onChange={(e) => {
                      const c = customers.find((x) => x._id === e.target.value || x.id === e.target.value);
                      if (c) {
                        setWhatsAppPhone(c.whatsappNumber || c.phone || c.phoneNumber || '');
                      }
                    }}
                    defaultValue=""
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-xl bg-slate-50 text-slate-700 font-medium"
                  >
                    <option value="" disabled>-- Select Existing Customer Contact --</option>
                    {customers.map((c) => (
                      <option key={c._id || c.id} value={c._id || c.id}>
                        {c.name} ({c.whatsappNumber || c.phone})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="flex justify-between font-bold text-slate-800 text-[11px]">
                  <span>Offer No:</span>
                  <span className="font-mono text-teal-700">{getSuffixedOfferNo(data.offerNo, currentStage)}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Customer:</span>
                  <span className="font-semibold text-slate-800">{data.clientName || 'Customer'}</span>
                </div>
                <div className="flex justify-between text-[11px]">
                  <span>Total Order Value:</span>
                  <span className="font-bold text-slate-900">
                    ₹{((Number((data.elevatorDiscountPrice && Number(data.elevatorDiscountPrice) > 0 ? data.elevatorDiscountPrice : data.elevatorPrice) || 0) + Number((data.shaftDiscountPrice && Number(data.shaftDiscountPrice) > 0 ? data.shaftDiscountPrice : data.shaftPrice) || 0)) * 1.18).toLocaleString('en-IN')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowWhatsAppModal(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSendWhatsApp}
                disabled={isSendingWhatsApp}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSendingWhatsApp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>Send via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. EXCEL EXPORT MODAL */}
      {showExcelModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto m-2 sm:m-0">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900">
                    Export Stage-wise Changes (Excel)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Side-by-side comparison for Stage 1 vs 2 vs 3
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Enter Offer Number / Base Code:
                </label>
                <input
                  type="text"
                  value={excelOfferNo}
                  onChange={(e) => setExcelOfferNo(e.target.value)}
                  placeholder="e.g. AE/QTN/AE-261026-131"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-teal-500 font-mono font-bold text-slate-800"
                />
                <p className="text-[10px] text-slate-400 mt-1">
                  Exports a detailed multi-stage comparison sheet covering specifications, pricing, stops, door details, warranties, and exact changes for this customer.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowExcelModal(false)}
                className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleExportExcel(excelOfferNo)}
                className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 3. CRM APPROVAL SUCCESS MODAL */}
      {showCrmApproveModal && crmApproveResult && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-fade-in backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-emerald-300 space-y-4 max-h-[90vh] overflow-y-auto m-2 sm:m-0">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto text-2xl shadow-inner">
                🎉
              </div>
              <h3 className="text-base font-black text-slate-900">
                Quotation Approved by CRM!
              </h3>
              <p className="text-xs text-slate-600">
                New Customer profile and Project have been automatically provisioned in CRM.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              {/* Customer Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-emerald-800 tracking-wide">
                  New Customer Created
                </span>
                <div className="text-sm font-black text-emerald-950">
                  {crmApproveResult.customer?.customerId}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {crmApproveResult.customer?.fullName}
                </div>
                <div className="text-[11px] text-slate-600">
                  📞 {crmApproveResult.customer?.phoneNumber}
                </div>
                <div className="text-[11px] text-slate-600">
                  📍 {crmApproveResult.customer?.city}
                </div>
              </div>

              {/* Project Box */}
              <div className="bg-teal-50/70 border border-teal-200 rounded-xl p-3.5 space-y-1.5">
                <span className="text-[10px] font-black uppercase text-teal-800 tracking-wide">
                  New Project Created
                </span>
                <div className="text-sm font-black text-teal-950">
                  {crmApproveResult.project?.projectId}
                </div>
                <div className="text-xs font-bold text-slate-800">
                  {crmApproveResult.project?.projectName}
                </div>
                <div className="text-[11px] text-slate-600">
                  ⚙️ {crmApproveResult.project?.liftModel}
                </div>
                <div className="text-[11px] font-bold text-slate-900">
                  💰 Order: ₹{(crmApproveResult.project?.orderValue || 0).toLocaleString('en-IN')}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowCrmApproveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Close
              </button>
              <div className="flex gap-2">
                <Link
                  href="/customers"
                  className="px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <span>Customers</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
                <Link
                  href="/projects"
                  className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-500 hover:to-emerald-500 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Go to Projects</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
