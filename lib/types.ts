export const SUT_EXPENSE_CATEGORIES = [
  "หมวดค่าตอบแทน",
  "หมวดโภชนาการ",
  "หมวดยานพาหนะ",
  "หมวดวัสดุก่อสร้าง",
  "หมวดอุปกรณ์ก่อสร้าง",
  "หมวดอุปกรณ์สำนักงาน",
  "หมวดอุปกรณ์อิเล็กทรอนิกส์",
  "หมวดอื่นๆ",
] as const;

export type SutExpenseCategory = (typeof SUT_EXPENSE_CATEGORIES)[number];

export type CategoryType =
  | SutExpenseCategory
  | "หมวดอุปกรณ์ก่อสร้าง"
  | "หมวดพาหนะ"
  | "อาหาร"
  | "อุปกรณ์สำนักงาน"
  | "บริการ"
  | "อื่นๆ"
  | "Food"
  | "Material"
  | "Service"
  | "Other";

export function normalizeExpenseCategory(cat?: string | null, itemName?: string | null): SutExpenseCategory {
  const catText = (cat || "").trim();
  if (SUT_EXPENSE_CATEGORIES.includes(catText as any)) {
    return catText as SutExpenseCategory;
  }
  if (catText === "หมวดพาหนะ") {
    return "หมวดยานพาหนะ";
  }
  if (catText === "หมวดอุปกรณ์ก่อสร้าง") {
    return "หมวดวัสดุก่อสร้าง";
  }
  if (catText === "หมวดอื่นๆ" || catText === "อื่นๆ") {
    return "หมวดอื่นๆ";
  }

  const combined = `${catText} ${itemName || ""}`.toLowerCase();

  // 1. หมวดค่าตอบแทน
  if (
    combined.includes("ตอบแทน") ||
    combined.includes("วิทยากร") ||
    combined.includes("ค่าจ้าง") ||
    combined.includes("กรรมการ") ||
    combined.includes("เบี้ยเลี้ยง")
  ) {
    return "หมวดค่าตอบแทน";
  }

  // 2. หมวดโภชนาการ
  if (
    combined.includes("โภชนาการ") ||
    combined.includes("อาหาร") ||
    combined.includes("ขนม") ||
    combined.includes("เครื่องดื่ม") ||
    combined.includes("น้ำดื่ม") ||
    combined.includes("เบรก") ||
    combined.includes("ข้าว") ||
    combined.includes("food")
  ) {
    return "หมวดโภชนาการ";
  }

  // 3. หมวดยานพาหนะ
  if (
    combined.includes("พาหนะ") ||
    combined.includes("ยานพาหนะ") ||
    combined.includes("น้ำมัน") ||
    combined.includes("เชื้อเพลิง") ||
    combined.includes("เดินทาง") ||
    combined.includes("ทางด่วน") ||
    combined.includes("เช่ารถ") ||
    combined.includes("ตั๋ว") ||
    combined.includes("vehicle")
  ) {
    return "หมวดยานพาหนะ";
  }

  // 4. หมวดอุปกรณ์ก่อสร้าง
  if (
    combined.includes("ก่อสร้าง") ||
    combined.includes("น็อต") ||
    combined.includes("สกรู") ||
    combined.includes("ท่อ") ||
    combined.includes("ไม้") ||
    combined.includes("เหล็ก") ||
    combined.includes("ปูน") ||
    combined.includes("สีทา") ||
    combined.includes("ตะปู") ||
    combined.includes("กระดาษทราย") ||
    combined.includes("construction")
  ) {
    return "หมวดวัสดุก่อสร้าง";
  }

  // 5. หมวดอุปกรณ์อิเล็กทรอนิกส์
  if (
    combined.includes("อิเล็กทรอนิกส์") ||
    combined.includes("อิเล็กทรอนิก") ||
    combined.includes("ไมโครคอนโทรลเลอร์") ||
    combined.includes("ไมโคร") ||
    combined.includes("เซนเซอร์") ||
    combined.includes("เซ็นเซอร์") ||
    combined.includes("ตัวต้านทาน") ||
    combined.includes("สายไฟ") ||
    combined.includes("บอร์ด") ||
    combined.includes("arduino") ||
    combined.includes("esp32") ||
    combined.includes("คอมพิวเตอร์") ||
    combined.includes("flash drive") ||
    combined.includes("electronic")
  ) {
    return "หมวดอุปกรณ์อิเล็กทรอนิกส์";
  }

  // 6. หมวดอุปกรณ์สำนักงาน
  if (
    combined.includes("สำนักงาน") ||
    combined.includes("กระดาษ") ||
    combined.includes("ปากกา") ||
    combined.includes("แฟ้ม") ||
    combined.includes("เทป") ||
    combined.includes("คลิป") ||
    combined.includes("เครื่องเขียน") ||
    combined.includes("ซอง") ||
    combined.includes("material") ||
    combined.includes("office")
  ) {
    return "หมวดอุปกรณ์สำนักงาน";
  }

  // 7. หมวดอื่นๆ
  if (
    combined.includes("อื่นๆ") ||
    combined.includes("other") ||
    combined.includes("สเปรย์") ||
    combined.includes("ถุงขยะ") ||
    combined.includes("ทิชชู่") ||
    combined.includes("กระสอบ") ||
    combined.includes("ไวนิล")
  ) {
    return "หมวดอื่นๆ";
  }

  // Default fallback
  return "หมวดอื่นๆ";
}

