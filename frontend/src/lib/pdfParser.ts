/**
 * Alpha CRM PDF Helper
 * NOTE: Automatic data scraping into form fields is deliberately BYPASSED per requirements:
 * When a user uploads a proposal PDF, form input fields are NOT overwritten ("not get data").
 * Instead, the uploaded PDF is rendered directly below, and form field changes (such as Client Name)
 * are reflected in realtime onto the uploaded PDF preview.
 */

import { QuotationData } from '../types/quotation';
export async function extractTextFromPdfFile(file: File): Promise<string> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();

      // Ensure pdfjsLib is loaded
      let pdfjs: any = (window as any).pdfjsLib;

      if (!pdfjs) {
        await new Promise<void>((res, rej) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            const loaded = (window as any).pdfjsLib;
            if (loaded) {
              loaded.GlobalWorkerOptions.workerSrc =
                'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
              pdfjs = loaded;
              res();
            } else {
              rej(new Error('PDF.js failed to initialize'));
            }
          };
          script.onerror = rej;
          document.head.appendChild(script);
        });
      }

      const loadingTask = pdfjs.getDocument({ data: arrayBuffer });
      const pdfDoc = await loadingTask.promise;
      let fullText = '';

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += `\n--- PAGE ${pageNum} ---\n` + pageText;
      }

      resolve(fullText);
    } catch (err) {
      // Fallback: try raw text decode from ArrayBuffer
      try {
        const text = await file.text();
        resolve(text);
      } catch (fallbackErr) {
        reject(err);
      }
    }
  });
}

/**
 * Intelligently maps extracted text from quotation proposal PDF into QuotationData structure
 */
