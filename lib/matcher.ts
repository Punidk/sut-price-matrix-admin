import {
  PricingType,
  PriceMatrixItem,
  normalizeExpenseCategory,
  SutExpenseCategory,
} from "./types";
import { normalizeUnit } from "./normalizer";

export interface LookupParams {
  name: string;
  rawUnit?: string;
  category?: string;
  unitPrice?: number;
  personCount?: number;
  docDate?: string | Date | null;
  note?: string;
}

export interface LookupResult {
  matchedItem: PriceMatrixItem | null;
  matchedPrice: number;
  pricingType: PricingType;
  maxCap: number | null;
  exclusiveWith: string[];
  matchType:
    | "EXACT_NAME_EXACT_UNIT"
    | "EXACT_NAME_COMPATIBLE_UNIT"
    | "FUZZY_NAME_EXACT_UNIT"
    | "FUZZY_NAME_COMPATIBLE_UNIT"
    | "NAME_ONLY"
    | "NONE";
  isUnitMismatch: boolean;
  isRateConditionMismatch: boolean;
  rateMismatchWarning?: string;
  unitWarning?: string;
}

// Helper: ทำความสะอาดข้อความเปรียบเทียบ
export function cleanText(val: string): string {
  return (val || "").trim().toLowerCase();
}

// Helper: ตัดสัญลักษณ์/ลำดับข้อ เช่น "1.1 ", "• ", "- " ออกจากชื่อรายการในตารางของบประมาณ
export function cleanProposalItemName(name: string): string {
  return (name || "")
    .replace(/^[\d\.\-\•\*\s\(\)]+/, "")
    .trim();
}

// Helper: สกัดชื่อรายการหลักโดยตัดข้อความในวงเล็บออก สำหรับเทียบราคากลาง
export function getBaseItemName(name: string): string {
  return cleanProposalItemName(name)
    .replace(/\(.*?\)/g, "")
    .replace(/\[.*?\]/g, "")
    .trim()
    .toLowerCase();
}

// Helper: แปลงสตริงวันที่เป็น Date object รองรับรูปแบบไทยและสากล
export function parseThaiOrIsoDate(dateStr: string): Date | null {
  if (!dateStr || typeof dateStr !== "string") return null;
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  let cleanStr = dateStr.trim();
  thaiDigits.forEach((td, idx) => {
    cleanStr = cleanStr.replaceAll(td, String(idx));
  });
  if (!cleanStr || cleanStr === "-" || cleanStr === "ไม่ระบุ") return null;

  const thaiMonths: Record<string, number> = {
    "มกราคม": 0, "ม.ค.": 0, "ม.ค": 0,
    "กุมภาพันธ์": 1, "ก.พ.": 1, "ก.พ": 1,
    "มีนาคม": 2, "มี.ค.": 2, "มี.ค": 2,
    "เมษายน": 3, "เม.ย.": 3, "เม.ย": 3,
    "พฤษภาคม": 4, "พ.ค.": 4, "พ.ค": 4,
    "มิถุนายน": 5, "มิ.ย.": 5, "มิ.ย": 5,
    "กรกฎาคม": 6, "ก.ค.": 6, "ก.ค": 6,
    "สิงหาคม": 7, "ส.ค.": 7, "ส.ค": 7,
    "กันยายน": 8, "ก.ย.": 8, "ก.ย": 8,
    "ตุลาคม": 9, "ต.ค.": 9, "ต.ค": 9,
    "พฤศจิกายน": 10, "พ.ย.": 10, "พ.ย": 10,
    "ธันวาคม": 11, "ธ.ค.": 11, "ธ.ค": 11,
  };

  for (const [mName, mIdx] of Object.entries(thaiMonths)) {
    if (cleanStr.includes(mName)) {
      const parts = cleanStr.split(mName);
      const dayMatch = parts[0].match(/(\d{1,2})\s*$/);
      const yearMatch = parts[1].match(/^\s*\.?\s*(\d{4})/);
      if (dayMatch && yearMatch) {
        const day = parseInt(dayMatch[1], 10);
        let year = parseInt(yearMatch[1], 10);
        if (year > 2400) year -= 543;
        return new Date(year, mIdx, day);
      }
    }
  }

  const dmyMatch = cleanStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
  if (dmyMatch) {
    const day = parseInt(dmyMatch[1], 10);
    const month = parseInt(dmyMatch[2], 10) - 1;
    let year = parseInt(dmyMatch[3], 10);
    if (year > 2400) year -= 543;
    return new Date(year, month, day);
  }

  const ymdMatch = cleanStr.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/);
  if (ymdMatch) {
    let year = parseInt(ymdMatch[1], 10);
    if (year > 2400) year -= 543;
    const month = parseInt(ymdMatch[2], 10) - 1;
    const day = parseInt(ymdMatch[3], 10);
    return new Date(year, month, day);
  }

  const timestamp = Date.parse(cleanStr);
  if (!isNaN(timestamp)) {
    const d = new Date(timestamp);
    if (d.getFullYear() > 2400) d.setFullYear(d.getFullYear() - 543);
    return d;
  }
  return null;
}

