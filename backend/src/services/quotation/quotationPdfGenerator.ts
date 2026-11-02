import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface GenerateQuotationPdfOptions {
  data: any;
  stage: number;
  pdfBase64?: string;
}

/**
 * Ensures the uploads/quotations directory exists and returns the destination file path and URL
 */
export function getQuotationPdfPath(offerNo: string): { filePath: string; relativeUrl: string; fileName: string } {
  const dir = path.resolve(__dirname, '../../../uploads/quotations');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const cleanOfferNo = (offerNo || `AE-${Date.now()}`).replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Alpha_Proposal_${cleanOfferNo}.pdf`;
  const filePath = path.join(dir, fileName);
  const relativeUrl = `/uploads/quotations/${fileName}`;

  return { filePath, relativeUrl, fileName };
}

/**
 * Saves frontend base64 PDF or generates an official PDF proposal using PDFKit
 */
export async function generateOrSaveQuotationPdf(
  options: GenerateQuotationPdfOptions
): Promise<{ filePath: string; relativeUrl: string; fileName: string }> {
  const { data, stage, pdfBase64 } = options;
  const offerNo = data?.offerNo || `AE-QTN-STAGE-${stage}`;
  const { filePath, relativeUrl, fileName } = getQuotationPdfPath(offerNo);

  // 1. If frontend supplied base64 PDF (high-fidelity rendered version), save it directly
  if (pdfBase64 && typeof pdfBase64 === 'string' && pdfBase64.includes('base64,')) {
    try {
      const base64Data = pdfBase64.split('base64,')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(filePath, buffer);
      console.log(`[QuotationPdfGenerator] Saved frontend-rendered PDF: ${fileName} (${buffer.length} bytes)`);
      return { filePath, relativeUrl, fileName };
    } catch (saveErr: any) {
      console.warn('[QuotationPdfGenerator] Error saving base64 PDF, falling back to PDFKit generator:', saveErr.message);
    }
  }

  // 2. Otherwise generate official PDF document using PDFKit
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Alpha Elevators Proposal - ${offerNo}`,
          Author: 'Alpha Elevators Technical Team',
          Subject: `Quotation Proposal for ${data?.clientName || 'Customer'}`,
        },
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      const navy = '#0F2744';
      const teal = '#0D9488';
      const slate = '#334155';
      const lightSlate = '#64748B';
      const bgLight = '#F8FAFC';
      const gold = '#D97706';

      const stageLabel = stage === 1 ? 'Initial Proposal' : stage === 2 ? 'Negotiation Revision' : 'Final Commercial Proposal';

      // ==================== PAGE 1 ====================
      // Top Brand Header Bar
      doc.rect(40, 40, 515, 6).fill(teal);

      // Logo or Brand Title
      const logoCandidates = [
        path.resolve(__dirname, '../../../../frontend/public/logo.png'),
        'C:\\Users\\Ashiqur\\OneDrive\\Desktop\\Alpha CRM\\frontend\\public\\logo.png',
        path.resolve(process.cwd(), 'frontend/public/logo.png'),
      ];
      const logoPath = logoCandidates.find((p) => fs.existsSync(p));

      if (logoPath) {
        doc.roundedRect(40, 52, 185, 42, 6).fill(navy);
        doc.image(logoPath, 48, 57, { width: 169, height: 32 });
      } else {
        doc.fillColor(navy).font('Helvetica-Bold').fontSize(22).text('ALPHA ELEVATORS', 40, 55);
      }

      doc.fillColor(teal).font('Helvetica-Bold').fontSize(12).text('TECHNICAL & COMMERCIAL PROPOSAL', 250, 55, { align: 'right', width: 305 });
      doc.fillColor(slate).font('Helvetica').fontSize(10).text(`Stage ${stage}: ${stageLabel}`, 250, 72, { align: 'right', width: 305 });
      doc.fillColor(lightSlate).font('Helvetica-Bold').fontSize(10).text(`Offer No: ${offerNo}`, 250, 88, { align: 'right', width: 305 });

      // Divider
      doc.moveTo(40, 105).lineTo(555, 105).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Client & Project Info Card
      doc.roundedRect(40, 115, 515, 75, 8).fill(bgLight).strokeColor('#CBD5E1').stroke();
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('CLIENT & PROJECT DETAILS', 55, 125);

      doc.fillColor(lightSlate).font('Helvetica').fontSize(8.5).text('Client Name:', 55, 142);
      doc.fillColor(slate).font('Helvetica-Bold').fontSize(9.5).text(data?.clientName || 'Valued Customer', 130, 142);

      doc.fillColor(lightSlate).font('Helvetica').fontSize(8.5).text('Project Location:', 55, 158);
      doc.fillColor(slate).font('Helvetica-Bold').fontSize(9.5).text(data?.projectCity || 'Chennai', 130, 158);

      doc.fillColor(lightSlate).font('Helvetica').fontSize(8.5).text('Offer Date:', 330, 142);
      doc.fillColor(slate).font('Helvetica-Bold').fontSize(9.5).text(data?.offerDate || new Date().toLocaleDateString('en-GB'), 410, 142);

      doc.fillColor(lightSlate).font('Helvetica').fontSize(8.5).text('Model Selected:', 330, 158);
      doc.fillColor(teal).font('Helvetica-Bold').fontSize(9.5).text(data?.model || 'AE 03 Gearless Belt Home series EV', 410, 158);

      // Salutation & Intro
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(11).text(data?.salutation || `Dear ${data?.clientName || 'Sir/Madam'},`, 40, 205);
      doc.fillColor(slate).font('Helvetica').fontSize(9).text(
        data?.introParagraph1 ||
          'Welcome to Alpha Elevators, where vertical mobility meets sophistication! Powered by NK Group of Companies, we blend Indian ingenuity with Italian craftsmanship to redefine excellence in vertical transportation.',
        40,
        225,
        { width: 515, align: 'justify', lineGap: 3 }
      );

      doc.fillColor(slate).font('Helvetica').fontSize(9).text(
        data?.introParagraph2 ||
          'With a state-of-the-art manufacturing facility in Bangalore and partnerships with Italian companies for motors and controllers, our elevators offer a seamless fusion of precision engineering and artisanal craftsmanship. Backed by over 08 years of expertise, our team ensures effortless installations and reliable servicing.',
        40,
        275,
        { width: 515, align: 'justify', lineGap: 3 }
      );

      // Elevator Specifications Box
      doc.roundedRect(40, 345, 515, 230, 8).fill('#F0FDFA').strokeColor('#99F6E4').stroke();
      doc.fillColor(teal).font('Helvetica-Bold').fontSize(11).text('ELEVATOR TECHNICAL SPECIFICATIONS', 55, 357);

      const doorOpeningVal = data?.doorOpening || (['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data?.doorAccess) ? data.doorAccess : 'inline');
      const doorAccessVal = (data?.doorAccess && !['inline', 'adjacent', 'Opposite Side', 'inline and adjacent', 'Same Side'].includes(data?.doorAccess)) ? data.doorAccess : 'G - ABCD, 1 - ABCD, 2 - ABCD, 3 - ABCD';
      const specs = [
        ['Elevator Model', data?.model || 'AE 03 Gearless Belt Home series EV'],
        ['Number of Stops', data?.noOfStops || 'G+2'],
        ['Total Travel Height', data?.totalTravelHeight || '7000mm'],
        ['Number of Openings', data?.noOfOpenings || '3 Openings'],
        ['Door Opening', doorOpeningVal],
        ['Door Access (Floor-wise)', doorAccessVal],
        ['Door Specifications', data?.doorSpecifications || 'Telescopic Doors- SS 304 Grade'],
        ['Cabin Walls & Finishes', data?.cabinWalls || 'Premium Glass Cabin - SS Finish'],
        ['Operating Panels (COP & LOP)', data?.copAndLop || 'Touch ( TFT Display)'],
        ['Controller & Machine', `${data?.controller || 'Imported'} | ${data?.machine || 'Imported Motor'}`],
        ['Power Supply', data?.powerSupply || 'Single Phase (220V)'],
        ['Shaft Specifications Box', data?.shaftType || 'Glass Shaft'],
        ['Lockable Storage Room', data?.lockableStorageRoom || 'To be Located In the Top Floor'],
      ];

      let currentY = 380;
      specs.forEach(([label, val], idx) => {
        if (idx % 2 === 0) {
          doc.rect(45, currentY - 2, 505, 15).fill(idx % 4 === 0 ? '#E6FFFA' : '#F0FDFA');
        }
        doc.fillColor(navy).font('Helvetica-Bold').fontSize(8).text(label, 55, currentY);
        doc.fillColor(slate).font('Helvetica').fontSize(8).text(String(val), 250, currentY, { width: 290 });
        currentY += 15;
      });

      // Commercial Summary Card
      const elevatorBasic = Number(data?.elevatorPrice || 0);
      const shaftBasic = Number(data?.shaftPrice || 0);
      const subtotal = elevatorBasic + shaftBasic;
      const gstAmount = Math.round((subtotal * (data?.gstRate || 18)) / 100);
      const grandTotal = subtotal + gstAmount;

      doc.roundedRect(40, 590, 515, 120, 8).fill(navy);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(12).text('COMMERCIAL INVESTMENT SCHEDULE', 55, 605);

      doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text('Basic Elevator Equipment Cost:', 55, 628);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(`INR ${elevatorBasic.toLocaleString('en-IN')}`, 320, 628, { align: 'right', width: 220 });

      doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text('Glass / Structural Shaft Scope:', 55, 644);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(`INR ${shaftBasic.toLocaleString('en-IN')}`, 320, 644, { align: 'right', width: 220 });

      doc.fillColor('#94A3B8').font('Helvetica').fontSize(9).text('GST (18% Applicable):', 55, 660);
      doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(9).text(`INR ${gstAmount.toLocaleString('en-IN')}`, 320, 660, { align: 'right', width: 220 });

      doc.moveTo(55, 678).lineTo(540, 678).strokeColor('#334155').lineWidth(1).stroke();

      doc.fillColor('#2DD4BF').font('Helvetica-Bold').fontSize(11).text('TOTAL CONTRACT VALUE (INCL. GST):', 55, 686);
      doc.fillColor('#2DD4BF').font('Helvetica-Bold').fontSize(13).text(`INR ${grandTotal.toLocaleString('en-IN')}`, 320, 685, { align: 'right', width: 220 });

      // Footer
      doc.fillColor(lightSlate).font('Helvetica').fontSize(7.5).text(
        `Alpha Elevators Pvt Ltd • Proposal No: ${offerNo} • Stage ${stage} • Official Technical Document`,
        40,
        760,
        { align: 'center', width: 515 }
      );

      // ==================== PAGE 2 ====================
      doc.addPage();
      doc.rect(40, 40, 515, 6).fill(teal);

      doc.fillColor(navy).font('Helvetica-Bold').fontSize(14).text('TERMS, WARRANTY & SCOPE OF SERVICE', 40, 55);
      doc.fillColor(slate).font('Helvetica').fontSize(9).text(`Proposal Reference: ${offerNo} • Stage ${stage}`, 40, 73);

      doc.moveTo(40, 88).lineTo(555, 88).strokeColor('#E2E8F0').lineWidth(1).stroke();

      // Warranty Section
      doc.roundedRect(40, 100, 515, 95, 8).fill('#FFFBEB').strokeColor('#FDE68A').stroke();
      doc.fillColor(gold).font('Helvetica-Bold').fontSize(11).text('WARRANTY & MAINTENANCE TERMS', 55, 112);

      doc.fillColor(slate).font('Helvetica').fontSize(8.5).text(
        data?.warranty ||
          'Lifetime - MOTOR WARRANTY, 5 years - manufacturing warranty + 1 Years Free Maintenance. Your elevator includes routine servicing and scheduled maintenance by certified technicians.',
        55,
        130,
        { width: 485, lineGap: 3 }
      );

      doc.fillColor(navy).font('Helvetica-Bold').fontSize(8.5).text('Delivery Timeline:', 55, 172);
      doc.fillColor(slate).font('Helvetica').fontSize(8.5).text(
        data?.deliveryTime || `${data?.deliveryDays || 120} days post confirmation on drawings and finishes.`,
        150,
        172
      );

      // Payment Terms Box
      doc.roundedRect(40, 210, 515, 90, 8).fill(bgLight).strokeColor('#CBD5E1').stroke();
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(11).text('PAYMENT SCHEDULE', 55, 222);

      const terms = [
        ['Booking Advance:', data?.paymentTerms?.booking || '30% with confirmed technical specifications & order placement'],
        ['Prior to Production:', data?.paymentTerms?.production || '40% upon approval of civil dimensions, finishes and GA drawings'],
        ['Prior to Dispatch:', data?.paymentTerms?.readiness || '20% upon factory inspection & notice of material readiness'],
        ['On Final Handover:', '10% upon complete mechanical erection, testing and commissioning'],
      ];

      let termY = 242;
      terms.forEach(([milestone, desc]) => {
        doc.fillColor(navy).font('Helvetica-Bold').fontSize(8.5).text(milestone, 55, termY);
        doc.fillColor(slate).font('Helvetica').fontSize(8.5).text(desc, 180, termY, { width: 360 });
        termY += 14;
      });

      // Terms Clauses
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('KEY TERMS & CONDITIONS', 40, 315);

      const clauses = [
        [
          '1. Ownership of Material:',
          'Till final payment is received, ownership remains with Alpha Elevators. All materials dispatched and installed remain property of Alpha Elevators until the full contract value is settled.',
        ],
        [
          '2. Right to Use:',
          'The customer or any third party shall not be entitled to use the elevator prior to the formal written handover letter by Alpha Elevators and receipt of final payments.',
        ],
        [
          '3. Force Majeure:',
          'Alpha Elevators shall not be liable for non-performance or delays resulting from causes beyond reasonable control, acts of government, strikes, or raw material shortages.',
        ],
        [
          '4. Civil & Power Scope:',
          'Three-phase/single-phase power supply, lockable storage room, and unhindered hoistway civil shaft readiness shall be provided as per agreed civil guidance drawings.',
        ],
      ];

      let clauseY = 333;
      clauses.forEach(([title, text]) => {
        doc.fillColor(navy).font('Helvetica-Bold').fontSize(8.5).text(title, 40, clauseY);
        doc.fillColor(slate).font('Helvetica').fontSize(8).text(text, 40, clauseY + 12, { width: 515, lineGap: 2 });
        clauseY += 38;
      });

      // Signatures Box
      doc.roundedRect(40, 520, 515, 140, 8).fill('#F8FAFC').strokeColor('#E2E8F0').stroke();
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(10).text('ACCEPTANCE & SIGNATURES', 55, 535);

      // Customer Sign
      doc.fillColor(lightSlate).font('Helvetica').fontSize(8).text('Client Acceptance Signature:', 55, 560);
      doc.moveTo(55, 615).lineTo(250, 615).strokeColor('#94A3B8').lineWidth(0.8).stroke();
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(9).text(data?.clientSignatoryName || data?.clientName || 'Authorized Signatory', 55, 622);
      doc.fillColor(lightSlate).font('Helvetica').fontSize(8).text(`Date: ${data?.clientSignDate || new Date().toLocaleDateString('en-GB')}`, 55, 636);

      // Alpha Sign
      doc.fillColor(lightSlate).font('Helvetica').fontSize(8).text('For Alpha Elevators Pvt Ltd:', 330, 560);
      doc.moveTo(330, 615).lineTo(525, 615).strokeColor('#94A3B8').lineWidth(0.8).stroke();
      doc.fillColor(navy).font('Helvetica-Bold').fontSize(9).text(data?.alphaSignatoryName || 'Authorized Signatory', 330, 622);
      doc.fillColor(lightSlate).font('Helvetica').fontSize(8).text(`Date: ${data?.alphaSignDate || new Date().toLocaleDateString('en-GB')}`, 330, 636);

      // Footer
      doc.fillColor(lightSlate).font('Helvetica').fontSize(7.5).text(
        `Alpha Elevators Pvt Ltd • Proposal No: ${offerNo} • Stage ${stage} • Official Technical Document`,
        40,
        760,
        { align: 'center', width: 515 }
      );

      doc.end();

      writeStream.on('finish', () => {
        console.log(`[QuotationPdfGenerator] Successfully generated official proposal PDF: ${fileName}`);
        resolve({ filePath, relativeUrl, fileName });
      });

      writeStream.on('error', (err) => {
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

