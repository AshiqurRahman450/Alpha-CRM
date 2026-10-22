import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';

export interface ReceiptData {
  payment: any;
  project: any;
  customer: any;
}

/**
 * Generates an official, beautifully styled PDF receipt for a payment
 */
export async function generatePaymentReceiptPdf(
  payment: any,
  project: any,
  customer: any
): Promise<{ filePath: string; relativeUrl: string; fileName: string }> {
  const receiptsDir = path.resolve(__dirname, '../../../uploads/receipts');
  if (!fs.existsSync(receiptsDir)) {
    fs.mkdirSync(receiptsDir, { recursive: true });
  }

  const cleanReceiptNum = (payment.receiptNumber || `REC-${project.projectId || 'GEN'}-${Date.now().toString().slice(-4)}`)
    .replace(/[^a-zA-Z0-9_-]/g, '_');
  const fileName = `Receipt-${cleanReceiptNum}.pdf`;
  const filePath = path.join(receiptsDir, fileName);
  const relativeUrl = `/uploads/receipts/${fileName}`;

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margin: 40,
        info: {
          Title: `Alpha Elevators Receipt - ${payment.receiptNumber}`,
          Author: 'Alpha Elevators CRM',
          Subject: `Payment Receipt for Project ${project.projectName}`,
        },
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Colors
      const navy = '#0F2744';
      const slate = '#475569';
      const lightSlate = '#94A3B8';
      const emerald = '#059669';
      const rose = '#E11D48';
      const bgLight = '#F8FAFC';

      // --- HEADER ---
      // Top colored accent bar
      doc.rect(40, 40, 515, 6).fill(navy);

      // Subtle Brand Watermark in background
      const logoBlackCandidates = [
        path.resolve(__dirname, '../../../../frontend/public/logo-black.png'),
        'C:\\Users\\Ashiqur\\OneDrive\\Desktop\\Alpha CRM\\frontend\\public\\logo-black.png',
        path.resolve(process.cwd(), '../frontend/public/logo-black.png'),
        path.resolve(process.cwd(), 'frontend/public/logo-black.png'),
      ];
      const logoBlackPath = logoBlackCandidates.find((p) => fs.existsSync(p));

      if (logoBlackPath && fs.existsSync(logoBlackPath)) {
        doc.save();
        doc.opacity(0.04);
        doc.image(logoBlackPath, 155, 260, { width: 280 });
        doc.restore();
      }

      // Company Branding Logo
      const logoCandidates = [
        'C:\\Users\\Ashiqur\\OneDrive\\Desktop\\Alpha CRM\\frontend\\public\\logo.png',
        path.resolve(__dirname, '../../../../frontend/public/logo.png'),
        path.resolve(process.cwd(), '../frontend/public/logo.png'),
        path.resolve(process.cwd(), 'frontend/public/logo.png'),
      ];
      const logoPath = logoCandidates.find((p) => fs.existsSync(p));

      if (logoPath && fs.existsSync(logoPath)) {
        // Render logo inside a navy brand pill so white & cyan brand elements are sharp and high-contrast
        doc.roundedRect(40, 52, 185, 42, 6).fill(navy);
        doc.image(logoPath, 48, 57, { width: 169, height: 32 });
      } else if (logoBlackPath && fs.existsSync(logoBlackPath)) {
        doc.image(logoBlackPath, 40, 52, { width: 175 });
      } else {
        doc.fillColor(navy)
          .font('Helvetica-Bold')
          .fontSize(22)
          .text('ALPHA ELEVATORS', 40, 60);
      }

      doc.fillColor(slate)
        .font('Helvetica')
        .fontSize(9)
        .text('Premium Home Lifts & Automation Solutions', 40, 100);

      doc.fontSize(7.5)
        .fillColor(slate)
        .text('123, Alpha Tower, Industrial Estate, Chennai, Tamil Nadu - 600001', 40, 114)
        .text('Email: info@alphaelevators.com  |  Phone: +91 98765 43210  |  GSTIN: 33ABCDE1234F1Z5', 40, 125);

      // Receipt Title Box (Right aligned)
      doc.rect(365, 55, 190, 75).fillAndStroke(bgLight, '#E2E8F0');
      doc.fillColor(navy)
        .font('Helvetica-Bold')
        .fontSize(14)
        .text('PAYMENT RECEIPT', 375, 65, { align: 'center', width: 170 });

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(slate)
        .text(`Receipt No: `, 375, 88)
        .font('Helvetica-Bold')
        .fillColor(navy)
        .text(payment.receiptNumber || cleanReceiptNum, 440, 88);

      const payDate = payment.paymentDate ? new Date(payment.paymentDate) : new Date();
      doc.font('Helvetica')
        .fillColor(slate)
        .text(`Date: `, 375, 102)
        .font('Helvetica-Bold')
        .fillColor(navy)
        .text(payDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }), 440, 102);

      doc.font('Helvetica')
        .fillColor(slate)
        .text(`Project Code: `, 375, 116)
        .font('Helvetica-Bold')
        .fillColor(navy)
        .text(project.projectId || 'N/A', 440, 116);

      // Divider line
      doc.moveTo(40, 145).lineTo(555, 145).strokeColor('#CBD5E1').lineWidth(1).stroke();

      // --- CUSTOMER & PROJECT INFO CARDS ---
      const cardY = 160;
      const cardWidth = 250;
      const cardHeight = 100;

      // Card 1: Billed To
      doc.rect(40, cardY, cardWidth, cardHeight).fillAndStroke(bgLight, '#E2E8F0');
      doc.fillColor(navy)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('BILLED TO (CUSTOMER)', 50, cardY + 10);

      const custName = customer?.fullName || payment.customerName || 'Valued Client';
      doc.fillColor(slate)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(custName, 50, cardY + 28);

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(slate)
        .text(`Phone: ${customer?.phoneNumber || 'N/A'}`, 50, cardY + 44)
        .text(`Email: ${customer?.email || 'N/A'}`, 50, cardY + 58)
        .text(customer?.city ? `${customer.city}, ${customer.state || ''}` : 'Site Location Provided', 50, cardY + 72);

      // Card 2: Project Details
      doc.rect(305, cardY, cardWidth, cardHeight).fillAndStroke(bgLight, '#E2E8F0');
      doc.fillColor(navy)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('PROJECT & INSTALLATION SITE', 315, cardY + 10);

      doc.fillColor(slate)
        .font('Helvetica-Bold')
        .fontSize(11)
        .text(project.projectName || 'Alpha Lift Project', 315, cardY + 28);

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(slate)
        .text(`Site: ${project.siteAddress || 'Registered Address'}`, 315, cardY + 44, { width: 230 })
        .text(`Lift Model: ${project.liftModel || 'Standard'}`, 315, cardY + 72);

      // --- PAYMENT PARTICULARS TABLE ---
      const tableY = 280;

      // Table Header
      doc.rect(40, tableY, 515, 24).fill(navy);
      doc.fillColor('#FFFFFF')
        .font('Helvetica-Bold')
        .fontSize(9)
        .text('PARTICULARS / DESCRIPTION', 50, tableY + 7)
        .text('REFERENCE', 260, tableY + 7)
        .text('PAYMENT TYPE', 370, tableY + 7)
        .text('AMOUNT (INR)', 455, tableY + 7, { align: 'right', width: 90 });

      // Row 1: Payment Received
      const row1Y = tableY + 24;
      doc.rect(40, row1Y, 515, 50).fillAndStroke('#FFFFFF', '#E2E8F0');

      doc.fillColor(navy)
        .font('Helvetica-Bold')
        .fontSize(10)
        .text('Payment Received', 50, row1Y + 10);

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(slate)
        .text(`Via ${payment.paymentMethod || 'Bank Transfer'}`, 50, row1Y + 24)
        .text(payment.notes ? `Note: ${payment.notes}` : 'Official Alpha Elevators Milestone Collection', 50, row1Y + 36, { width: 200 });

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor(slate)
        .text(payment.transactionReference || 'REF-N/A', 260, row1Y + 16);

      doc.font('Helvetica-Bold')
        .fontSize(9)
        .fillColor(navy)
        .text(payment.paymentType || 'Milestone Payment', 370, row1Y + 16);

      doc.font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(emerald)
        .text(`Rs. ${(payment.amountPaid || 0).toLocaleString('en-IN')}`, 455, row1Y + 15, { align: 'right', width: 90 });

      // --- FINANCIAL SUMMARY BOX ---
      const summaryY = 350;
      doc.rect(305, summaryY, 250, 115).fillAndStroke(bgLight, '#CBD5E1');

      doc.fillColor(slate)
        .font('Helvetica')
        .fontSize(9)
        .text('Total Contract Value:', 320, summaryY + 15)
        .font('Helvetica-Bold')
        .fillColor(navy)
        .text(`Rs. ${(project.orderValue || 0).toLocaleString('en-IN')}`, 430, summaryY + 15, { align: 'right', width: 110 });

      doc.font('Helvetica')
        .fillColor(slate)
        .text('Total Paid to Date:', 320, summaryY + 38)
        .font('Helvetica-Bold')
        .fillColor(navy)
        .text(`Rs. ${(project.totalPaid || 0).toLocaleString('en-IN')}`, 430, summaryY + 38, { align: 'right', width: 110 });

      // Separator inside summary
      doc.moveTo(320, summaryY + 62).lineTo(540, summaryY + 62).strokeColor('#E2E8F0').lineWidth(1).stroke();

      const balanceAmt = Math.max(0, (project.orderValue || 0) - (project.totalPaid || 0));
      doc.font('Helvetica-Bold')
        .fontSize(10)
        .fillColor(navy)
        .text('Remaining Balance:', 320, summaryY + 75)
        .fontSize(13)
        .fillColor(balanceAmt > 0 ? rose : emerald)
        .text(`Rs. ${balanceAmt.toLocaleString('en-IN')}`, 430, summaryY + 73, { align: 'right', width: 110 });

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(lightSlate)
        .text(balanceAmt === 0 ? 'Full Payment Completed' : 'Payment Milestone Pending', 320, summaryY + 95, { align: 'right', width: 220 });

      // Payment Status Stamp / Badge
      doc.rect(40, summaryY, 240, 115).fillAndStroke('#ECFDF5', '#A7F3D0');
      doc.fillColor(emerald)
        .font('Helvetica-Bold')
        .fontSize(12)
        .text('PAYMENT CONFIRMED', 55, summaryY + 20);

      doc.font('Helvetica')
        .fontSize(9)
        .fillColor('#065F46')
        .text(`Status: SUCCESSFUL`, 55, summaryY + 42)
        .text(`Recorded via Alpha Elevators CRM`, 55, summaryY + 58)
        .text(`Payment Gateway / Ref: ${payment.transactionReference}`, 55, summaryY + 74, { width: 210 });

      // --- FOOTER & SIGN-OFF ---
      const footerY = 510;
      doc.moveTo(40, footerY).lineTo(555, footerY).strokeColor('#E2E8F0').lineWidth(1).stroke();

      doc.font('Helvetica')
        .fontSize(8)
        .fillColor(slate)
        .text('Terms & Conditions:', 40, footerY + 12)
        .fontSize(7.5)
        .fillColor(lightSlate)
        .text('1. All payments are subject to realization of cheque / RTGS transfer.', 40, footerY + 25)
        .text('2. This is an authentic computer-generated receipt from Alpha Elevators CRM and requires no physical signature.', 40, footerY + 36)
        .text('3. For inquiries or clarification, please reach out to accounts@alphaelevators.com or contact your assigned CRM executive.', 40, footerY + 47);

      // Bottom bar
      doc.rect(40, 770, 515, 20).fill(navy);
      doc.fillColor('#FFFFFF')
        .font('Helvetica')
        .fontSize(8)
        .text('Alpha Elevators — Engineering Safety, Elegance & Trust | www.alphaelevators.com', 40, 776, { align: 'center', width: 515 });

      doc.end();

      writeStream.on('finish', () => {
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
