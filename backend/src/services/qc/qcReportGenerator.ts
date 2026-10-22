import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface QCReportData {
  reportId?: string;
  reportDate: string;
  region: string;
  jobNo: string;
  clientName: string;
  clientPhone: string;
  visitCount?: string;
  technician?: string;
  technicianEmail?: string;
  quotationNo?: string;
  automationCode?: string;

  propertyStage: string;
  installationArea: string;
  product: string;
  floorConfig: number | string;
  doorClosing?: string;
  clientSignatureType?: string;

  shaftG?: number | string;
  shaftA?: number | string;
  shaftB?: number | string;
  shaftC?: number | string;
  shaftAccuracy?: string;
  plasterStatus?: string;

  floorMeasurements?: any;
  totalTravel?: number | string;
  totalShaft?: number | string;
  pitClient?: number | string;

  wallSpecifications?: any;
  attendees?: Array<{ role: string; present: boolean; name: string; phone: string }>;

  clientRepName?: string;
  clientRepPhone?: string;
  timeIn?: string;
  timeOut?: string;
  technicianSignature?: string;
  clientSign?: string;
  remarks?: string;
  photos?: Record<string, string[]>;
  supportPhotos?: Array<{ name: string; dataUrl: string }>;
  uploadedFiles?: any;
}

/**
 * Generates an official, beautifully styled PDF for the Elevator Pre-Production Site Inspection
 */