export type PricingType = "unit" | "per_person" | "lump_sum" | "project_fixed";

export interface PriceMatrixItem {
  id?: string;
  category: string;
  name: string;
  price: number;
  unit: string;
  note?: string;
  pricingType: PricingType;
  maxCap?: number | null;          // เพดานเหมาจ่ายสูงสุด เช่น วิทยากรภายนอก 2400
  exclusiveWith?: string[];        // รายการที่ห้ามขอพร้อมกัน เช่น ['ค่าของที่ระลึก']

  // Optional compatibility fields for existing UI components
  itemName?: string;
  maxPrice?: number;
  unitPrice?: number;
  unitType?: string;
  condition?: string;
  updatedAt?: any;
}

export type PriceMatrixFormData = Partial<PriceMatrixItem> & {
  category: string;
  unit: string;
  name?: string;
  price?: number;
  itemName?: string;
  maxPrice?: number;
};

export type DocumentMode = "PROPOSAL" | "QUOTATION";

export interface CategorySubtotalCheck {
  category: SutExpenseCategory;
  detectedSubtotal: number;
  calculatedSubtotal: number;
  difference: number;
  isMatch: boolean;
  itemCount: number;
  message?: string;
}

export interface ProjectExclusionViolation {
  id: string;
  rule: string;
  message: string;
  severity: "error" | "warning";
  items: string[];
}

export interface ProposalAuditData {
  projectName?: string;
  requestedBudgetTotal?: number;
  calculatedGrandTotal?: number;
  isGrandTotalMatch?: boolean;
  isHorizontalMathCorrect?: boolean;
  categoryChecks?: CategorySubtotalCheck[];
  exclusionViolations?: ProjectExclusionViolation[];
}

export interface ExtractedProposalItem {
  name: string;
  rawUnit: string;
  quantity: number;
  unitPriceInBill: number;
  totalInBill: number;
  personCount: number;
  category?: string;
}

export interface ReceiptItemData {
  // Legacy / UI display fields
  itemName: string;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
  personCount?: number;

  // Proposal extraction standardized fields
  name?: string;
  rawUnit?: string;
  quantity?: number;
  unitPriceInBill?: number;
  totalInBill?: number;
}

export interface MatrixItemData {
  itemName?: string | null;
  name?: string | null;
  category?: string | null;
  maxPrice?: number | null;
  matchedPrice?: number;
  price?: number | null;
  unit?: string | null;
  pricingType?: PricingType;
  maxCap?: number | null;
  exclusiveWith?: string[];
  condition?: string | null;
  note?: string;
}

export { extractPersonCount, normalizeUnit, normalizeProposalItem } from "./normalizer";
export {
  findMatchingPriceMatrixItem,
  isUnitCompatible,
  isLumpSumUnit,
  LUMP_SUM_UNIT_ALIASES,
  cleanProposalItemName,
  getBaseItemName,
  parseThaiOrIsoDate,
  checkProjectExclusions,
} from "./matcher";
export type { LookupParams, LookupResult } from "./matcher";