// Helper: ตรวจสอบความเข้ากันได้ของหน่วยนับในเอกสารกับหน่วยในราคากลาง (โดยเฉพาะหน่วยที่มีมิติคน)
export function isUnitCompatible(docUnit: string, matrixUnit: string, personCount: number = 1): boolean {
  const dNorm = normalizeUnit(docUnit);
  const mNorm = normalizeUnit(matrixUnit);
  if (!dNorm || !mNorm) return true;
  if (dNorm === mNorm) return true;

  const d = cleanText(dNorm);
  const m = cleanText(mNorm);
  if (d === m) return true;

  const dClean = d.replace(/\./g, "").replace(/\s+/g, "");
  const mClean = m.replace(/\./g, "").replace(/\s+/g, "");
  if (dClean === mClean) return true;

  // กรณีมิติคน เช่น ในราคากลางระบุ "คน/มื้อ" แต่ในตารางงบเขียน "มื้อ" หรือ "คน/เเมต" กับ "แมต"
  if (personCount > 1 || /คน|ท่าน|ราย/i.test(dClean) || /คน|ท่าน|ราย/i.test(mClean)) {
    if (
      (mClean.includes("มื้อ") && dClean.includes("มื้อ")) ||
      (mClean.includes("วัน") && dClean.includes("วัน")) ||
      (mClean.includes("ชม") && dClean.includes("ชม")) ||
      (mClean.includes("ชั่วโมง") && dClean.includes("ชั่วโมง")) ||
      ((mClean.includes("เเมต") || mClean.includes("แมต")) && (dClean.includes("เเมต") || dClean.includes("แมต"))) ||
      (mClean.includes("คน") && dClean.includes("คน"))
    ) {
      return true;
    }
  }

  // กรณีเอกสารระบุ "บาท/คน/มื้อ" หรือ "บาท/มื้อ" หรือ "บาท/หน่วย"
  if (dClean.startsWith("บาท/")) {
    const stripped = dClean.replace(/^บาท\//, "");
    if (stripped === mClean || (personCount > 1 && mClean.endsWith(stripped))) {
      return true;
    }
  }

  return false;
}

/**
 * ฟังก์ชันค้นหาและจับคู่ราคากลางแบบคำนึงถึงหน่วยนับ (Unit-Aware Matching Engine)
 * - จับคู่ด้วย "ชื่อรายการ" ควบคู่กับ "หน่วยนับ" เสมอ
 * - จัดการรายการชื่อซ้ำหลายหน่วยนับ โดยให้ความสำคัญกับ Exact Unit Match ก่อน Compatible Unit Match
 * - จัดการข้อยกเว้นกรณีเงื่อนไขวันทำการ โดยตรวจคำว่า "วันหยุด" หากไม่มี ให้ Default เป็นอัตราวันทำการปกติ
 * - แนบข้อมูล pricingType, maxCap, exclusiveWith, matchedPrice ในผลลัพธ์
 */
export function findMatchingPriceMatrixItem(
  params: LookupParams,
  priceMatrix: any[]
): LookupResult {
  const rawName = (params.name || "").trim();
  const cleanName = cleanProposalItemName(rawName);
  const baseName = getBaseItemName(rawName);
  const rawUnit = (params.rawUnit || "").trim();
  const normalizedDocUnit = normalizeUnit(rawUnit);
  const cleanDocUnit = cleanText(normalizedDocUnit || rawUnit);
  const personCount = Number(params.personCount) || 1;
  const unitPrice = Number(params.unitPrice) || 0;
  const category = normalizeExpenseCategory(params.category, rawName);

  // 1. ค้นหา Candidate Pool จากชื่อรายการและหมวดหมู่
  let candidates = (priceMatrix || []).filter((pm: any) => {
    const pmName = (pm.itemName || pm.name || "").trim();
    const pmBase = getBaseItemName(pmName);
    const pmCategory = normalizeExpenseCategory(pm.category, pmName);

    const categoryMatches =
      pmCategory === category || category === "หมวดอื่นๆ" || pmCategory === "หมวดอื่นๆ";
    if (!categoryMatches) return false;

    return (
      pmBase === baseName ||
      (baseName.length >= 3 && (pmBase.includes(baseName) || baseName.includes(pmBase)))
    );
  });

  if (candidates.length === 0) {
    return {
      matchedItem: null,
      matchedPrice: 0,
      pricingType: "unit",
      maxCap: null,
      exclusiveWith: [],
      matchType: "NONE",
      isUnitMismatch: false,
      isRateConditionMismatch: false,
    };
  }

  // 2. การจัดการข้อยกเว้นกรณีเงื่อนไขวันทำการ (Workday vs Weekend)
  const hasConditionCandidates = candidates.some((c: any) => {
    const cName = (c.name || c.itemName || "").toLowerCase();
    const cNote = (c.note || "").toLowerCase();
    return (
      c.condition === "WEEKDAY" ||
      c.condition === "WEEKEND" ||
      cName.includes("วันจันทร์") ||
      cName.includes("เสาร์") ||
      cName.includes("อาทิตย์") ||
      cNote.includes("วันหยุด") ||
      cNote.includes("วันทำการ")
    );
  });

  let isRateConditionMismatch = false;
  let rateMismatchWarning: string | undefined;

  if (hasConditionCandidates) {
    const contextText = `${rawName} ${params.note || ""}`.toLowerCase();
    const hasHolidayKeyword = /วันหยุด|เสาร์|อาทิตย์|นักขัตฤกษ์|weekend/i.test(contextText);

    let isDateWeekend = false;
    if (params.docDate) {
      const d =
        typeof params.docDate === "string"
          ? parseThaiOrIsoDate(params.docDate)
          : params.docDate;
      if (d instanceof Date && !isNaN(d.getTime())) {
        const day = d.getDay();
        isDateWeekend = day === 0 || day === 6;
      }
    }

    const isHoliday = hasHolidayKeyword || isDateWeekend;

    const isWeekdayItem = (c: any) =>
      c.condition === "WEEKDAY" ||
      /จันทร์|วันธรรมดา|เวลาราชการ/i.test((c.name || c.itemName || "") + " " + (c.note || ""));
    const isWeekendItem = (c: any) =>
      c.condition === "WEEKEND" ||
      /เสาร์|อาทิตย์|วันหยุด/i.test((c.name || c.itemName || "") + " " + (c.note || ""));

    if (isHoliday) {
      const weekendCandidates = candidates.filter(isWeekendItem);
      if (weekendCandidates.length > 0) {
        candidates = weekendCandidates;
      }
    } else {
      // Default เป็นอัตราวันทำการปกติ (WEEKDAY)
      const weekdayCandidates = candidates.filter(isWeekdayItem);
      const weekendCandidates = candidates.filter(isWeekendItem);
      if (weekdayCandidates.length > 0) {
        // ตรวจสอบกรณีในบิลเบิกอัตราวันหยุดในวันทำการปกติ
        const weekdayMax = Math.max(
          ...weekdayCandidates.map((c) => Number(c.price ?? c.maxPrice ?? c.unitPrice) || 0)
        );
        const weekendMax =
          weekendCandidates.length > 0
            ? Math.max(
                ...weekendCandidates.map((c) => Number(c.price ?? c.maxPrice ?? c.unitPrice) || 0)
              )
            : 0;

        if (weekendMax > weekdayMax && unitPrice >= weekendMax) {
          isRateConditionMismatch = true;
          const targetUnit = weekdayCandidates[0].unit || rawUnit || "คน/วัน";
          rateMismatchWarning = `[อัตราค่าตอบแทนไม่ถูกต้อง: วันที่จัดกิจกรรมตรงกับวันทำการปกติ ต้องใช้อัตรา ${weekdayMax} บาท/${targetUnit} แทนอัตราวันหยุด]`;
        }
        candidates = weekdayCandidates;
      }
    }
  }

  // 3. กรองตามหน่วยนับ: Exact Unit Match มาก่อนเป็นอันดับแรก
  const exactUnitMatches = candidates.filter((c: any) => {
    const cRaw = (c.unit || c.unitType || "").trim();
    const cNorm = normalizeUnit(cRaw);
    return (
      cleanText(cRaw) === cleanText(rawUnit) ||
      cleanText(cNorm) === cleanDocUnit ||
      cleanText(cRaw) === cleanDocUnit ||
      cleanText(cNorm) === cleanText(rawUnit)
    );
  });

  let candidatePool = candidates;
  let matchType: LookupResult["matchType"] = "NAME_ONLY";
  let isUnitMismatch = false;
  let unitWarning: string | undefined;

  if (exactUnitMatches.length > 0) {
    candidatePool = exactUnitMatches;
    const isExactName = candidatePool.some((c: any) => getBaseItemName(c.name || c.itemName || "") === baseName);
    matchType = isExactName ? "EXACT_NAME_EXACT_UNIT" : "FUZZY_NAME_EXACT_UNIT";
  } else {
    // หากไม่ตรงเป๊ะ ให้ใช้หลัก Unit Compatibility
    const compatibleMatches = candidates.filter((c: any) =>
      isUnitCompatible(rawUnit, c.unit || c.unitType || "", personCount)
    );

    if (compatibleMatches.length > 0) {
      candidatePool = compatibleMatches;
      const isExactName = candidatePool.some((c: any) => getBaseItemName(c.name || c.itemName || "") === baseName);
      matchType = isExactName ? "EXACT_NAME_COMPATIBLE_UNIT" : "FUZZY_NAME_COMPATIBLE_UNIT";
    } else {
      isUnitMismatch = cleanDocUnit.length > 0;
      if (isUnitMismatch) {
        const availableUnits = Array.from(new Set(candidates.map((c: any) => c.unit || c.unitType || ""))).join(", ");
        unitWarning = `หน่วยนับ '${rawUnit}' ไม่ตรงกับหน่วยในราคากลาง ('${availableUnits}')`;
      }
    }
  }

  // 4. การเลือกรายการที่ราคาตรงกันหรือเหมาะสมที่สุด
  const exactPriceMatch = candidatePool.find(
    (c: any) => (Number(c.price ?? c.maxPrice ?? c.unitPrice) || 0) === unitPrice
  );
  const withinBudgetMatch = candidatePool.find(
    (c: any) => (Number(c.price ?? c.maxPrice ?? c.unitPrice) || 0) >= unitPrice
  );

  const matched = exactPriceMatch || withinBudgetMatch || candidatePool[0];

  const matchedPrice = Number(matched.price ?? matched.maxPrice ?? matched.unitPrice) || 0;
  const pricingType = (matched.pricingType as PricingType) || "unit";
  const maxCap = matched.maxCap !== undefined ? matched.maxCap : null;
  const exclusiveWith = Array.isArray(matched.exclusiveWith) ? matched.exclusiveWith : [];

  return {
    matchedItem: matched,
    matchedPrice,
    pricingType,
    maxCap,
    exclusiveWith,
    matchType,
    isUnitMismatch,
    isRateConditionMismatch,
    rateMismatchWarning,
    unitWarning,
  };
}
