'use client';

import React from 'react';
import { QuotationData } from '../../types/quotation';
import { DetectedTextMatch } from '../../lib/pdfRenderer';

interface UploadedPdfLiveViewProps {
  pageImages: string[];
  matches: DetectedTextMatch[];
  data: QuotationData;
  activePage?: number | null;
  scale?: number;
}

export default function UploadedPdfLiveView({
  pageImages,
  matches,
  data,
  activePage = null,
  scale = 1,
}: UploadedPdfLiveViewProps) {
  const pages = pageImages.map((_, idx) => idx + 1);
  const pagesToRender = activePage ? [activePage] : pages;

  // Find matches by key
  const clientNameMatch = matches.find((m) => m.key === 'clientName' && m.page === 1);
  const cityMatch = matches.find((m) => m.key === 'projectCity' && m.page === 1);
  const modelMatch = matches.find((m) => m.key === 'model' && m.page === 1);
  const offerMatch = matches.find((m) => m.key === 'offerNo' && m.page === 1);
  const dearMatch = matches.find((m) => m.key === 'dearSalutation' && m.page === 2);

  const baseWidth = 793.28;
  const scaledWidth = Math.round(baseWidth * (scale || 1));
  const pageHeight = 1122.72;
  const pageGap = 32;
  const totalUnscaledHeight = pagesToRender.length * (pageHeight + pageGap) + 32;
  const totalScaledHeight = Math.ceil(totalUnscaledHeight * (scale || 1));

  return (
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
        className="flex flex-col items-center gap-8 py-4 select-text"
        style={{
          width: baseWidth,
          margin: '0 auto',
          transform: scale !== 1 ? `scale(${scale})` : undefined,
          transformOrigin: 'top left',
          position: scale !== 1 ? 'absolute' : 'relative',
          left: 0,
          top: 0,
          transition: 'transform 0.15s ease-out',
        }}
      >
      {pagesToRender.map((pageNum) => {
        const pageIdx = pageNum - 1;
        const pageImg = pageImages[pageIdx];
        if (!pageImg) return null;

        return (
          <div
            key={pageNum}
            id={`quotation-page-${pageNum}`}
            className="proposal-page bg-white shadow-2xl relative select-text"
            style={{
              width: '210mm',
              height: '297mm',
              minHeight: '297mm',
              maxHeight: '297mm',
              boxSizing: 'border-box',
              position: 'relative',
              overflow: 'hidden',
              margin: '0 auto',
              borderRadius: '10px',
            }}
          >
            {/* The Original Uploaded PDF Page Image as Base Layer */}
            <img
              src={pageImg}
              alt={`Uploaded Proposal Page ${pageNum}`}
              className="w-full h-full object-contain pointer-events-none select-none"
            />

            {/* DYNAMIC REACTIVE OVERLAYS FOR PAGE 1 (Cover Page) */}
            {pageNum === 1 && (
              <div className="absolute inset-0 pointer-events-none font-montserrat">
                {/* 1. Client Name Mask & Live Reflected Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-3 font-montserrat"
                  style={{
                    left: '3.8%',
                    top: clientNameMatch ? `${Math.max(71.8, clientNameMatch.yPercent - 0.7)}%` : '72.8%',
                    width: '60%',
                    height: '4.8%',
                    minHeight: '32px',
                    zIndex: 10,
                  }}
                  title="Client Name reflected live from form input"
                >
                  <span className="font-bold text-[#826529] text-[20.64px] shrink-0 select-none tracking-normal">
                    CLIENT NAME:&nbsp;
                  </span>
                  <span className="font-bold text-[#826529] text-[20.64px] truncate tracking-normal">
                    {data.clientName || 'Mr. Rathish Rajakumar'}
                  </span>
                </div>

                {/* 2. Project City Mask & Live Reflected Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-3 font-montserrat"
                  style={{
                    left: '3.8%',
                    top: cityMatch ? `${Math.max(78.5, cityMatch.yPercent - 0.4)}%` : '79.6%',
                    width: '60%',
                    height: '4.5%',
                    minHeight: '30px',
                    zIndex: 10,
                  }}
                  title="Project City reflected live from form input"
                >
                  <span className="font-bold text-[#826529] text-[20.64px] shrink-0 select-none tracking-normal">
                    Project City:&nbsp;
                  </span>
                  <span className="font-bold text-[#826529] text-[20.64px] truncate tracking-normal">
                    {data.projectCity || 'Chennai'}
                  </span>
                </div>

                {/* 3. Model Mask & Live Reflected Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-3 font-montserrat"
                  style={{
                    left: '3.8%',
                    top: modelMatch ? `${Math.max(84.5, modelMatch.yPercent - 0.4)}%` : '85.6%',
                    width: '60%',
                    height: '4.5%',
                    minHeight: '30px',
                    zIndex: 10,
                  }}
                  title="Model reflected live from form input"
                >
                  <span className="font-bold text-[#826529] text-[20.64px] shrink-0 select-none tracking-normal">
                    MODEL :&nbsp;
                  </span>
                  <span className="font-bold text-[#826529] text-[20.64px] truncate tracking-normal">
                    {data.model || 'AE03 Gearless Belt home EV'}
                  </span>
                </div>

                {/* 4. Offer Number Mask & Live Reflected Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-3 font-montserrat"
                  style={{
                    left: '3.8%',
                    top: offerMatch ? `${Math.max(90.5, offerMatch.yPercent - 0.4)}%` : '91.6%',
                    width: '60%',
                    height: '4.2%',
                    minHeight: '28px',
                    zIndex: 10,
                  }}
                  title="Offer No reflected live from form input"
                >
                  <span className="font-semibold text-[#1a3f2e] text-[17.92px] shrink-0 select-none tracking-normal">
                    Offer No:&nbsp;
                  </span>
                  <span className="font-semibold text-[#1a3f2e] text-[17.92px] truncate tracking-normal">
                    {data.offerNo || 'AE/QTN/ AE-241026-131'}
                  </span>
                </div>
              </div>
            )}

            {/* DYNAMIC REACTIVE OVERLAYS FOR PAGE 2 (Letter Page) */}
            {pageNum === 2 && (
              <div className="absolute inset-0 pointer-events-none font-montserrat">
                {/* Offer No Mask & Value on Page 2 */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-2 font-montserrat"
                  style={{
                    left: '4.2%',
                    top: '13.2%',
                    width: '68%',
                    height: '4.8%',
                    minHeight: '32px',
                    zIndex: 10,
                  }}
                  title="Offer No reflected live from form input"
                >
                  <span className="text-[22.72px] font-black text-[#0e4b31] tracking-wide shrink-0">
                    OFFER NO:&nbsp;
                  </span>
                  <span className="text-[21.28px] font-bold text-[#1a3f2e] tracking-wide truncate">
                    {data.offerNo}
                  </span>
                </div>

                {/* Salutation Mask & Live Reflected Value: Dear [Name] */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-2 font-montserrat"
                  style={{
                    left: dearMatch ? `${Math.max(4.0, dearMatch.xPercent)}%` : '4.2%',
                    top: dearMatch ? `${Math.max(16.0, dearMatch.yPercent - 0.4)}%` : '17.6%',
                    width: '85%',
                    height: '4.6%',
                    minHeight: '30px',
                    zIndex: 10,
                  }}
                  title="Salutation reflected live from form input"
                >
                  <span className="font-bold text-[20px] text-[#0e4b31] shrink-0">
                    Dear&nbsp;
                  </span>
                  <span className="font-bold text-[18.72px] text-[#826529] truncate">
                    {(() => {
                      const raw = data.clientName?.trim() || (data.salutation ? data.salutation.replace(/^Dear\s*/i, '').trim() : '');
                      return (raw ? raw.replace(/^Dear\s*/i, '').trim() : '') || 'Mr. Rathish Rajakumar';
                    })()}
                  </span>
                </div>

                {/* Subject Line Mask & Live Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto pl-2 font-montserrat"
                  style={{
                    left: '4.2%',
                    top: '22.6%',
                    width: '90%',
                    height: '4.0%',
                    minHeight: '24px',
                    zIndex: 10,
                  }}
                  title="Subject line reflected live from form input"
                >
                  <span className="font-normal italic text-[10.72px] text-[#0e4b31] truncate">
                    {data.subject}
                  </span>
                </div>
              </div>
            )}

            {/* DYNAMIC REACTIVE OVERLAYS FOR PAGE 9 (Signatures Page) */}
            {pageNum === 9 && (
              <div className="absolute inset-0 pointer-events-none">
                {/* Client Signature Name Mask & Live Value */}
                <div
                  className="absolute bg-white flex items-center overflow-hidden pointer-events-auto px-1 font-sans"
                  style={{
                    left: '7.2%',
                    bottom: '14.6%',
                    width: '38%',
                    height: '3.4%',
                    minHeight: '22px',
                    zIndex: 10,
                  }}
                  title="Client Signatory Name reflected live from form input"
                >
                  <span className="font-bold text-slate-900 text-[11px] shrink-0">Name:&nbsp;</span>
                  <span className="text-slate-900 text-[11px] font-bold truncate">
                    {data.clientSignatoryName || data.clientName}
                  </span>
                </div>

                {/* Alpha Signatory Name Mask & Live Value */}
                <div
                  className="absolute bg-slate-50 flex items-center overflow-hidden pointer-events-auto px-1 font-sans"
                  style={{
                    left: '52.2%',
                    bottom: '14.6%',
                    width: '38%',
                    height: '3.4%',
                    minHeight: '22px',
                    zIndex: 10,
                  }}
                  title="Alpha Representative Name reflected live from form input"
                >
                  <span className="font-bold text-slate-900 text-[11px] shrink-0">Name:&nbsp;</span>
                  <span className="text-slate-900 text-[11px] font-bold truncate">
                    {data.alphaSignatoryName || data.representativeName}
                  </span>
                </div>
              </div>
            )}
          </div>
        );
      })}
      </div>
    </div>
  );
}