export function parseQuotationDataFromText(
  rawText: string,
  existingData: QuotationData
): { parsedData: Partial<QuotationData>; matchedFields: string[] } {
  const result: Partial<QuotationData> = {};
  const matchedFields: string[] = [];

  // Helper clean function
  const clean = (str: string) => str.replace(/[\r\n\t]+/g, ' ').trim();

  // 1. Client Name: e.g. "CLIENT NAME: Mr. Rathish Rajakumar" or "Dear Mr. Rathish Rajakumar"
  const clientMatch =
    rawText.match(/CLIENT\s*NAME\s*:\s*([^,\n\r\t]+?)(?=(MODEL|Offer|Project|$|\n))/i) ||
    rawText.match(/Dear\s+([A-Z][a-zA-Z\s\.]+?)(?=(Sub:|\n|\r|$))/i);
  if (clientMatch && clientMatch[1]) {
    const name = clean(clientMatch[1]);
    if (name.length > 2 && name.length < 60) {
      result.clientName = name;
      result.clientSignatoryName = name;
      result.salutation = `Dear ${name}`;
      matchedFields.push('Client Name');
    }
  }

  // 2. Project City: e.g. "Project City: Chennai"
  const cityMatch = rawText.match(/Project\s*City\s*:\s*([^,\n\r\t]+?)(?=(MODEL|Offer|CLIENT|$|\n))/i);
  if (cityMatch && cityMatch[1]) {
    const city = clean(cityMatch[1]);
    if (city.length > 1 && city.length < 40) {
      result.projectCity = city;
      matchedFields.push('Project City');
    }
  }

  // 3. Model: e.g. "MODEL : AE03 Gearless Belt home EV"
  const modelMatch = rawText.match(/MODEL\s*:\s*([^,\n\r\t]+?)(?=(Offer|Project|CLIENT|Sub|$|\n))/i);
  if (modelMatch && modelMatch[1]) {
    const model = clean(modelMatch[1]);
    if (model.length > 2) {
      result.model = model;
      result.seriesTitle = `Alpha Home Series: ${model}`;
      matchedFields.push('Model');
    }
  }

  // 4. Offer No: e.g. "Offer No: AE/QTN/ AE-241026-131" or "OFFER NO: AE/QTN/AE- 261026-131"
  const offerMatch =
    rawText.match(/(?:Offer\s*No|OFFER\s*NO)\s*:\s*([A-Za-z0-9\/\s\-_]+?)(?=(Dear|Sub|MODEL|CLIENT|Project|\n|$))/i) ||
    rawText.match(/(AE\/QTN\/[A-Za-z0-9\s\-_]+)/i);
  if (offerMatch && offerMatch[1]) {
    const offer = clean(offerMatch[1]);
    if (offer.length > 4 && offer.length < 40) {
      result.offerNo = offer;
      matchedFields.push('Offer Number');
    }
  }

  // 5. Subject Line: e.g. "Sub: Supply, Install, test and commission of one Belt Type Home Elevator EV"
  const subMatch = rawText.match(/Sub\s*:\s*([^.\n\r]+)/i);
  if (subMatch && subMatch[1]) {
    const sub = clean(subMatch[1]);
    if (sub.length > 5) {
      result.subject = `Sub: ${sub}`;
      matchedFields.push('Subject');
    }
  }

  // 6. Hoist Way / Shaft Size: e.g. "1450mm X 1800mm"
  const hoistMatch =
    rawText.match(/Clear\s*Hoist\s*Way[^\n\r]*?\s*([0-9]+\s*mm\s*[Xx×]\s*[0-9]+\s*mm)/i) ||
    rawText.match(/([0-9]{3,5}\s*mm\s*[Xx×]\s*[0-9]{3,5}\s*mm)/i);
  if (hoistMatch && hoistMatch[1]) {
    result.hoistWayShaftSize = clean(hoistMatch[1]);
    matchedFields.push('Clear Hoist Way');
  }

  // 7. Pit Depth: e.g. "250mm"
  const pitMatch = rawText.match(/Pit\s*Depth[^\n\r0-9]*([0-9]+\s*mm)/i);
  if (pitMatch && pitMatch[1]) {
    result.pitDepth = clean(pitMatch[1]);
    matchedFields.push('Pit Depth');
  }

  // 8. Min Floor Height: e.g. "3000mm"
  const floorHMatch = rawText.match(/Min\s*Floor\s*Height[^\n\r0-9]*([0-9]+\s*mm)/i);
  if (floorHMatch && floorHMatch[1]) {
    result.minFloorHeight = clean(floorHMatch[1]);
    matchedFields.push('Min Floor Height');
  }

  // 9. Final Stop: e.g. "3300mm"
  const finalStopMatch = rawText.match(/Final\s*Stop[^\n\r0-9]*([0-9]+\s*mm)/i);
  if (finalStopMatch && finalStopMatch[1]) {
    result.finalStop = clean(finalStopMatch[1]);
    matchedFields.push('Final Stop');
  }

  // 10. Cabin Walls: e.g. "SS Cabin"
  const wallsMatch = rawText.match(/Cabin\s*Walls[^\n\r]*?\s*(SS Cabin|Hairline SS|Glass|Stainless Steel[^\n\r]*)/i);
  if (wallsMatch && wallsMatch[1]) {
    result.cabinWalls = clean(wallsMatch[1]);
    matchedFields.push('Cabin Walls');
  }

  // 11. COP & LOP: e.g. "Touch"
  const copMatch = rawText.match(/COP\s*&\s*LOP[^\n\r]*?\s*(Touch|Push Button|Braille[^\n\r]*)/i);
  if (copMatch && copMatch[1]) {
    result.copAndLop = clean(copMatch[1]);
    matchedFields.push('COP & LOP');
  }

  // 12. Rated Load: e.g. "Upto 5 Passengers /408 kgs"
  const loadMatch = rawText.match(/Rated\s*Load[^\n\r]*?\s*([^\n\r]+?)(?=(No of Stops|Speed|Controller|$))/i);
  if (loadMatch && loadMatch[1]) {
    result.ratedLoad = clean(loadMatch[1]);
    matchedFields.push('Rated Load');
  }

  // 13. No of Stops: e.g. "G+2"
  const stopsMatch = rawText.match(/No\s*of\s*Stops[^\n\r]*?\s*(G\+[0-9]+|[0-9]+\s*Stops?)/i);
  if (stopsMatch && stopsMatch[1]) {
    result.noOfStops = clean(stopsMatch[1]);
    matchedFields.push('No of Stops');
  }

  // 14. No Of Openings: e.g. "3 Openings"
  const openingsMatch = rawText.match(/No\s*Of\s*Openings[^\n\r]*?\s*([0-9]+\s*Openings?)/i);
  if (openingsMatch && openingsMatch[1]) {
    result.noOfOpenings = clean(openingsMatch[1]);
    matchedFields.push('No of Openings');
  }

  // 15. Floor Numbering: e.g. "G,1,2"
  const floorNumMatch = rawText.match(/Floor\s*Numbering[^\n\r]*?\s*([G0-9,\s]+)/i);
  if (floorNumMatch && floorNumMatch[1]) {
    result.floorNumbering = clean(floorNumMatch[1]);
    matchedFields.push('Floor Numbering');
  }

  // 15b. Door Access: e.g. "Same Side", "Opposite", etc.
  const doorAccessMatch = rawText.match(/Door\s*Access[^\n\r]*?\s*([A-Za-z0-9\s]+)/i);
  if (doorAccessMatch && doorAccessMatch[1]) {
    result.doorAccess = clean(doorAccessMatch[1]);
    matchedFields.push('Door Access');
  }

  // 16. Total Travel Height: e.g. "7000mm"
  const travelMatch = rawText.match(/Total\s*Travel\s*Height[^\n\r0-9]*([0-9]+\s*mm)/i);
  if (travelMatch && travelMatch[1]) {
    result.totalTravelHeight = clean(travelMatch[1]);
    matchedFields.push('Travel Height');
  }

  // 17. Speed: e.g. "upto 1 m/s"
  const speedMatch = rawText.match(/Speed[^\n\r]*?\s*(upto\s*[0-9\.]+\s*m\/s|[0-9\.]+\s*m\/s)/i);
  if (speedMatch && speedMatch[1]) {
    result.speed = clean(speedMatch[1]);
    matchedFields.push('Speed');
  }

  // 18. Machine: e.g. "Imported Motor"
  const machineMatch = rawText.match(/Machine[^\n\r]*?\s*(Imported Motor|PMSM Motor|Gearless Motor[^\n\r]*)/i);
  if (machineMatch && machineMatch[1]) {
    result.machine = clean(machineMatch[1]);
    matchedFields.push('Machine');
  }

  // 19. Power Supply: e.g. "Single phase 220V"
  const powerMatch = rawText.match(/Power\s*Supply[^\n\r]*?\s*(Single\s*phase\s*220V|Three\s*phase\s*415V[^\n\r]*)/i);
  if (powerMatch && powerMatch[1]) {
    result.powerSupply = clean(powerMatch[1]);
    matchedFields.push('Power Supply');
  }

  // 19b. Battery (EV Model): e.g. "Lithium-ion"
  const batteryMatch = rawText.match(/Battery[^\n\r]*?\s*([A-Za-z0-9\s\-]+)/i);
  if (batteryMatch && batteryMatch[1]) {
    result.battery = clean(batteryMatch[1]);
    matchedFields.push('Battery');
  }

  // 20. Door: e.g. "Auto Telescopic Doors - SS 304 Grade"
  const doorMatch = rawText.match(/DOOR[^\n\r]*?\s*(Auto\s*Telescopic[^\n\r]+|Manual\s*Swing[^\n\r]+)/i);
  if (doorMatch && doorMatch[1]) {
    result.doorSpecifications = clean(doorMatch[1]);
    matchedFields.push('Door Specs');
  }

  // 21. Shaft: e.g. "Shaft-Glass Shaft"
  const shaftMatch = rawText.match(/Shaft\s*Specifications[^\n\r]*?\s*(Shaft-[^\n\r]+|Glass Shaft[^\n\r]*)/i);
  if (shaftMatch && shaftMatch[1]) {
    result.shaftType = clean(shaftMatch[1]);
    matchedFields.push('Shaft Type');
  }

  // 22. Elevator Base Price: e.g. "PRICE MRP Rs. 16,00,000" or "Rs. 16,00,,000"
  const priceMatch = rawText.match(/PRICE\s*MRP\s*Rs\.?\s*([0-9,]+)/i);
  if (priceMatch && priceMatch[1]) {
    const rawDigits = priceMatch[1].replace(/,/g, '');
    const num = parseInt(rawDigits, 10);
    if (!isNaN(num) && num > 10000) {
      result.elevatorPrice = num;
      matchedFields.push('Elevator Price');
    }
  }

  // Elevator Discount Price (if any)
  const elvDiscountMatch = rawText.match(/Elevator[^\n\r]*Discount[^\n\r]*Rs\.?\s*([0-9,]+)/i) || rawText.match(/Discount\s*Price\s*:\s*Rs\.?\s*([0-9,]+)/i);
  if (elvDiscountMatch && elvDiscountMatch[1]) {
    const rawDigits = elvDiscountMatch[1].replace(/,/g, '');
    const num = parseInt(rawDigits, 10);
    if (!isNaN(num) && num > 10000) {
      result.elevatorDiscountPrice = num;
      matchedFields.push('Elevator Discount Price');
    }
  }

  // 23. Shaft Price: e.g. "Shaft price MRP Rs.4,00,000"
  const shaftPriceMatch = rawText.match(/Shaft\s*price\s*MRP\s*Rs\.?\s*([0-9,]+)/i);
  if (shaftPriceMatch && shaftPriceMatch[1]) {
    const rawDigits = shaftPriceMatch[1].replace(/,/g, '');
    const num = parseInt(rawDigits, 10);
    if (!isNaN(num) && num > 10000) {
      result.shaftPrice = num;
      matchedFields.push('Shaft Price');
    }
  }

  // Shaft Discount Price (if any)
  const shaftDiscountMatch = rawText.match(/Shaft[^\n\r]*Discount[^\n\r]*Rs\.?\s*([0-9,]+)/i);
  if (shaftDiscountMatch && shaftDiscountMatch[1]) {
    const rawDigits = shaftDiscountMatch[1].replace(/,/g, '');
    const num = parseInt(rawDigits, 10);
    if (!isNaN(num) && num > 10000) {
      result.shaftDiscountPrice = num;
      matchedFields.push('Shaft Discount Price');
    }
  }

  // 24. Bank Account Number: e.g. "Account number: 70070070031"
  const acctMatch = rawText.match(/Account\s*number\s*:\s*([0-9]+)/i);
  if (acctMatch && acctMatch[1]) {
    result.accountNumber = clean(acctMatch[1]);
    matchedFields.push('Bank Account');
  }

  return { parsedData: result, matchedFields };
}
