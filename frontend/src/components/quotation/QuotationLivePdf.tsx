'use client';

import React, { useState, useEffect } from 'react';
import { QuotationData, buildPage6WarrantyParagraph, parseDeliveryDays } from '../../types/quotation';
import {
  renderExactPdfPage,
  sanitizeProposalParagraphs,
  buildPage2LetterHtml,
  buildPage5WarrantyHtml,
  buildPage5PaymentTermsHtml,
  getClientSignatureHtml,
} from './exactPdfTemplate';
import { renderCirclePdfPage, sanitizeCircleParagraphs } from './circlePdfTemplate';
import { Edit3, Save, RotateCcw, Check, X } from 'lucide-react';

interface QuotationLivePdfProps {
  data: QuotationData;
  activePage?: number | null; // null means render all pages
  scale?: number;
  isEditing?: boolean;
  onToggleEdit?: () => void;
  onSaveContent?: () => void;
  onResetContent?: () => void;
  savedPages?: { [pageNum: number]: string };
}

export default function QuotationLivePdf({
  data,
  activePage = null,
  scale = 1,
  isEditing: externalIsEditing,
  onToggleEdit: externalOnToggleEdit,
  onSaveContent: externalOnSaveContent,
  onResetContent: externalOnResetContent,
  savedPages: externalSavedPages,
}: QuotationLivePdfProps) {
  const isCircle = data.templateType === 'circle';
  const pages = isCircle ? [1, 2, 3, 4, 5] : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const pagesToRender = activePage ? [activePage] : pages;

  // Local state as fallback if not controlled externally
  const [localIsEditing, setLocalIsEditing] = useState(false);
  const [localSavedPages, setLocalSavedPages] = useState<{ [pageNum: number]: string }>({});
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const isEditing = externalIsEditing !== undefined ? externalIsEditing : localIsEditing;
  const savedPages = externalSavedPages !== undefined ? externalSavedPages : localSavedPages;

  const storageKey = isCircle
    ? `alpha_pdf_edits_circle_${data.offerNo || 'default'}`
    : `alpha_pdf_edits_${data.offerNo || 'default'}`;

  // Load any previously saved custom edits from localStorage if local
  useEffect(() => {
    if (externalSavedPages === undefined) {
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          setLocalSavedPages(JSON.parse(stored));
        }
      } catch (e) {
        console.warn('Could not read saved PDF edits from localStorage', e);
      }
    }
  }, [storageKey, externalSavedPages]);

  // Preload and inject PDF base stylesheet with all embedded @font-face rules into document.head
  useEffect(() => {
    const cssUrl = isCircle ? '/quotation/circle/circle.css' : '/quotation/exact/pdf2html.css';
    const styleId = isCircle ? 'alpha-circle-stylesheet' : 'alpha-exact-stylesheet';
    if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
      fetch(cssUrl)
        .then((res) => res.text())
        .then((cssText) => {
          if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = cssText;
            document.head.appendChild(style);
          }
        })
        .catch((err) => console.warn('Could not inject PDF base stylesheet:', err));
    }
  }, [isCircle]);

  // Handle Save Content button click
  const handleSaveContent = () => {
    if (externalOnSaveContent) {
      externalOnSaveContent();
      return;
    }

    const updated: { [pageNum: number]: string } = { ...savedPages };
    pagesToRender.forEach((pageNum) => {
      const pageEl = document.getElementById(`quotation-page-${pageNum}`);
      if (pageEl) {
        updated[pageNum] = pageEl.innerHTML;
      }
    });

    setLocalSavedPages(updated);
    try {
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch (e) {
      console.warn('Could not save PDF edits to localStorage', e);
    }

    setLocalIsEditing(false);
    setSaveNotice('Live preview changes saved successfully!');
    setTimeout(() => setSaveNotice(null), 3500);
  };

  // Reset to original generated template
  const handleResetToDefault = () => {
    if (externalOnResetContent) {
      externalOnResetContent();
      return;
    }

    if (confirm('Reset this proposal live preview back to the original template? All manual in-preview text edits will be removed.')) {
      setLocalSavedPages({});
      try {
        localStorage.removeItem(storageKey);
      } catch (e) { }
      setLocalIsEditing(false);
      setSaveNotice('Reset to original template.');
      setTimeout(() => setSaveNotice(null), 3000);
    }
  };

  const hasSavedEdits = Object.keys(savedPages).length > 0;

  // Sanitize any previously cached or saved Page 7 broken paragraphs
  const sanitizeOldBrokenParagraph = (html?: string, pageNum?: number) => {
    if (!html) return html;
    let updated = sanitizeProposalParagraphs(html, pageNum || 1, data);

    // Page 2: Ensure new letter content and customer name font color
    if (pageNum === 2 && updated) {
      if (updated.includes('NK Group of Companies') || !updated.includes('Where Vertical Mobility Meets Sophistication')) {
        updated = buildPage2LetterHtml(updated, data);
      }
      updated = updated.replace(
        '<div class="t c9" style="z-index:1263;transform:matrix(1,0,0,1,94.46,200.44)">',
        '<div class="t c8" style="z-index:1263;transform:matrix(1,0,0,1,94.46,200.44);color:#0e4b31;">'
      );
    }

    // Fix Clause 17-28 if old broken text exists
    if (updated.includes('17. The necessary electric') && (updated.includes('would b') || updated.includes('695.55,217.35'))) {
      const targetStart = '<div class="t c23" style="z-index:4034;transform:matrix(1,0,0,1,28.67,217.35)">17. The necessary electric';
      const targetEnd = 'needs to be plumb. </div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.67px;top:217.35px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:4034;">17. The necessary electric and services work would be in your scope of work. 18. Single and three phase, power supply would be required as per the Indian standard 14655(Part2/Sec 1): 2000 Clause 5.2. We would also need the cabling for 3-phase/1-phase for Car, electrical main switches and two separate earthing suitably terminated in the machine room. 19. Incase if power is not available in quantity/quality, you need to provide us with alternative source of power supply through a generator during our commissioning work. 20. Adequate lighting in lift shaft, lobby and storeroom shall be provided as per Alpha Elevators layout 21. Component failure due to poor power supply and weak earthing will not be covered under free replacement 22. No other agency shall tap power from hoistway once the shaft is handed over to Alpha Elevators Storage requirements for lift materials. 23. Availability and possession of a storage room with weather protection &amp; locking arrangement till the complete handover to the building owner. This is required at first floor in the vicinity of the shafts. The store room shall have Adequate lighting arrangement with power plug of 15 Amp. Capacity &amp; ventilation. Storage Area should be Safe, Dry, Lockable and Weatherproof. 24. Storage for heavy materials like Guide rails, Machine, CWT frame, Car package. This area should be accessible by forklift and truck and should be protected from rains and water logging. This area should be within a radius of 50 feet from the lift shafts. 25. Scaffolding to be provided by the client as per relevant IS norms &amp; BOCW Rules 1998 (and amendments thereof if any). 26. For 12/15/16 passenger elevators where shaft walls are in Brick, necessary arrangements for ‘Fixing Brick Fixation Plate’, including scaffolding, fixing and finishing of plates on opposite walls needs to be provided by customer. 27. Service pipes, ventilation duct, electrical conduits etc. for other purpose are not allowed to run in lift well. 28. The hoist way should be without any projections and needs to be plumb.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 1 (Ownership of material) on Page 7 if old broken fragmented divs exist
    if (updated.includes('1. Ownership of material') && (updated.includes('28.64,478.63') || updated.includes('z-index:35;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:35;transform:matrix(1,0,0,1,28.64,478.63)">1. Ownership of material </div>';
      const targetEnd = 'right to take back such material.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.64px;top:478.63px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:35;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">1. Ownership of material </span>Till the final payment is made, the Customer cannot claim right of ownership or lien over any materials. Alpha Elevators shall have the right to take back / reclaim the possession of the same or any part thereof at the Customer’s cost. In case the payment is not made as per the terms of the Contract, Alpha Elevators have the right to dismantle its Equipment’s and take the materials supplied back in its possession. This will be without prejudice to its legal right to recover the unpaid amounts, interest, legal expenses and the cost incurred in dismantling the equipment’s, logistics cost of moving the same, labor cost arising with such dismantling moving and all the applicable taxes/ duties/ cess. Alpha Elevators is not bound to furnish any documentary proof in support of such recoveries. The depreciation in the value of the material / resale value shall also be taken into account. In the event this clause is applied, it is agreed between the parties to this Contract that all the dispatched material and installed parts hereunder shall be removed without any material damage to the property to which it is attached and Alpha Elevators shall retain the title of thereto until the final payment is made by the Customer under the Contract. Any unutilized material, packing material etc. remaining after completion of the job shall remain the property of Alpha Elevators, who shall have the right to take back such material.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 2 (Intellectual Property Rights) on Page 7 if old broken fragmented divs exist
    if (updated.includes('2. Intellectual Property Rights') && (updated.includes('28.64,624.64') || updated.includes('z-index:1493;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:1493;transform:matrix(1,0,0,1,28.64,624.64)">2. Intellectual Property Rights </div>';
      const targetEnd = 'deal in the Control Software.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.64px;top:624.64px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:1493;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">2. Intellectual Property Rights </span>All intellectual property rights in the equipment’s including the control software which enables routine operation, maintenance and repair of the equipment (&quot;Control Software&quot;) remain the property of Alpha Elevators Group. The Customer is entitled to a non-exclusive right to use the Control Software and to operate the Equipment for its own purposes, but the Customer shall have no other right or interest in the Control Software, especially as regards to the right to reproduce, reverse engineer or deal in the Control Software.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 3 (Remobilization & Reconditioning Charges) on Page 7 if old broken fragmented divs exist
    if (updated.includes('3. Remobilization') && (updated.includes('28.64,712.64') || updated.includes('z-index:2055;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:2055;transform:matrix(1,0,0,1,28.64,712.64)">3. Remobilization &amp; Reconditioning Charges </div>';
      const targetEnd = 'to the Customer’s account.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.64px;top:712.64px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:2055;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">3. Remobilization &amp; Reconditioning Charges </span>In case the elevator / escalator installation job is stopped for more than 4 weeks in between due to any reasons not attributable to Alpha Elevators, including unavailability of power supply etc., remobilization charges of 5%.of total Contract Value per elevator / escalator will be charged additional over the Contract Value, whenever Alpha Elevators is asked to restart the job. This would need to be paid upfront before Alpha Elevators restarts any site activity. Alpha Elevators would be entitled for four weeks’ time to remobilize and restart the work. In case, if the material is in a non-workable condition or pilferage, reconditioning or replacement cost shall be to the Customer’s account.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 4 if old broken text exists
    if (updated.includes('4. Termination') && (updated.includes('Cus</div>') || updated.includes('694.24,844.64') || updated.includes('of C</div>') || updated.includes('685.6,856.64'))) {
      const targetStart = '<div class="t c31" style="z-index:2796;transform:matrix(1,0,0,1,28.64,808.64)">4. Termination';
      const targetEnd = 'materials or any part thereof.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.64px;top:808.64px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:2796;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">4. Termination of Contract </span>In the event of cancellation or termination of the Contract by the Customer, Alpha Elevators, in addition to all applicable taxes, shall be charging from the Customer as follows: Before approval of drawings - 10% of the Contract Value. After approval of drawings - 20% of the Contract Value. After release to production - 50% of the Contract Value. After dispatch of materials - 90% of the Contract Value. After start of installation - 100% of the Contract Value. Upon the cancellation or termination of the Contract by the Customer prior to the installation, the Customer cannot claim right of ownership or lien over any materials irrespective of the percentage of Contract value paid. Alpha Elevators identify as Ranalpha Elevators Private Limited shall be entitled to take back/reclaim possession of the materials or any part thereof.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 5 (Force Majeure) on Page 7 if old broken fragmented divs exist
    if (updated.includes('5. Force Majeure') && (updated.includes('28.64,913.42') || updated.includes('z-index:3615;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:3615;transform:matrix(1,0,0,1,28.64,913.42)">5. Force Majeure </div>';
      const targetEnd = 'beyond the reasonable.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:28.64px;top:913.42px;width:736px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:3615;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">5. Force Majeure </span>Alpha Elevators shall not be liable for failure, non-performance or delays in supply or services resulting directly or indirectly from causes beyond its reasonable control, such as, Acts of God, war, act of terrorism, nuclear risks, riots, strike, political unrest, acts of government, its agencies or officers, raw material shortage, labor shortage or any other legitimate cause beyond the reasonable.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Warranty & Maintenance on Page 6 if old broken fragmented divs exist
    if (updated.includes('Warranty') && (updated.includes('33.41,346.51') || updated.includes('303.39,454.54') || updated.includes('z-index:3526;transform') || updated.includes('Warranty &amp; Maintenance'))) {
      const targetStart = '<div class="t c31" style="z-index:3526;transform:matrix(1,0,0,1,33.41,346.51)">Warranty </div>';
      const targetEnd = '<div class="t c23" style="z-index:4676;transform:matrix(1,0,0,1,303.39,454.54)">1 years. </div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      const cleanParagraph = buildPage6WarrantyParagraph(data);
      if (sIdx !== -1 && eIdx !== -1) {
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      } else {
        const pRegex = /<div class="t c23" style="position:absolute;left:33\.41px;top:346\.51px;[\s\S]*?Applicable after \d+ years\.<\/div>/;
        if (pRegex.test(updated)) {
          updated = updated.replace(pRegex, cleanParagraph);
        }
      }
    }

    // Fix Dispatch and Installation on Page 6
    if (updated.includes('Dispatch and Installation') || updated.includes('Delivery of material shall be')) {
      const deliveryDays = data.deliveryDays || parseDeliveryDays(data.deliveryTime) || 120;
      updated = updated.replace(/(Delivery of material shall be )\d+( working days)/, `$1${deliveryDays}$2`);
    }

    // Fix Customer Scope of Work underline on Page 6
    if (updated.includes('Customer Scope of Work')) {
      const scopeUnderlineRegex = /<div class="t c31" style="z-index:8;transform:matrix\(1,0,0,1,33\.41,508\.32\)">Customer Scope of Work:\s*<\/div>/;
      const cleanScope = `<div class="t c31" style="z-index:10;transform:matrix(1,0,0,1,33.41,508.32);background:#ffffff;">Customer Scope of Work: </div><div class="customer-scope-underline-remover" style="position:absolute;left:32px;top:517.5px;width:150px;height:4.5px;background:#ffffff;z-index:9;pointer-events:none;"></div>`;
      if (scopeUnderlineRegex.test(updated)) {
        updated = updated.replace(scopeUnderlineRegex, cleanScope);
      }
    }

    // Fix Page 3 Model Name Font Color
    if (pageNum === 3 || updated.includes('id="p2"') || (updated.includes('Gearless Belt') && updated.includes('310.59,191.55'))) {
      updated = updated.replace(/<div class="t c9" style="z-index:791;transform:matrix\(1,0,0,1,310\.59,191\.55\)[^"]*">/g, '<div class="t c9" style="z-index:791;transform:matrix(1,0,0,1,310.59,191.55);color:#1a3f2e !important;">');
      updated = updated.replace(/<div class="t c9" style="z-index:816;transform:matrix\(1,0,0,1,62\.53,216\.83\)[^"]*">/g, '<div class="t c9" style="z-index:816;transform:matrix(1,0,0,1,62.53,216.83);color:#1a3f2e !important;">');
      updated = updated.replace(/<div class="t c17" style="z-index:729;transform:matrix\(1,0,0,1,346\.53,364\.86\)[^"]*">/g, '<div class="t c17" style="z-index:729;transform:matrix(1,0,0,1,346.53,364.86);color:#1a3f2e !important;">');
    }

    // Fix Page 5 Warranty, Delivery, & Payment Terms in savedPages
    if (pageNum === 5 || updated.includes('Lifetime- MOTOR WARRANTY') || updated.includes('Time of Material Delivery') || updated.includes('years service') || updated.includes('warranty-term-box') || updated.includes('payment-term-stage')) {
      const page5WarrantyHtml = buildPage5WarrantyHtml(data.warranty);
      const warrantyBoxRegex = /<div class="t c26[^"]*warranty-term-box[^"]*"[\s\S]*?(?:<!-- END_WARRANTY_BOX -->|<\/div>\s*<\/div>|<\/div>(?=\s*<\/p>|\s*<\/td>|\s*<div class="t c21"[^>]*>Time of Material Delivery))/;
      const warrantyCellRegex = /<div class="t c26" style="z-index:907;transform:matrix\(1,0,0,1,252\.41,682\.01\)[^"]*">[\s\S]*?(?:years service\.<\/div>|<div class="t c26" style="z-index:1048;transform:matrix\(1,0,0,1,249\.21,710\.81\)[^"]*">[\s\S]*?<\/div>)/;
      const customWarrantyRegex = /<div class="t c26" style="position:absolute;left:25[02]\.?\d*px;top:6[78]\d\.?\d*px;[\s\S]*?<\/div>/;

      if (page5WarrantyHtml && warrantyBoxRegex.test(updated)) {
        updated = updated.replace(warrantyBoxRegex, page5WarrantyHtml);
      } else if (page5WarrantyHtml && warrantyCellRegex.test(updated)) {
        updated = updated.replace(warrantyCellRegex, page5WarrantyHtml);
      } else if (page5WarrantyHtml && customWarrantyRegex.test(updated)) {
        updated = updated.replace(customWarrantyRegex, page5WarrantyHtml);
      }
      if (data.deliveryTime) {
        updated = updated.replace(/\b\d+\s*days post confirmation on drawings and finishes\./, data.deliveryTime);
      }
      if (data.paymentTerms) {
        const page5PaymentHtml = buildPage5PaymentTermsHtml(data.paymentTerms);
        const paymentCellRegex = /<td role="cell" style="display:contents">\s*<p style="display:contents">\s*<div class="t c29[^"]*" style="[^"]*758\.84px[^"]*">[\s\S]*?<\/p>\s*<\/td>/;
        if (paymentCellRegex.test(updated)) {
          updated = updated.replace(paymentCellRegex, page5PaymentHtml);
        } else {
          if (data.paymentTerms.booking) {
            const bText = data.paymentTerms.booking.replace(/^[0-9.]+\s*/, '');
            updated = updated.replace(/\b1\.\s*Booking\s*[–-]\s*\d+%/i, `1. ${bText}`)
                             .replace(/\.\s*Booking\s*[–-]\s*\d+%/i, `. ${bText}`)
                             .replace(/Booking\s*[–-]\s*\d+%/i, bText);
          }
          if (data.paymentTerms.production) {
            const pText = data.paymentTerms.production.replace(/^[0-9.]+\s*/, '');
            updated = updated.replace(/\b2\.\s*Production\s*Amount\s*[–-]\s*\d+%/i, `2. ${pText}`)
                             .replace(/Production\s*Amount\s*[–-]\s*\d+%/i, pText);
          }
          if (data.paymentTerms.readiness) {
            const rText = data.paymentTerms.readiness.replace(/^[0-9.]+\s*/, '');
            updated = updated.replace(/\b3\.\s*Readiness\s*notification\s*[–-]\s*\d+%/i, `3. ${rText}`)
                             .replace(/Readiness\s*notification\s*[–-]\s*\d+%/i, rText);
          }
        }
      }
    }

    // Fix Clause 6 (Right to Use) on Page 8 if old broken fragmented divs exist
    if (updated.includes('6. Right to Use') && (updated.includes('26.05,201.35') || updated.includes('z-index:7;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:7;transform:matrix(1,0,0,1,26.05,201.35)">6. Right to Use </div>';
      const targetEnd = 'own cost and risk.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:201.35px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:7;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">6. Right to Use </span>Neither the Customer nor any third party shall be entitled to use the elevator / escalator for any purpose whatsoever prior to: The formal written handover letter by Alpha Elevators to the Customer The receipt of the full and final payment by Alpha Elevators. The building construction being completed. Any unauthorized use or attempt of unauthorized use shall render the warranty and free maintenance period null and void and all subsequent aspects thereof shall be solely at the Customer’s own cost and risk.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 7 (Liability) on Page 8 if old broken fragmented divs exist
    if (updated.includes('7. Liability') && (updated.includes('26.05,277.35') || updated.includes('z-index:533;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:533;transform:matrix(1,0,0,1,26.05,277.35)">7. Liability </div>';
      const targetEnd = 'of their employees</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:277.35px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:533;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">7. Liability </span>All liabilities of Alpha Elevators regardless whether under the Contract, tort, strict liability or any other theory, shall cease at the end of the warranty period. Alpha Elevators shall under no circumstances be liable for any loss of use or production, loss of profit, interest or revenues, loss of data or for any indirect or consequential damages or losses. The maximum liability of Alpha Elevators to the Customer under or in connection with the Contract shall in no event be higher than 50% of the Contract price actually received by Alpha Elevators. The limitations of liability under this clause shall also apply for Alpha Elevators directors, employees, subcontractors, agents, licensors or any of their employees</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 8 (Contract Clarifications) on Page 8 if old broken fragmented divs exist
    if (updated.includes('376.96') && updated.includes('1268')) {
      const targetStart = '<div class="t c31" style="z-index:1268;transform:matrix(1,0,0,1,26.05,376.96)">8. </div>';
      const targetEnd = 'be supplied at your site</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:376.96px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:1268;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">8. Contract Clarifications </span>This contract of the elevator is considered to be the absolute sale of the elevator and not a separate sales of elevator material and installation. Any installation part of the elevator will be considered to be the part of supply of elevator and it cannot be bifurcated in separate supply and installation of elevator in any condition. The contract price will be the cost of the complete elevator to be supplied at your site</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 9 (Arbitration) on Page 8 if old broken fragmented divs exist
    if ((updated.includes('9.Arbitration') || updated.includes('9. Arbitration')) && (updated.includes('26.05,451.66') || updated.includes('z-index:1719;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:1719;transform:matrix(1,0,0,1,26.05,451.66)">9.Arbitration </div>';
      const targetEnd = 'the language of the arbitration shall be English.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:451.66px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:1719;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">9. Arbitration </span>If any dispute, controversy or claim between the parties arises out of or in connection with this Contract, including its existence, breach, termination or validity thereof, the parties shall use all reasonable endeavors to negotiate with a view to resolve the dispute amicably. If the dispute has not been settled pursuant to the said negotiations even after 15 days, either of the parties can give the other party a notice stating that a dispute has been arisen. If the parties are unable to resolve the dispute amicably within 15 days of service of the said notice (or such longer period as the parties may mutually agree), then the dispute shall be finally resolved by arbitration as per the provisions of Arbitration and Conciliation Act, 1996 by a sole arbitrator to be appointed by Alpha Elevators from the panel of arbitrators maintained by Alpha Elevators. Such panelists shall be persons who is holding or has held the positions of not less than a District Judge or High Court Advocate or a professional arbitrator. Any such arbitration award passed by the said arbitrator shall be final and binding on both the parties. The seat of the arbitration shall be Bangalore and the language of the arbitration shall be English.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 10 (Miscellaneous Provisions) on Page 8 if old broken fragmented divs exist
    if (updated.includes('588.62') && updated.includes('2964')) {
      const targetStart = '<div class="t c31" style="z-index:2964;transform:matrix(1,0,0,1,26.05,588.62)">10. </div>';
      const targetEnd = 'to be kept by each party</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:588.62px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:2964;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">10. Miscellaneous Provisions </span>a. Substantive Law: This Contract shall be governed by and construed in accordance with the laws of India without reference to any other laws. b. Authorized Signatory: Execution of this Contract shall imply that the executants has the capacity and authority to enter into this Contract for and on behalf of the Customer. In case the Contract value is greater than Twenty Five Lacs, Contract shall be deemed to have been executed only when signed by two authorized signatories on Alpha Elevators behalf. c. Precedence: The terms and conditions of this Contract shall have overriding effect and shall take precedence over any other discussions, correspondences, documents, purchase orders or terms, unless agreed by Alpha Elevators in writing about its overriding effect. d. Publicity: Alpha Elevators is identified as Ranalpha Elevators Private Limited shall be entitled to use the project details including but not limited to Customer's name, logos and statement of works as a reference for its publicity / business purposes. e. Confidentiality: Customer acknowledges that all project details including but not limited to technical, commercial and financial data disclosed to Customer by Alpha Elevators and/or its affiliates is the proprietary confidential information of Alpha Elevators and/or its affiliates. Customer shall not disclose any such confidential information to any third party and shall not use any such confidential information for any purpose other than as agreed by the parties herein. f. Successors and Assigns: The provisions of this Contract shall be binding upon and inure to the benefit of the parties hereto and their respective successors and permitted assigns. Neither this Contract nor any provision hereof is intended to confer upon any third person any rights or remedies under this Contract. g. Assignment and Setoff: Customer shall not assign any rights or obligations under the Contract without the prior written consent of Alpha Elevators. Customer shall have no right to withhold or reduce any payments or to set off existing or future claims against any payments due under the Contract or under any other Contract that Customer may have with Alpha Elevators or any of its affiliates. h. Counterparts: This Contract has been signed in two copies, each of which shall be deemed to be an original to be kept by each party</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    if (updated.includes('d. Publicity: Alpha Elevators shall be') || updated.includes('d. Publicity: Alpha Elevator shall be')) {
      updated = updated.replace(
        /d\.\s*Publicity:\s*Alpha\s*Elevators?\s*shall\s*be/g,
        'd. Publicity: Alpha Elevators is identified as Ranalpha Elevators Private Limited shall be'
      );
    }

    // Fix Clause 11 (Price Variation) on Page 8 if old broken fragmented divs exist
    if (updated.includes('11. Price Variation') && (updated.includes('26.05,825.42') || updated.includes('z-index:5295;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:5295;transform:matrix(1,0,0,1,26.05,825.42)">11. Price Variation </div>';
      const targetEnd = 'calculate price variation.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:26.05px;top:825.42px;width:740px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:5295;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">11. Price Variation </span>The price quoted is based on the raw materials / components and labor costs as on the date of the proposal. Should the market price of principal raw materials of the contractual goods increase during the period between the signing of this contract and the dispatch date, Alpha Elevators shall have the right to adjust the contract price accordingly. The increase in price of principle raw material like mild steel, stainless steel, aluminum, bronze, copper, etc. will be determined by the Wholesale Price Index (WPI) for Metal Products as published by the Reserve Bank of India in its monthly bulletin (available for reference at www.rbi.org.in). The method adopted for calculation of Price variation will on the basis of percentage increase over last six months and average of this increase would be used to calculate price variation.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 13 (Statutory permissions) on Page 9 if old broken fragmented divs exist
    if (updated.includes('13.') && updated.includes('Statutory') && (updated.includes('20.67,199.59') || updated.includes('z-index:6;transform') || updated.includes('z-index:10;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:6;transform:matrix(1,0,0,1,20.67,199.59)">13. </div>';
      const targetEnd = 'Elevators license is not mandatory. </div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:20.67px;top:199.59px;width:746px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:6;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">13. Statutory permissions from various authorities </span>All statutory permissions for starting / executing, completing and handing over the works from various authorities including PWD shall be obtained by the Customer. Fees or any other payment required to be paid, for concerned liaison for getting above work done shall be paid directly by the Customer. While Alpha Elevators will coordinate for inspections required as per statutory requirements as applicable on the date of this Contract, any fees, charges, pertinent license inspectorates and incidental charges for getting work certified and alternative expenses will be to the Customer’s account. Incase of Single-Phase Home Elevators license is not mandatory.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 14 (Preparatory Work) on Page 9 if old broken fragmented divs exist
    if (updated.includes('14. Preparatory Work') && (updated.includes('20.67,286.76') || updated.includes('z-index:720;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:720;transform:matrix(1,0,0,1,20.67,286.76)">14. Preparatory Work </div>';
      const targetEnd = 'Customer’s account.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:20.67px;top:286.76px;width:746px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:720;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">14. Preparatory Work </span>All civil and electrical preparatory work shall remain in Customer’s scope. Customer shall be responsible to provide: A finished dry and lit Hoist-way and machine room as laid out in the Indian Standards 14665: 2000. I beam in Hoist-way as per layout specification. Single Phase MCB with ELCB fixed as per Alpha Elevators approved layout Three Phase RCBO/MCB with ELCB fixed as per Alpha Elevators approved layout. Proper lighting available in shaft, work area and storeroom Service pipes, ventilation ducts, electrical conduits etc. for other purposes are not allowed to run in the lift well. Provision of scaffolding, hoisting beam and pit ladder. Architrave fixing and finishing to be done after fixing of doors and door frames on all floors. Smoke cutout of 450 X 450 mm with aluminum louver and mesh. Full height fascia where the distance between car sill to front wall shaft inside is more than 135mm. Pit floor should be strong enough to bear the load as per layout. RCC soccles for fixing car and cwt. buffers. Adequate dry, safe, lockable and weather-proof storage space in the proximity of the Hoist-way. Adequate insurance coverage against any damage, pilferage or theft at site, for the materials unloaded at Customer’s site and kept in the designated storage area allocated by Customer, as all such storage and safeguarding risk shall be to the Customer’s account.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 15 (Dispatch of Material, Installation and Acceptance) on Page 9 if old broken fragmented divs exist
    if (updated.includes('15. Dispatch of') && (updated.includes('20.67,448.62') || updated.includes('z-index:2118;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:2118;transform:matrix(1,0,0,1,20.67,448.62)">15. Dispatch of </div>';
      const targetEnd = 'Customer of readiness for delivery or performance.</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:20.67px;top:448.62px;width:746px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:2118;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">15. Dispatch of Material, Installation and Acceptance </span>A. Dispatch Alpha Elevators shall give release for ordering of materials (pull) only if following conditions at site are met: Approval of Alpha Elevators Layout drawing from the Customer. Availability of &quot;A&quot; Form Documents from Customer for Submission to PWD / Inspection Authorities. Plastering of Lift shaft walls (If enclosure walls are in Brick). Scaffolding Erected in lift shaft as per Alpha Elevators Drawing. Roof Slab ready with Hoisting &quot;I&quot; Beams grouted and finished on the front and Back Wall (Only for MRL jobs). Fulfillment of Payment Terms against release for ordering of materials. In case the above conditions are not met and site is not made ready as per the above requirement, Alpha Elevators reserve the right to defer the date of dispatch of material and subsequent activities. The Customer will be charged demurrage of Rs 750/- per day in case the material in not accepted at site due to reasons not attributable to Alpha Elevators. In such an event, a fresh completion date will be established depending upon the minimum installation period required. B. Installation: Alpha Elevators shall start Installation work only if following conditions are met: Completion of all technical activities at site as per Alpha Elevators’s check list. Fulfillment of Payment Terms as agreed upon by the parties. In case, site is not made ready as per the checklist even after 2 weeks of dispatch of material at site, remobilization as per clause 12 shall be applicable. C. Acceptance: If the job or any portion thereof is ready for delivery or performance and cannot be delivered or performed due to reasons beyond Alpha Elevators’s control, acceptance of Customer shall be deemed to have taken place upon Alpha Elevators’s notification to Customer of readiness for delivery or performance.</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Clause 16 (Delayed payment and demurrage) on Page 9 if old broken fragmented divs exist
    if (updated.includes('16. Delayed payment') && (updated.includes('20.67,655.36') || updated.includes('z-index:3969;transform'))) {
      const targetStart = '<div class="t c31" style="z-index:3969;transform:matrix(1,0,0,1,20.67,655.36)">16. Delayed payment and demurrage Alpha Elevators</div>';
      const targetEnd = 'the minimum installation period required</div>';
      const sIdx = updated.indexOf(targetStart);
      const eIdx = updated.indexOf(targetEnd);
      if (sIdx !== -1 && eIdx !== -1) {
        const cleanParagraph = `<div class="t c23" style="position:absolute;left:20.67px;top:655.36px;width:746px;white-space:normal;line-height:12px;font-family:'f3',sans-serif;font-size:9.28px;color:#0e4b31;text-align:justify;text-justify:inter-word;z-index:3969;"><span class="c31" style="font-family:'f1',sans-serif;font-weight:bold;">16. Delayed payment and demurrage </span>Alpha Elevators shall be entitled to charge interest @ 18% per annum on all overdue invoices / down-payment requests lying unpaid for more than 15 days from its date. Alpha Elevators reserves the right to dispose the Equipment’s or to discontinue work or to withhold the release of completed elevator(s) /escalator(s), at any time until the overdue payments, with interest, shall have been made as per the terms of the Contract and Alpha Elevators has satisfactory assurance that the subsequent payments shall be made on time. If the Customer or any third parties like trade unions / Mathadi unions, etc. causes delays or interruptions in Alpha Elevators performance of contractual obligations hereunder; Alpha Elevators shall not be in breach of the Contract or otherwise be responsible. Any additional cost or expenses incurred or damages suffered including but not limited to trade union expenses / Mathadi expenses shall be to Customer’s account. In case the Customer requests for delaying the delivery after the materials are ready for dispatch, call off charges of Rs 750/- per day shall be applicable towards demurrage and warehouse expenses and a fresh completion date shall be agreed depending upon the minimum installation period required</div>`;
        updated = updated.substring(0, sIdx) + cleanParagraph + updated.substring(eIdx + targetEnd.length);
      }
    }

    // Fix Page 4 (Elevator Specifications: ensure proper rows according to EV model)
    if (updated.includes('id="p3"') && updated.includes('Floor Numbering')) {
      const isEv = Boolean(
        (data.model && /\bEV\b|home\s*EV|battery/i.test(data.model)) || (data.battery && data.battery.trim() !== '')
      );
      const rowH = isEv ? '37.2px' : '39.85px';
      const fontSize = isEv ? '12px' : '12.5px';

      const doorOpeningVal =
        data.doorOpening ||
        (['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data.doorAccess)
          ? data.doorAccess
          : 'inline');

      const doorAccessVal =
        data.doorAccess &&
          !['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data.doorAccess)
          ? data.doorAccess
          : 'G - ABCG, 1 - ABCG, 2 - ABCG, 3 - ABCG';

      const batteryRowHtml = isEv ? `
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Battery</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.battery || 'Lithium-ion'}</td>
</tr>` : '';

      const specTable = `<table style="position:absolute;left:58.25px;top:243.5px;width:655.5px;height:558px;border-collapse:collapse;background:#ffffff;z-index:50;border:1px solid #000000;box-sizing:border-box;">
<tbody>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Rated Load</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.ratedLoad || 'Upto 5 Passengers /408 kgs '}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">No of Stops</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.noOfStops || 'G+2'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">No Of Openings</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.noOfOpenings || '3 Openings'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Floor Numbering</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.floorNumbering || 'G,1,2'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Door Opening</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${doorOpeningVal}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Door Access</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${doorAccessVal}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Total Travel Height</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.totalTravelHeight || '7000mm'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Controller</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.controller || 'Indian'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Speed</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.speed || 'Up to 1 m/s'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Machine</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.machine || 'Imported  Motor'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Power Supply</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.powerSupply || 'Single phase 220V'}</td>
</tr>
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Car Size</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.carSize || 'TBC*'}</td>
</tr>${batteryRowHtml}
<tr style="height:${rowH};border-bottom:1px solid #000000;">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Clear Opening</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.clearOpening || 'TBC*'}</td>
</tr>
<tr style="height:${rowH};">
<td style="width:175.25px;text-align:center;vertical-align:middle;border-right:1px solid #000000;font-family:'f1',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">Customer Specific requirements</td>
<td style="width:480.25px;text-align:center;vertical-align:middle;font-family:'f3',sans-serif;font-size:${fontSize};color:#1a3f2e;padding:0;margin:0;">${data.customerSpecificRequirements || 'Nil'}</td>
</tr>
</tbody>
</table>`;

      const tableRegex = /<table style="position:absolute;left:58\.25px;top:243\.5px;[\s\S]*?<\/table>/;
      if (tableRegex.test(updated)) {
        updated = updated.replace(tableRegex, specTable);
      } else {
        const headerMarker = 'Elevator Specifications:';
        const doorMarker = 'Door Specifications:';
        const hIdx = updated.indexOf(headerMarker);
        const dIdx = updated.indexOf(doorMarker);
        if (hIdx !== -1 && dIdx !== -1) {
          const closingP = updated.indexOf('</p>', hIdx);
          const openP = updated.lastIndexOf('<p', dIdx);
          if (closingP !== -1 && openP !== -1 && openP > closingP) {
            updated = updated.substring(0, closingP + 4) + '\n' + specTable + '\n' + updated.substring(openP);
          }
        }
      }
    }

    // If an old 10-page draft saved the back cover under pageNum 10, discard it for Page 10 so the new Dispatch record shows
    if (pageNum === 10 && updated && updated.includes('Our Presence in INDIA')) {
      return renderExactPdfPage(9, data);
    }

    // Ensure Client Signature block reflects the digital signature on Pages 3 to 8 and Page 10
    // Explicitly remove corner Client Signature block from Pages 1, 2, 9, and 11
    if (pageNum && ((pageNum >= 3 && pageNum <= 8) || pageNum === 10) && updated) {
      const clientSignBlock = getClientSignatureHtml(data.clientSignature);
      const clientBoxRegex = /<div class="client-signature-box"[\s\S]*?<\/span>\s*<\/div>/;
      if (clientBoxRegex.test(updated)) {
        updated = updated.replace(clientBoxRegex, clientSignBlock);
      } else {
        const lastCloseDiv = updated.lastIndexOf('</div>');
        if (lastCloseDiv !== -1) {
          updated = updated.substring(0, lastCloseDiv) + clientSignBlock + updated.substring(lastCloseDiv);
        }
      }
    } else if (pageNum && (pageNum === 1 || pageNum === 2 || pageNum === 9 || pageNum === 11) && updated) {
      updated = updated.replace(/<div class="client-signature-box"[\s\S]*?<\/div>/g, '');
    }

    // Page 5 MRP Price strikethrough exact center alignment
    if (pageNum === 5 && updated) {
      updated = updated.replace(
        /<div style="text-decoration:line-through;color:#718096;font-size:10px;">MRP:\s*([^<]+)<\/div>/g,
        '<div style="position:relative;display:inline-block;color:#718096;font-size:10px;line-height:13px;"><span style="text-decoration:none;">MRP: $1</span><span class="mrp-strikethrough-line" style="position:absolute;left:0;width:100%;top:50%;height:1.5px;background:#718096;transform:translateY(-50%);pointer-events:none;"></span></div>'
      );
    }

    // Page 9 main acceptance digital signature injection / cleanup (centered inside the signature cell)
    if (pageNum === 9 && updated) {
      if (data.clientSignature) {
        const page9ClientSig = `<div class="page9-client-digital-sign" style="position:absolute;left:110px;top:923px;width:255px;height:48px;display:flex;align-items:center;justify-content:center;z-index:9500;pointer-events:none;"><img src="${data.clientSignature}" style="max-height:44px;max-width:240px;object-fit:contain;margin:auto;display:block;" alt="Client Signature" /></div>`;
        if (!updated.includes('page9-client-digital-sign')) {
          updated = updated.replace(/(<div class="t c32" style="z-index:5260;transform:matrix\(1,0,0,1,42\.66,946\.4\)">Signature:<\/div>)/, `$1\n${page9ClientSig}`);
        } else {
          updated = updated.replace(/<div class="page9-client-digital-sign"[\s\S]*?<\/div>/, page9ClientSig);
        }
      } else if (updated.includes('page9-client-digital-sign')) {
        updated = updated.replace(/<div class="page9-client-digital-sign"[\s\S]*?<\/div>/g, '');
      }
    } else if (pageNum === 10 && updated) {
      // Remove last empty signature box on Page 10 if present in cached/saved drafts
      if (updated.includes('Client & Authorized Representative Confirmation') || updated.includes('Client &amp; Authorized Representative Confirmation') || updated.includes('Verified & Confirmed by Client:')) {
        updated = updated.replace(/\s*<!-- Confirmation & Dual Acceptance Signatures Card inside the box -->[\s\S]*?Authorized Signatory<\/div>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/div>/g, '');
        updated = updated.replace(/\s*<div style="border:1\.5px solid #0e4b31;border-radius:8px;background:#ffffff;padding:12px 16px;">[\s\S]*?Authorized Signatory<\/div>\s*<\/td>\s*<\/tr>\s*<\/table>\s*<\/div>/g, '');
      }
      // Ensure the 4 empty boxes before contact footer are removed/masked
      if (!updated.includes('top:840px')) {
        const maskDiv = '<div style="position:absolute;left:25px;top:840px;width:745px;height:190px;background:#ffffff;z-index:90;"></div>\n';
        if (updated.includes('<p style="display:contents">\n<div class="t c10" style="z-index:5334')) {
          updated = updated.replace('<p style="display:contents">\n<div class="t c10" style="z-index:5334', maskDiv + '<p style="display:contents">\n<div class="t c10" style="z-index:5334');
        } else if (updated.includes('+91 80151 29224')) {
          updated = updated.replace(/(<[^>]+>\+91 80151 29224)/, maskDiv + '$1');
        }
      }

      // Convert green elements on Page 10 to black / monochrome
      updated = updated.replace(/#0e4b31/g, '#000000');
      updated = updated.replace(/#1a3f2e/g, '#000000');
      updated = updated.replace(/#556b60/g, '#4b5563');
      updated = updated.replace(/#3a5345/g, '#1f2937');
      updated = updated.replace(/#d2ebd9/g, '#e5e7eb');
      updated = updated.replace(/#eef6f1/g, '#f3f4f6');
      updated = updated.replace(/#f7faf8/g, '#f9fafb');
      updated = updated.replace(/#f0f7f3/g, '#f3f4f6');
      updated = updated.replace(/#fafdfb/g, '#ffffff');
      updated = updated.replace(/#fbfdfc/g, '#ffffff');
      updated = updated.replace(/#c2dbcd/g, '#d1d5db');
      updated = updated.replace(/#d5e5dc/g, '#d1d5db');
      updated = updated.replace(/#e2ece6/g, '#e5e7eb');
      updated = updated.replace(/rgba\(14,75,49,0\.06\)/g, 'rgba(0,0,0,0.06)');

      // Ensure Page 10 footer contact elements maintain their exact coordinates and clean styling
      updated = updated.replace(
        /<div[^>]*>[^<]*\+91\s*80151\s*29224[^<]*<\/div>/i,
        '<div class="t c10" style="z-index:5334;transform:matrix(1,0,0,1,98.53,1048.25);color:#000000 !important;">+91 80151 29224</div>'
      );
      updated = updated.replace(
        /<div[^>]*>[^<]*info@alphaelevators\.in[^<]*<\/div>/i,
        '<div class="t c3" style="z-index:5349;transform:matrix(1,0,0,1,329.28,1050.37);color:#000000 !important;">info@alphaelevators.in </div>'
      );
      updated = updated.replace(
        /<div[^>]*>[^<]*(?<!@)(?:www\.)?alphaelevators\.in[^<]*<\/div>/i,
        '<div class="t c3" style="z-index:5373;transform:matrix(1,0,0,1,587.97,1050.37);color:#000000 !important;">alphaelevators.in </div>'
      );
      updated = updated.replace(
        /<div[^>]*>[^<]*99,\s*A-Block[^<]*<\/div>/i,
        '<div class="t c10" style="z-index:5393;transform:matrix(1,0,0,1,107.17,1085.88);color:#000000 !important;">99, A-Block, 3rd  Street, Annanagar, Anna Nagar East, Chennai- 600102, Tamil Nadu</div>'
      );
    } else if (pageNum === 11 && updated) {
      // Ensure Page 11 Contact Details and Presence in INDIA maintain their exact coordinates and clean styling
      updated = updated.replace(
        /<div[^>]*>[^<]*Contact Details:?\s*<\/div>/i,
        '<div class="t c35" style="z-index:14;transform:matrix(1,0,0,1,29.02,805.73);color:#000000 !important;">Contact Details: </div>'
      );
      updated = updated.replace(
        /<div[^>]*>[^<]*Our Presence in INDIA[^<]*<\/div>/i,
        '<div class="t c37" style="z-index:45;transform:matrix(1,0,0,1,28.96,713.41);color:#000000 !important;">Our Presence in INDIA</div>'
      );
    }

    return updated;
  };

  const baseWidth = isCircle ? 720 : 793.28;
  const scaledWidth = Math.round(baseWidth * (scale || 1));
  const pageHeight = isCircle ? 1040 : 1122.72;
  const pageGap = 24; // margin 12px auto (top + bottom)
  const totalUnscaledHeight = pagesToRender.length * (pageHeight + pageGap);
  const totalScaledHeight = Math.ceil(totalUnscaledHeight * (scale || 1));

  return (
    <div className="w-full flex flex-col items-center justify-center">
      {/* 100% Faithful pdf2htmlEX typography & fixed layout styles matching the original PDF */}
      {isCircle ? (
        <link rel="stylesheet" href="/quotation/circle/circle.css" />
      ) : (
        <link rel="stylesheet" href="/quotation/exact/pdf2html.css" />
      )}

      {/* Prominent Action Toolbar for Direct Editing & Save (Centered with exact page width) */}
      <div
        className="no-print w-full mb-4 flex flex-wrap items-center justify-between gap-3 bg-slate-900/95 border-2 border-slate-700/90 px-4 py-3 rounded-2xl shadow-xl z-20"
        style={{
          width: '100%',
          maxWidth: scaledWidth,
          margin: '0 auto',
        }}
      >
        <div className="flex items-center gap-2">
          {isEditing ? (
            <span className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-extrabold animate-pulse">
              <Edit3 className="w-4 h-4 text-amber-400" />
              <span>Editing Active: Click any word, space, or letter on the PDF below to edit directly</span>
            </span>
          ) : (
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping"></span>
              <span className="text-xs font-bold text-white">Live PDF Preview</span>
              {hasSavedEdits ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/30 flex items-center gap-1 font-semibold">
                  <Check className="w-3 h-3" /> Custom Edits Active
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">
                  ({isCircle ? 'Alpha Circle Lift 5-Page Presentation' : 'Standard 11-Page Proposal'})
                </span>
              )}
            </div>
          )}
        </div>

        {/* Buttons: Edit on PDF, Save Content, Reset */}
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <button
                type="button"
                onClick={handleSaveContent}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-emerald-950/50 active:scale-95 cursor-pointer ring-2 ring-emerald-400/50"
                title="Save edited text into live preview"
              >
                <Save className="w-4 h-4" />
                <span>Save Content</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (externalOnToggleEdit) externalOnToggleEdit();
                  else setLocalIsEditing(false);
                }}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                title="Cancel without saving"
              >
                <X className="w-3.5 h-3.5" />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  if (externalOnToggleEdit) externalOnToggleEdit();
                  else setLocalIsEditing(true);
                }}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-lg shadow-amber-950/40 active:scale-95 cursor-pointer"
                title="Edit words, letters, and spaces directly on the PDF"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit on PDF</span>
              </button>
              {hasSavedEdits && (
                <button
                  type="button"
                  onClick={handleResetToDefault}
                  className="px-3 py-2 bg-slate-800 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-700 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 cursor-pointer"
                  title="Revert back to original template"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reset</span>
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Save Notification Toast */}
      {saveNotice && (
        <div
          className="no-print mb-3 px-4 py-2 bg-emerald-900/90 border border-emerald-600 text-emerald-100 rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg animate-fade-in"
          style={{ width: '100%', maxWidth: scaledWidth, margin: '0 auto' }}
        >
          <Check className="w-4 h-4 text-emerald-300" />
          <span>{saveNotice}</span>
        </div>
      )}

      {/* Scaled PDF Document Wrapper: Perfectly centered in flex layout */}
      <div
        className="pdf-scaled-viewport-wrapper relative flex flex-col items-center"
        style={{
          width: scale !== 1 ? `${scaledWidth}px` : `${baseWidth}px`,
          height: scale !== 1 ? `${totalScaledHeight}px` : undefined,
          minHeight: scale !== 1 ? `${totalScaledHeight}px` : undefined,
          margin: '0 auto',
          position: 'relative',
        }}
      >
        <div
          id="quotation-print-container"
          className="exact-pdf-container select-text flex flex-col items-center"
          style={{
            width: baseWidth,
            minWidth: baseWidth,
            maxWidth: baseWidth,
            margin: '0 auto',
            transform: scale !== 1 ? `scale(${scale})` : undefined,
            transformOrigin: 'top left',
            position: scale !== 1 ? 'absolute' : 'relative',
            left: 0,
            top: 0,
            transition: 'transform 0.15s ease-out',
          }}
        >
          {/* Proposal styles: colors, cleanups, and watermark */}
          <style dangerouslySetInnerHTML={{
            __html: `
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
            .exact-pdf-container .page::before,
            .proposal-page-wrapper .page::before {
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
            .exact-pdf-container .page:not(#p0):not(#p1):not(#p10)::after {
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
            .exact-pdf-container .page,
            .proposal-page-wrapper .page {
              margin: 0 !important;
              box-shadow: none !important;
              border-radius: 0 !important;
            }
            .exact-pdf-container * {
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
              text-rendering: geometricPrecision;
            }
          ` }} />
          {pagesToRender.map((pageNum) => {
            const pageIdx = pageNum - 1;
            let baseHtml = savedPages[pageNum];

            if (isCircle) {
              if (!baseHtml) {
                baseHtml = renderCirclePdfPage(pageIdx, data);
              }
              const renderedHtml = sanitizeCircleParagraphs(baseHtml, pageNum, data) || baseHtml;

              return (
                <div
                  key={pageNum}
                  id={`quotation-page-${pageNum}`}
                  contentEditable={isEditing}
                  suppressContentEditableWarning={true}
                  className={`proposal-page-wrapper select-text shadow-2xl my-3 transition-all flex justify-center ${isEditing
                      ? 'ring-4 ring-amber-400 cursor-text hover:ring-amber-300'
                      : ''
                    }`}
                  style={{
                    width: baseWidth,
                    minWidth: baseWidth,
                    maxWidth: baseWidth,
                    minHeight: pageHeight,
                    height: pageHeight,
                    margin: '12px auto',
                    borderRadius: '10px',
                    overflow: 'hidden',
                    backgroundColor: '#ffffff',
                    position: 'relative',
                  }}
                  dangerouslySetInnerHTML={{ __html: renderedHtml }}
                />
              );
            }

            // Standard 11-page template
            if (pageNum === 1 && (!isEditing || !baseHtml || !baseHtml.includes('CLIENT NAME') || !baseHtml.includes('MODEL') || baseHtml.includes('-3.33,641.44') || !baseHtml.includes('page1-dot-remover'))) {
              baseHtml = renderExactPdfPage(0, data);
            } else if (pageNum === 2 && (!isEditing || !baseHtml || baseHtml.includes('NK Group of Companies') || !baseHtml.includes('Where Vertical Mobility Meets Sophistication'))) {
              baseHtml = renderExactPdfPage(1, data);
            } else if (pageNum === 3 && (!isEditing || !baseHtml || baseHtml.includes('490.24,806.2') || !baseHtml.includes('color:#1a3f2e'))) {
              baseHtml = renderExactPdfPage(2, data);
            } else if (pageNum === 5 && !isEditing) {
              baseHtml = renderExactPdfPage(4, data);
            } else if (pageNum === 6 && !isEditing) {
              baseHtml = renderExactPdfPage(5, data);
            } else if (pageNum === 10 && (!isEditing || !baseHtml || baseHtml.includes('Our Presence in INDIA') || baseHtml.includes('#0e4b31'))) {
              baseHtml = renderExactPdfPage(pageIdx, data);
            } else if (!baseHtml) {
              baseHtml = renderExactPdfPage(pageIdx, data);
            }
            const renderedHtml = sanitizeOldBrokenParagraph(baseHtml, pageNum) || baseHtml;

            return (
              <div
                key={pageNum}
                id={`quotation-page-${pageNum}`}
                contentEditable={isEditing}
                suppressContentEditableWarning={true}
                className={`proposal-page-wrapper select-text shadow-2xl my-3 transition-all flex justify-center ${isEditing
                    ? 'ring-4 ring-amber-400 cursor-text hover:ring-amber-300'
                    : ''
                  }`}
                style={{
                  width: baseWidth,
                  minWidth: baseWidth,
                  maxWidth: baseWidth,
                  minHeight: pageHeight,
                  height: pageHeight,
                  margin: '12px auto',
                  borderRadius: '10px',
                  overflow: 'hidden',
                  backgroundColor: '#ffffff',
                  position: 'relative',
                }}
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