export async function generateQCReportPdf(
  data: QCReportData
): Promise<{ buffer: Buffer; filePath?: string; relativeUrl?: string; fileName: string }> {
  const qcReportsDir = path.resolve(__dirname, '../../../uploads/qc-reports');
  if (!fs.existsSync(qcReportsDir)) {
    fs.mkdirSync(qcReportsDir, { recursive: true });
  }

  const cleanJobNo = (data.jobNo || 'SITE-REPORT').replace(/[^a-zA-Z0-9_-]/g, '_');
  const cleanClient = (data.clientName || 'Client').replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `PreProduction-Report-${cleanJobNo}-${cleanClient}-${Date.now().toString().slice(-4)}.pdf`;
  const filePath = path.join(qcReportsDir, fileName);
  const relativeUrl = `/uploads/qc-reports/${fileName}`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 36, bottom: 20, left: 36, right: 36 },
        bufferPages: true,
        info: {
          Title: `Elevator Site Report/Pre-Production - ${data.jobNo}`,
          Author: 'Alpha Elevators Quality Control Team',
          Subject: `Site Report/Pre-Production for ${data.clientName}`,
          Creator: 'Alpha Elevators CRM System',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Font Registration (Poppins Font)
      const fontDirCandidates = [
        path.resolve(__dirname, '../../../assets/fonts'),
        path.resolve(__dirname, '../../assets/fonts'),
        path.resolve(process.cwd(), 'assets/fonts'),
        path.resolve(process.cwd(), 'backend/assets/fonts'),
      ];
      const fontDir = fontDirCandidates.find((d) => fs.existsSync(path.join(d, 'Poppins-Regular.ttf')));

      let fontRegular = 'Helvetica';
      let fontBold = 'Helvetica-Bold';
      let fontMedium = 'Helvetica';
      let fontSemiBold = 'Helvetica-Bold';

      if (fontDir) {
        doc.registerFont('Poppins', path.join(fontDir, 'Poppins-Regular.ttf'));
        doc.registerFont('Poppins-Bold', path.join(fontDir, 'Poppins-Bold.ttf'));
        fontRegular = 'Poppins';
        fontBold = 'Poppins-Bold';

        if (fs.existsSync(path.join(fontDir, 'Poppins-Medium.ttf'))) {
          doc.registerFont('Poppins-Medium', path.join(fontDir, 'Poppins-Medium.ttf'));
          fontMedium = 'Poppins-Medium';
        } else {
          fontMedium = 'Poppins';
        }

        if (fs.existsSync(path.join(fontDir, 'Poppins-SemiBold.ttf'))) {
          doc.registerFont('Poppins-SemiBold', path.join(fontDir, 'Poppins-SemiBold.ttf'));
          fontSemiBold = 'Poppins-SemiBold';
        } else {
          fontSemiBold = 'Poppins-Bold';
        }
      }

      doc.font(fontRegular);

      // Colors
      const navy = '#000000';
      const blue = '#2563EB';
      const darkSlate = '#000000';
      const slate = '#475569';
      const lightBg = '#F3F6FB';
      const borderCol = '#DBE3EE';
      const green = '#059669';

      const logoCandidates = [
        path.resolve(__dirname, '../../../../frontend/public/logo.png'),
        'C:\\Users\\Ashiqur\\OneDrive\\Desktop\\Alpha CRM\\frontend\\public\\logo.png',
        path.resolve(process.cwd(), '../frontend/public/logo.png'),
        path.resolve(process.cwd(), 'frontend/public/logo.png'),
      ];
      const logoPath = logoCandidates.find((p) => fs.existsSync(p));

      // ==========================================
      // PAGE 1: Job, Property & Measurements
      // ==========================================

      // Header Banner
      doc.rect(36, 36, 523, 72).fill(navy);

      if (logoPath) {
        doc.image(logoPath, 48, 48, { width: 130, height: 48 });
      } else {
        doc.fillColor('#FFFFFF').font(fontBold).fontSize(16).text('ALPHA ELEVATORS', 48, 52);
        doc.fillColor('#00cccc').font(fontRegular).fontSize(9).text('ENGINEERING & QUALITY CONTROL', 48, 70);
      }

      // Title on Header
      doc.fillColor('#FFFFFF').font(fontBold).fontSize(14).text('SITE REPORT/PRE-PRODUCTION', 200, 48, { align: 'right', width: 345 });
      doc.fillColor('#BAE6FD').font(fontRegular).fontSize(8.5).text('Digital Technical Site Inspection & Measurement Verification', 200, 66, { align: 'right', width: 345 });
      doc.fillColor('#94A3B8').font(fontRegular).fontSize(8).text(`Job No: ${data.jobNo || 'N/A'}  |  Date: ${data.reportDate || new Date().toISOString().slice(0, 10)}`, 200, 82, { align: 'right', width: 345 });

      let currentY = 118;

      // Section 1: Job & Client Details
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('1. JOB & CLIENT DETAILS', 44, currentY + 4);
      currentY += 22;

      // Info Grid (2 Columns, 5 Rows)
      const col1X = 40;
      const col2X = 300;
      const rowH = 14;

      const detailsLeft = [
        ['Report Date', data.reportDate || 'N/A'],
        ['Region / Location', data.region || 'Tamil Nadu'],
        ['Job No. / Order', data.jobNo || 'N/A'],
        ['Client Name', data.clientName || 'N/A'],
        ['Client Contact', data.clientPhone || 'N/A'],
      ];

      const detailsRight = [
        ['Site Visit Count', data.visitCount ? `Visit #${data.visitCount}` : '1st Visit'],
        ['Technician Name', data.technician || 'Not Specified'],
        ['Technician Email', data.technicianEmail || 'N/A'],
        ['Quotation Number', data.quotationNo || data.automationCode || 'N/A'],
      ];

      doc.fontSize(8.5);
      detailsLeft.forEach(([label, val], idx) => {
        const y = currentY + idx * rowH;
        doc.font(fontBold).fillColor(slate).text(`${label}:`, col1X, y, { width: 95 });
        doc.font(fontRegular).fillColor(darkSlate).text(String(val), col1X + 100, y, { width: 150 });
      });

      detailsRight.forEach(([label, val], idx) => {
        const y = currentY + idx * rowH;
        doc.font(fontBold).fillColor(slate).text(`${label}:`, col2X, y, { width: 95 });
        doc.font(fontRegular).fillColor(darkSlate).text(String(val), col2X + 100, y, { width: 150 });
      });

      currentY += Math.max(detailsLeft.length, detailsRight.length) * rowH + 8;

      // Section 2: Property & Elevator Details
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('2. PROPERTY & ELEVATOR SPECIFICATIONS', 44, currentY + 4);
      currentY += 22;

      const propLeft = [
        ['Property Stage', data.propertyStage || 'Planning'],
        ['Installation Area', data.installationArea || 'Indoor'],
        ['Product Series', data.product || 'Standard'],
      ];

      const stopsLabel = data.floorConfig ? `G+${Number(data.floorConfig) - 1} (${data.floorConfig} Stops)` : '2 Stops';
      const propRight = [
        ['Floor Config', stopsLabel],
        ['Door Closing Side', data.doorClosing || 'Not confirmed'],
        ['Client Confirmation', data.clientSignatureType || 'Confirmed'],
      ];

      propLeft.forEach(([label, val], idx) => {
        const y = currentY + idx * rowH;
        doc.font(fontBold).fillColor(slate).text(`${label}:`, col1X, y, { width: 95 });
        doc.font(fontRegular).fillColor(darkSlate).text(String(val), col1X + 100, y, { width: 150 });
      });

      propRight.forEach(([label, val], idx) => {
        const y = currentY + idx * rowH;
        doc.font(fontBold).fillColor(slate).text(`${label}:`, col2X, y, { width: 95 });
        doc.font(fontRegular).fillColor(darkSlate).text(String(val), col2X + 100, y, { width: 150 });
      });

      currentY += propLeft.length * rowH + 8;

      // Section 3: Shaft & Floor Measurements
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('3. SHAFT & FLOOR MEASUREMENTS (Dimensions in mm)', 44, currentY + 4);
      currentY += 22;

      // Shaft Box Grid (4 dimensions + Accuracy + Plaster)
      doc.rect(36, currentY, 523, 34).fillAndStroke(lightBg, borderCol);
      const shaftCols = [
        { label: 'Shaft G-Side (W)', val: data.shaftG ? `${data.shaftG} mm` : '-' },
        { label: 'Shaft A-Side (D)', val: data.shaftA ? `${data.shaftA} mm` : '-' },
        { label: 'Shaft B-Side', val: data.shaftB ? `${data.shaftB} mm` : '-' },
        { label: 'Shaft C-Side', val: data.shaftC ? `${data.shaftC} mm` : '-' },
        { label: 'Accuracy', val: data.shaftAccuracy || 'Approximate' },
        { label: 'Plaster', val: data.plasterStatus || 'Without plaster' },
      ];

      const sBoxW = 523 / shaftCols.length;
      shaftCols.forEach((col, idx) => {
        const x = 36 + idx * sBoxW;
        doc.font(fontRegular).fontSize(7.5).fillColor(slate).text(col.label, x + 2, currentY + 5, { width: sBoxW - 4, align: 'center' });
        doc.font(fontBold).fontSize(8.5).fillColor(navy).text(col.val, x + 2, currentY + 18, { width: sBoxW - 4, align: 'center' });
        if (idx > 0) {
          doc.moveTo(x, currentY).lineTo(x, currentY + 34).strokeColor(borderCol).lineWidth(0.5).stroke();
        }
      });

      currentY += 40;

      // Dynamic Measurements Table
      const stops = Math.max(2, Math.min(7, Number(data.floorConfig) || 2));
      const colLabels: string[] = ['Pit Height'];
      for (let i = 0; i < stops - 1; i++) {
        colLabels.push(i === 0 ? 'Flr 0 to 1' : `Flr ${i} to ${i + 1}`);
      }
      colLabels.push('Headroom');

      const colCount = colLabels.length;
      const detailColW = 95;
      const dataColW = (523 - detailColW) / colCount;

      // Header row
      doc.rect(36, currentY, 523, 16).fill(navy);
      doc.fillColor('#FFFFFF').font(fontBold).fontSize(7.5).text('Measurement Detail', 40, currentY + 4, { width: detailColW - 8 });

      colLabels.forEach((label, idx) => {
        const x = 36 + detailColW + idx * dataColW;
        doc.text(label, x, currentY + 4, { width: dataColW, align: 'center' });
      });
      currentY += 16;

      // Rows
      const mRows = [
        { label: 'Height (mm)', key: 'Height' },
        { label: 'Accuracy', key: 'Accuracy' },
        { label: 'Door Opening Side', key: 'DoorSide' },
        { label: 'Door-1 Hinges', key: 'Door1Hinge' },
        { label: 'Door-2 Hinges', key: 'Door2Hinge' },
        { label: 'Door-1 DO (mm)', key: 'Door1DO' },
        { label: 'Door-2 DO (mm)', key: 'Door2DO' },
      ];

      const fm = data.floorMeasurements || {};
      const mKeys: string[] = ['pit'];
      for (let i = 0; i < stops - 1; i++) mKeys.push(`travel${i}`);
      mKeys.push('headroom');

      mRows.forEach((row, rIdx) => {
        const rowBg = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, currentY, 523, 14).fillAndStroke(rowBg, borderCol);

        doc.fillColor(navy).font(fontBold).fontSize(7.5).text(row.label, 40, currentY + 3, { width: detailColW - 8 });

        mKeys.forEach((key, cIdx) => {
          const x = 36 + detailColW + cIdx * dataColW;
          const valName = key + row.key;
          const cellVal = fm[valName] !== undefined && fm[valName] !== '' ? String(fm[valName]) : '-';
          doc.fillColor(darkSlate).font(fontRegular).fontSize(7.5).text(cellVal, x, currentY + 3, { width: dataColW, align: 'center' });
        });
        currentY += 14;
      });

      currentY += 6;

      // Totals Box
      doc.rect(36, currentY, 523, 26).fillAndStroke('#ECFDF5', '#A7F3D0');
      const totalTravelVal = data.totalTravel ? `${data.totalTravel} mm` : 'Calculated on Site';
      const totalShaftVal = data.totalShaft ? `${data.totalShaft} mm` : 'To be confirmed';
      const pitClientVal = data.pitClient ? `${data.pitClient} mm` : 'Standard';

      doc.font(fontBold).fontSize(8.5).fillColor('#065F46')
        .text(`Total Travel: ${totalTravelVal}`, 48, currentY + 8)
        .text(`Total Shaft Height: ${totalShaftVal}`, 215, currentY + 8)
        .text(`Pit to Provide: ${pitClientVal}`, 400, currentY + 8);

      // ==========================================
      // PAGE 2: Wall Construction, Attendees, Signatures
      // ==========================================
      doc.addPage();

      // Top mini header on Page 2
      doc.rect(36, 36, 523, 30).fill(navy);
      doc.fillColor('#FFFFFF').font(fontBold).fontSize(11).text('ALPHA ELEVATORS — SITE REPORT/PRE-PRODUCTION', 48, 44);
      doc.fillColor('#00cccc').font(fontRegular).fontSize(8).text(`Job No: ${data.jobNo || 'N/A'}  |  Client: ${data.clientName || 'N/A'}`, 350, 46, { align: 'right', width: 200 });

      currentY = 76;

      // Section 4: Shaft Wall Construction Specifications
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('4. SHAFT WALL CONSTRUCTION SPECIFICATIONS', 44, currentY + 4);
      currentY += 22;

      // Wall matrix table
      const wallSides = ['G', 'A', 'B', 'C'];
      const wallSideLabels: Record<string, string> = {
        G: 'G-Side (Front/Door)',
        A: 'A-Side (Back)',
        B: 'B-Side (Right)',
        C: 'C-Side (Left)',
      };

      const wallColW = (523 - 110) / stops;

      // Wall Table Header
      doc.rect(36, currentY, 523, 16).fill(navy);
      doc.fillColor('#FFFFFF').font(fontBold).fontSize(8).text('Wall Side', 42, currentY + 4, { width: 105 });
      for (let i = 0; i < stops; i++) {
        const x = 36 + 110 + i * wallColW;
        doc.text(i === 0 ? 'Floor "0"' : `Floor "${i}"`, x, currentY + 4, { width: wallColW, align: 'center' });
      }
      currentY += 16;

      const ws = data.wallSpecifications || {};
      wallSides.forEach((side, rIdx) => {
        const rowBg = rIdx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, currentY, 523, 16).fillAndStroke(rowBg, borderCol);

        doc.fillColor(navy).font(fontBold).fontSize(7.5).text(wallSideLabels[side] || `${side}-Side`, 42, currentY + 4, { width: 105 });

        for (let i = 0; i < stops; i++) {
          const x = 36 + 110 + i * wallColW;
          const key = `wallFloor${i}${side}`;
          const val = ws[key] || '9-inch Brick Wall';
          doc.fillColor(darkSlate).font(fontRegular).fontSize(7).text(val, x + 2, currentY + 4, { width: wallColW - 4, align: 'center' });
        }
        currentY += 16;
      });

      currentY += 12;

      // Section 5: Attendees During Site Visit
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('5. ATTENDEES DURING SITE VISIT', 44, currentY + 4);
      currentY += 22;

      // Attendees Table Header
      doc.rect(36, currentY, 523, 15).fill(navy);
      doc.fillColor('#FFFFFF').font(fontBold).fontSize(8)
        .text('Role / Designation', 42, currentY + 3, { width: 180 })
        .text('Status', 230, currentY + 3, { width: 60, align: 'center' })
        .text('Attendee Name', 300, currentY + 3, { width: 130 })
        .text('Contact Number', 440, currentY + 3, { width: 110 });
      currentY += 15;

      const defaultAttendeeRoles = [
        'End Client (Owner)',
        'Architect',
        'Electrician',
        'Fabricator / Civil Person',
        'Client Representative',
        'Sales Person',
        'Technical Team / Person',
      ];

      const attendeesData = data.attendees || [];

      defaultAttendeeRoles.forEach((role, idx) => {
        const match = attendeesData.find((a) => {
          if (a.role === role) return true;
          if (role === 'Sales Person' && (a.role === 'Alpha Elevators Sales Person' || a.role === 'Sales Person')) return true;
          if (role === 'Technical Team / Person' && (a.role === 'Alpha Elevators Technical Team / Person' || a.role === 'Technical Team / Person')) return true;
          return false;
        }) || { role, present: false, name: '', phone: '' };
        const rowBg = idx % 2 === 0 ? '#FFFFFF' : '#F8FAFC';
        doc.rect(36, currentY, 523, 14).fillAndStroke(rowBg, borderCol);

        doc.fillColor(navy).font(fontBold).fontSize(7.5).text(role, 42, currentY + 3, { width: 180 });
        doc.font(fontBold).fontSize(7.5);
        if (match.present) {
          doc.fillColor(green).text('PRESENT', 230, currentY + 3, { width: 60, align: 'center' });
        } else {
          doc.fillColor(slate).text('Absent', 230, currentY + 3, { width: 60, align: 'center' });
        }

        doc.font(fontRegular).fontSize(7.5).fillColor(darkSlate)
          .text(match.name || '-', 300, currentY + 3, { width: 130 })
          .text(match.phone || '-', 440, currentY + 3, { width: 110 });

        currentY += 14;
      });

      currentY += 12;

      // Section 6: Remarks & Site Confirmation
      doc.rect(36, currentY, 523, 18).fill('#00cccc');
      doc.fillColor(navy).font(fontBold).fontSize(9.5).text('6. REMARKS, CIVIL COMMITMENTS & SITE CONFIRMATION', 44, currentY + 4);
      currentY += 22;

      // Remarks Box
      doc.rect(36, currentY, 523, 44).fillAndStroke(lightBg, borderCol);
      doc.font(fontBold).fontSize(8).fillColor(slate).text('Site Observations, Pending Civil Work & Client Commitments:', 44, currentY + 5);
      doc.font(fontRegular).fontSize(8).fillColor(darkSlate)
        .text(data.remarks || 'Site dimensions and wall specifications verified by technical team during visit.', 44, currentY + 17, { width: 507, height: 26, ellipsis: true });
      currentY += 50;

      // Signatures & Timings Box
      doc.rect(36, currentY, 523, 56).fillAndStroke('#FFFFFF', borderCol);

      doc.font(fontBold).fontSize(8).fillColor(slate)
        .text('Time In:', 44, currentY + 8)
        .text('Time Out:', 150, currentY + 8)
        .text('Client Representative:', 270, currentY + 8)
        .text('Contact No:', 420, currentY + 8);

      doc.font(fontRegular).fontSize(8.5).fillColor(darkSlate)
        .text(data.timeIn || 'N/A', 88, currentY + 8)
        .text(data.timeOut || 'N/A', 198, currentY + 8)
        .text(data.clientRepName || data.clientName || 'N/A', 368, currentY + 8)
        .text(data.clientRepPhone || data.clientPhone || 'N/A', 475, currentY + 8);

      // Signature lines
      doc.moveTo(44, currentY + 42).lineTo(220, currentY + 42).strokeColor('#94A3B8').lineWidth(0.8).stroke();
      doc.moveTo(330, currentY + 42).lineTo(515, currentY + 42).strokeColor('#94A3B8').lineWidth(0.8).stroke();

      doc.font(fontBold).fontSize(7.5).fillColor(navy)
        .text(`Technician: ${data.technicianSignature || data.technician || 'Dinesh Kumar S'}`, 44, currentY + 45)
        .text(`Client Signature: ${data.clientSign || data.clientName || 'Confirmed'}`, 330, currentY + 45);

      currentY += 66;

      // Extract section 7 & 8 photos into renderable items
      const photoCategories: Array<{ key: string; label: string }> = [
        { key: 'photoOutside', label: '1. Outside from property' },
        { key: 'photoGroundFloor', label: '2. From ground floor' },
        { key: 'photoAllLandings', label: '3. All Landing Floor' },
        { key: 'photoPit', label: '4. Showing the pit' },
        { key: 'photoShaftTop', label: '5. Inside shaft top view' },
        { key: 'photoShaftDown', label: '6. Top shaft down view' },
        { key: 'photoPowerPack', label: '7. Power Pack Area' },
        { key: 'videoObstacles', label: '8. Video / obstacle reference' },
      ];

      const attachedPhotoItems: Array<{ title: string; subtitle: string; buffer: Buffer }> = [];

      if (data.photos) {
        photoCategories.forEach((cat) => {
          const list = data.photos![cat.key];
          if (Array.isArray(list) && list.length > 0) {
            list.forEach((item, idx) => {
              if (typeof item === 'string' && (item.startsWith('data:image') || item.startsWith('data:application/octet-stream'))) {
                try {
                  const base64Data = item.split(',')[1] || item;
                  const buf = Buffer.from(base64Data, 'base64');
                  if (buf.length > 50) {
                    attachedPhotoItems.push({
                      title: cat.label,
                      subtitle: list.length > 1 ? `Shot ${idx + 1} of ${list.length}` : 'Site Inspection Photo',
                      buffer: buf,
                    });
                  }
                } catch (e) {
                  console.warn(`[QC PDF] Failed to parse buffer for ${cat.key}:`, e);
                }
              }
            });
          }
        });
      }

      if (Array.isArray(data.supportPhotos)) {
        data.supportPhotos.forEach((item, idx) => {
          if (item && item.dataUrl && (item.dataUrl.startsWith('data:image') || item.dataUrl.startsWith('data:application/octet-stream'))) {
            try {
              const base64Data = item.dataUrl.split(',')[1] || item.dataUrl;
              const buf = Buffer.from(base64Data, 'base64');
              if (buf.length > 50) {
                attachedPhotoItems.push({
                  title: item.name ? `Support: ${item.name}` : `Supporting Site Document ${idx + 1}`,
                  subtitle: 'Technical Drawing / Document',
                  buffer: buf,
                });
              }
            } catch (e) {
              console.warn(`[QC PDF] Failed to parse supportPhoto ${idx}:`, e);
            }
          }
        });
      }

      // Photo Checklist Summary Box on Page 2
      doc.rect(36, currentY, 523, 30).fillAndStroke('#F1F5FB', borderCol);
      doc.font(fontBold).fontSize(7.5).fillColor(navy)
        .text(`Site Photos & Documentation Verification (${attachedPhotoItems.length} Photo(s) Attached):`, 44, currentY + 5);

      const photoChecksText = photoCategories.map((c) => {
        const count = data.photos?.[c.key]?.length || 0;
        const shortName = c.label.replace(/^\d+\.\s*/, '');
        return `${shortName} [${count > 0 ? `✓ ${count}` : '—'}]`;
      }).join('   ');
      doc.font(fontRegular).fontSize(6.8).fillColor(slate).text(photoChecksText, 44, currentY + 16, { width: 507 });

      // ==========================================
      // PAGE 3+: High-Resolution Photo Gallery
      // ==========================================
      if (attachedPhotoItems.length > 0) {
        const photosPerPage = 4;
        const cardW = 255;
        const cardH = 330;
        const colX = [36, 304];
        const rowY = [78, 424];

        for (let i = 0; i < attachedPhotoItems.length; i++) {
          const pageItemIdx = i % photosPerPage;
          if (pageItemIdx === 0) {
            doc.addPage();

            // Top Header Banner on Photo Page
            doc.rect(36, 36, 523, 30).fill(navy);
            doc.fillColor('#FFFFFF').font(fontBold).fontSize(11)
              .text('ALPHA ELEVATORS — SITE INSPECTION PHOTOS', 48, 44);
            doc.fillColor('#00cccc').font(fontRegular).fontSize(8)
              .text(`Job No: ${data.jobNo || 'N/A'}  |  Client: ${data.clientName || 'N/A'}`, 350, 46, { align: 'right', width: 200 });
          }

          const col = pageItemIdx % 2;
          const row = Math.floor(pageItemIdx / 2);
          const cardX = colX[col];
          const cardY = rowY[row];
          const item = attachedPhotoItems[i];

          // Outer Card
          doc.roundedRect(cardX, cardY, cardW, cardH, 4).fillAndStroke('#FFFFFF', '#CBD5E1');

          // Header Bar
          doc.rect(cardX, cardY, cardW, 20).fill('#1E3A5F');
          doc.fillColor('#FFFFFF').font(fontBold).fontSize(8)
            .text(`[${i + 1}/${attachedPhotoItems.length}] ${item.title}`, cardX + 8, cardY + 6, { width: cardW - 16, ellipsis: true });

          // Embedded Image
          try {
            doc.image(item.buffer, cardX + 6, cardY + 24, {
              fit: [cardW - 12, cardH - 46],
              align: 'center',
              valign: 'center',
            });
          } catch (imgErr: any) {
            console.error(`[QC PDF] Image embed error for ${item.title}:`, imgErr);
            doc.rect(cardX + 6, cardY + 24, cardW - 12, cardH - 46).fill('#F8FAFC');
            doc.font(fontRegular).fontSize(8).fillColor('#64748B')
              .text('Photo Attached (Inspect via Alpha CRM)', cardX + 10, cardY + 140, { width: cardW - 20, align: 'center' });
          }

          // Footer Bar
          doc.rect(cardX, cardY + cardH - 18, cardW, 18).fill('#F1F5F9');
          doc.fillColor('#059669').font(fontBold).fontSize(7)
            .text('✓ QC Site Verified Photo', cardX + 8, cardY + cardH - 13);
          doc.fillColor('#64748B').font(fontRegular).fontSize(7)
            .text(item.subtitle, cardX + 110, cardY + cardH - 13, { width: cardW - 118, align: 'right' });
        }
      }

      // Page numbers on all pages
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        const savedBottomMargin = doc.page.margins.bottom;
        doc.page.margins.bottom = 0; // Prevent auto page break when rendering footer

        doc.rect(36, 804, 523, 0.5).fill('#CBD5E1');
        doc.font(fontRegular).fontSize(7).fillColor(slate)
          .text('Alpha Elevators Customer CRM & QC Inspection System • Confidential Site Report/Pre-Production', 36, 808, { width: 350, lineBreak: false })
          .text(`Page ${i + 1} of ${totalPages}`, 420, 808, { width: 139, align: 'right', lineBreak: false });

        doc.page.margins.bottom = savedBottomMargin;
      }

      doc.end();

      writeStream.on('finish', () => {
        const buffer = Buffer.concat(chunks);
        resolve({ buffer, filePath, relativeUrl, fileName });
      });

      writeStream.on('error', (err) => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}
