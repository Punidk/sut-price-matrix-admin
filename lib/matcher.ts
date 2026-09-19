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

export const LUMP_SUM_UNIT_ALIASES = [
  "เหมาจ่าย",
  "โครงการ",
  "บาท/โครงการ",
  "เหมา",
  "งาน",
  "เหมาจ่ายต่อโครงการ",
];

export function isLumpSumUnit(unit: string): boolean {
  if (!unit || typeof unit !== "string") return false;
  const uNorm = normalizeUnit(unit);
  const cleaned = cleanText(unit).replace(/\s+/g, "");
  const cleanedNorm = cleanText(uNorm).replace(/\s+/g, "");
  return LUMP_SUM_UNIT_ALIASES.some((alias) => {
    const aClean = cleanText(alias).replace(/\s+/g, "");
    return cleaned === aClean || cleanedNorm === aClean;
  });
}

// Helper: ตรวจสอบความเข้ากันได้ของหน่วยนับในเอกสารกับหน่วยในราคากลาง (โดยเฉพาะหน่วยที่มีมิติคน หรือหน่วยเหมาจ่าย)
export function isUnitCompatible(docUnit: string, matrixUnit: string, personCount: number = 1): boolean {
  // 1. ตรวจสอบกลุ่มคำที่ถือว่าเข้ากันได้สำหรับรายการเหมาจ่าย/ต่อโครงการ (Equivalent Units)
  if (isLumpSumUnit(docUnit) && isLumpSumUnit(matrixUnit)) {
    return true;
  }

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

  // 2. หมวดชั่วโมงและยานพาหนะ: รองรับหน่วย "ชั่วโมง", "ชม.", "คน/ชั่วโมง", "คน/ชม." ให้เป็น Compatible Units
  const isHourly = (u: string) => /^(?:คน\s*\/\s*)?(?:ชม\.?|ช\.ม\.?|ชั่วโมง)$/i.test(u.trim());
  if (isHourly(docUnit) && isHourly(matrixUnit)) {
    return true;
  }
  if (isHourly(dClean) && isHourly(mClean)) {
    return true;
  }

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

  // 1.1 ปรับปรุง Fuzzy Search สำหรับรายการคำสั้น (Short Name Substring Fallback)
  // หากยังไม่พบ candidate จากหมวดและชื่อตรง หรือพบแต่หน่วยไม่ตรง และชื่อรายการเป็นคำสั้น (<= 10 ตัวอักษร เช่น "ธูป", "เชือก", "สี")
  // ให้ค้นหาแบบ substring ในชื่อรายการของราคากลางทั้งหมด และจับคู่กับรายการที่หน่วยนับตรงกัน
  if (candidates.length === 0 || (!candidates.some((c: any) => cleanText(c.unit || c.unitType || "") === cleanDocUnit) && baseName.length <= 10)) {
    const fallbackMatches = (priceMatrix || []).filter((pm: any) => {
      const pmRawName = (pm.itemName || pm.name || "").trim();
      const pmBase = getBaseItemName(pmRawName);
      const pmClean = cleanText(pmRawName);

      const isSubstring =
        pmClean.includes(cleanName) ||
        pmBase.includes(baseName) ||
        cleanName.includes(pmClean) ||
        (baseName.length >= 2 && pmBase.includes(baseName));

      return isSubstring;
    });

    if (fallbackMatches.length > 0) {
      if (cleanDocUnit.length > 0) {
        const unitExactMatches = fallbackMatches.filter(
          (pm: any) => cleanText(pm.unit || pm.unitType || "") === cleanDocUnit
        );
        const unitCompatibleMatches = fallbackMatches.filter(
          (pm: any) => isUnitCompatible(rawUnit, pm.unit || pm.unitType || "", personCount)
        );

        if (unitExactMatches.length > 0) {
          candidates = unitExactMatches;
        } else if (unitCompatibleMatches.length > 0) {
          candidates = unitCompatibleMatches;
        } else if (candidates.length === 0) {
          candidates = fallbackMatches;
        }
      } else if (candidates.length === 0) {
        candidates = fallbackMatches;
      }
    }
  }

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

  const isLumpSumItem =
    pricingType === "lump_sum" ||
    pricingType === "project_fixed" ||
    isLumpSumUnit(rawUnit) ||
    isLumpSumUnit(matched.unit || "");

  if (isLumpSumItem) {
    isUnitMismatch = false;
    unitWarning = undefined;
  }

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

export interface ProjectExclusionViolation {
  id: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
  items: string[];
}

export interface ExclusionCheckItem {
  name: string;
  cleanName?: string;
  totalInBill?: number;
  totalPrice?: number;
  exclusiveWith?: string[];
  pricingType?: PricingType;
}

/**
 * ตรวจสอบกฎความขัดแย้งห้ามเบิกซ้ำซ้อนระดับโครงการ (Project-Level Exclusion Rules)
 * ตามประกาศเกณฑ์ราคากลางปีการศึกษา 2569:
 * - กฎที่ 1: ห้ามเบิก "น้ำแดงเฮลบลูบอย" ควบคู่กับ "ค่าอาหารว่าง"
 * - กฎที่ 2: ห้ามเบิก "ค่าของที่ระลึก" ควบคู่กับ "ค่าตอบแทนวิทยากร"
 * - กฎที่ 3: ห้ามเบิก "ค่าของขวัญ/ของรางวัล" ควบคู่กับ "ค่าเงินรางวัล" (และเพดานรวมของรางวัล/เงินรางวัลห้ามเกิน 3,000 บาท)
 * - กฎเฉพาะรายการ: ตรวจสอบรายการที่มี `exclusiveWith` กำกับไว้ในฐานข้อมูล
 */
export function checkProjectExclusions(
  items: ExclusionCheckItem[]
): ProjectExclusionViolation[] {
  const violations: ProjectExclusionViolation[] = [];
  if (!Array.isArray(items) || items.length === 0) return violations;

  // กฎที่ 1: น้ำแดงเฮลบลูบอย vs ค่าอาหารว่าง
  const isSyrup = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasSyrupKeyword = /น้ำแดง|เฮลบลูบอย|เฮลซ์บลูบอย/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /อาหารว่าง|ขนมเบรก/i.test(e));
    return hasSyrupKeyword || hasExclusion;
  };

  const isSnack = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasSnackKeyword = /อาหารว่าง|ขนมเบรก|snack/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /น้ำแดง|เฮลบลูบอย/i.test(e));
    return hasSnackKeyword || hasExclusion;
  };

  const syrupItems = items.filter(isSyrup);
  const snackItems = items.filter(isSnack);

  if (syrupItems.length > 0 && snackItems.length > 0) {
    violations.push({
      id: "EXCLUSION_SYRUP_SNACK",
      rule: "อาหารว่างและน้ำแดงเฮลบลูบอย",
      message: "ผิดเงื่อนไข: ค่าอาหารว่างและน้ำแดงเฮลบลูบอย ให้เลือกเบิกได้อย่างใดอย่างหนึ่งเท่านั้น",
      severity: "error",
      items: [
        ...syrupItems.map((i) => i.cleanName || i.name),
        ...snackItems.map((i) => i.cleanName || i.name),
      ],
    });
  }

  // กฎที่ 2: ค่าของที่ระลึก vs ค่าตอบแทนวิทยากร (วิทยากรภายในหรือภายนอก)
  const isSouvenir = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasSouvenirKeyword = /ของที่ระลึก|ของชำร่วย|souvenir/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /วิทยากร/i.test(e));
    return hasSouvenirKeyword || hasExclusion;
  };

  const isSpeaker = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasSpeakerKeyword = /วิทยากร/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /ของที่ระลึก/i.test(e));
    return hasSpeakerKeyword || hasExclusion;
  };

  const souvenirItems = items.filter(isSouvenir);
  const speakerItems = items.filter(isSpeaker);

  if (souvenirItems.length > 0 && speakerItems.length > 0) {
    violations.push({
      id: "EXCLUSION_SOUVENIR_SPEAKER",
      rule: "ของที่ระลึกและค่าตอบแทนวิทยากร",
      message: "ผิดเงื่อนไข: หากเลือกของที่ระลึก จะไม่สามารถเบิกค่าตอบแทนวิทยากรได้",
      severity: "error",
      items: [
        ...souvenirItems.map((i) => i.cleanName || i.name),
        ...speakerItems.map((i) => i.cleanName || i.name),
      ],
    });
  }

  // กฎที่ 3: ค่าของขวัญ/ของรางวัล vs ค่าเงินรางวัล
  const isGiftPrize = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasGiftKeyword = (/ของรางวัล/i.test(text) || /ของขวัญ/i.test(text)) && !/เงินรางวัล/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /เงินรางวัล/i.test(e));
    return hasGiftKeyword || hasExclusion;
  };

  const isCashPrize = (item: ExclusionCheckItem) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    const hasCashKeyword = /เงินรางวัล/i.test(text);
    const hasExclusion =
      Array.isArray(item.exclusiveWith) &&
      item.exclusiveWith.some((e) => /ของรางวัล|ของขวัญ/i.test(e));
    return hasCashKeyword || hasExclusion;
  };

  const giftItems = items.filter(isGiftPrize);
  const cashPrizeItems = items.filter(isCashPrize);

  if (giftItems.length > 0 && cashPrizeItems.length > 0) {
    violations.push({
      id: "EXCLUSION_PRIZE_CONFLICT",
      rule: "ของรางวัลและเงินรางวัล",
      message: "ผิดเงื่อนไข: ให้เลือกเบิกของรางวัลหรือเงินรางวัลได้อย่างใดอย่างหนึ่ง (เพดานรวมไม่เกิน 3,000 บาท)",
      severity: "error",
      items: [
        ...giftItems.map((i) => i.cleanName || i.name),
        ...cashPrizeItems.map((i) => i.cleanName || i.name),
      ],
    });
  }

  // กฎที่ 3 (Cap): หากมีของขวัญ/ของรางวัล หรือเงินรางวัล ยอดรวมเกิน 3,000 บาท ให้แจ้งเตือนเพดานโครงการ
  const allPrizeItems = items.filter((item) => {
    const text = `${item.name || ""} ${item.cleanName || ""}`.toLowerCase();
    return /ของรางวัล|ของขวัญ|เงินรางวัล/i.test(text);
  });

  const totalPrizeAmount = allPrizeItems.reduce((sum, item) => {
    return sum + (Number(item.totalInBill ?? item.totalPrice) || 0);
  }, 0);

  if (totalPrizeAmount > 3000) {
    violations.push({
      id: "EXCLUSION_PRIZE_CAP_EXCEEDED",
      rule: "เพดานรางวัลรวมโครงการ",
      message: `ผิดเงื่อนไข: ยอดรวมค่าของรางวัลและเงินรางวัล (฿${totalPrizeAmount.toLocaleString()}) เกินเพดานโครงการ (จำกัดไม่เกิน 3,000 บาท)`,
      severity: "error",
      items: allPrizeItems.map((i) => i.cleanName || i.name),
    });
  }

  // กฎเฉพาะรายการ: ตรวจสอบ exclusiveWith ที่จับคู่ได้จาก price matrix
  for (let i = 0; i < items.length; i++) {
    const itemA = items[i];
    const exList = Array.isArray(itemA.exclusiveWith) ? itemA.exclusiveWith : [];
    if (exList.length === 0) continue;

    for (let j = i + 1; j < items.length; j++) {
      const itemB = items[j];
      const textB = `${itemB.name || ""} ${itemB.cleanName || ""}`.toLowerCase();

      const isConflict = exList.some((exTag) => {
        const tag = exTag.trim().toLowerCase();
        return tag.length > 0 && textB.includes(tag);
      });

      if (isConflict) {
        // ตรวจสอบว่าไม่ซ้ำกับ Rule 1, 2, 3 ที่ดักไปแล้ว
        const alreadyCovered = violations.some((v) =>
          (v.id === "EXCLUSION_SYRUP_SNACK" && (isSyrup(itemA) || isSnack(itemA))) ||
          (v.id === "EXCLUSION_SOUVENIR_SPEAKER" && (isSouvenir(itemA) || isSpeaker(itemA))) ||
          (v.id === "EXCLUSION_PRIZE_CONFLICT" && (isGiftPrize(itemA) || isCashPrize(itemA)))
        );

        if (!alreadyCovered) {
          const nameA = itemA.cleanName || itemA.name;
          const nameB = itemB.cleanName || itemB.name;
          violations.push({
            id: `EXCLUSION_CUSTOM_${i}_${j}`,
            rule: "รายการห้ามเบิกพร้อมกัน",
            message: `ผิดเงื่อนไข: รายการ "${nameA}" ไม่สามารถเบิกจ่ายร่วมกับ "${nameB}" ได้ตามประกาศราคากลาง`,
            severity: "error",
            items: [nameA, nameB],
          });
        }
      }
    }
  }

  return violations;
}

