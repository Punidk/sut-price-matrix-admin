/**
 * Normalization utilities for Document Data Extraction & Price Matrix Matching
 */

export interface ExtractedProposalItem {
  name: string;
  rawUnit: string;
  quantity: number;
  unitPriceInBill: number;
  totalInBill: number;
  personCount: number;
  category?: string;
}

/**
 * สกัดจำนวนคนจากชื่อรายการ (Strict Person Regex)
 * - การสกัดตัวคูณคน ต้องจับคู่กับคำว่า "คน" อย่างเคร่งครัดเท่านั้น
 *   เช่น /(?:(?:\(|（)?(\d+)\s*คน(?:\)|）)?)/
 * - หากเป็นตัวเลขขนาดหรือจำนวนบรรจุ เช่น "(3ชิ้น)", "3.2 ล.", "51 เล่ม"
 *   ห้ามนำมาเป็น personCount โดยเด็ดขาด (ให้ personCount = 1)
 */
export function extractPersonCount(name: string): number {
  if (!name || typeof name !== "string") return 1;

  // แปลงเลขไทย (๐-๙) เป็นเลขอารบิก (0-9)
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  let cleanName = name;
  thaiDigits.forEach((td, idx) => {
    cleanName = cleanName.replaceAll(td, String(idx));
  });

  // 1. ตรวจจับในวงเล็บ/ก้ามปูที่ระบุ "คน" อย่างเคร่งครัด เช่น "(40 คน)", "(1 คน)", "（3 คน）", "[2 คน]"
  const parenMatch = cleanName.match(
    /[\(\[（\{][^\)\]）\}]*?(\d+)\s*คน[^\)\]）\}]*?[\)\]）\}]/
  );
  if (parenMatch && parenMatch[1]) {
    const num = parseInt(parenMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 2. ตรวจจับแพทเทิร์นจำนวนคนทั่วไป เช่น "วิทยากร 2 คน", "จำนวน 40 คน"
  // ต้องมีคำว่า "คน" กำกับติดกับตัวเลขเท่านั้น
  const generalMatch = cleanName.match(
    /(?:^|[^\d\.])(\d+)\s*คน(?:$|[^\d])/
  );
  if (generalMatch && generalMatch[1]) {
    const num = parseInt(generalMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  return 1;
}

/**
 * ทำ Unit Normalization สำหรับหน่วยในบิล/เอกสารให้อยู่ในรูปมาตรฐาน
 * - "ชม." -> "ชั่วโมง"
 * - "นัด" / "เกม" / "แมตช์" -> "แมต"
 * - "คน/ชม." -> "คน/ชั่วโมง"
 * - "คน/นัด" -> "คน/เเมต"
 * - และหน่วยอื่นๆ ที่พบบ่อย
 */
export function normalizeUnit(rawUnit: string): string {
  if (!rawUnit || typeof rawUnit !== "string") return "";
  let u = rawUnit.trim();

  // ตัดคำนำหน้าสกุลเงิน เช่น 'บาท/' หรือ '฿/'
  u = u.replace(/^(?:บาท|฿)\s*\/\s*/i, "");

  // ปรับสระแอที่พิมพ์ด้วยสระเอสองตัว (\u0e40\u0e40 -> \u0e41)
  u = u.replace(/\u0e40\u0e40/g, "\u0e41");

  // 1. หมวดเวลา / อัตราค่าตอบแทนต่อเวลา
  if (/^คน\s*\/\s*(?:ชม\.?|ช\.ม\.?|ชั่วโมง)$/i.test(u)) return "คน/ชั่วโมง";
  if (/^(?:ชม\.?|ช\.ม\.?|ชั่วโมง)$/i.test(u)) return "ชั่วโมง";

  // 2. หมวดการแข่งขัน / แมตช์
  if (/^คน\s*\/\s*(?:นัด|เกม|แมตช์|แมต|เเมตช์|เเมต)$/i.test(u)) return "คน/เเมต";
  if (/^(?:นัด|เกม|แมตช์|แมต|เเมตช์|เเมต)$/i.test(u)) return "แมต";

  // 3. หมวดคนและมื้อ/วัน/คืน
  if (/^คน\s*\/\s*มื้อ(?:อาหาร)?$/i.test(u)) return "คน/มื้อ";
  if (/^คน\s*\/\s*วัน$/i.test(u)) return "คน/วัน";
  if (/^คน\s*\/\s*คืน$/i.test(u)) return "คน/คืน";

  // 4. บรรจุภัณฑ์และหน่วยชั่งตวงวัด
  if (/^(?:แพ็ค|เเพ็ค|แพค|เเพค|แพ็ก|เเพ็ก)$/i.test(u)) return "แพ็ก";
  if (/^(?:กก\.?|กิโล|กิโลกรัม)$/i.test(u)) return "กิโลกรัม";
  if (/^(?:ตร\.?ม\.?|ตรม\.?|ตารางเมตร)$/i.test(u)) return "ตร.ม.";
  if (/^กล่อง\s*\/\s*ลัง$/i.test(u)) return "ลัง";
  if (/^(?:เหมา|เหมาจ่าย)$/i.test(u)) return "เหมาจ่าย";

  return u;
}

/**
 * แปลงข้อมูลดิบแต่ละรายการที่สกัดได้จาก OCR/AI ให้อยู่ในรูป ExtractedProposalItem
 */
export function normalizeProposalItem(rawItem: any): ExtractedProposalItem {
  const name = (
    rawItem.name ||
    rawItem.itemName ||
    rawItem.receiptData?.itemName ||
    rawItem.itemInReceipt ||
    ""
  ).trim();

  const rawUnit = (
    rawItem.rawUnit ||
    rawItem.unit ||
    rawItem.receiptData?.unit ||
    ""
  ).trim();

  const quantity =
    Number(
      rawItem.quantity ??
      rawItem.qty ??
      rawItem.receiptData?.qty
    ) || 1;

  const unitPriceInBill =
    Number(
      rawItem.unitPriceInBill ??
      rawItem.unitPrice ??
      rawItem.receiptData?.unitPrice
    ) || 0;

  const parsedTotal = Number(
    rawItem.totalInBill ??
    rawItem.totalPrice ??
    rawItem.receiptData?.totalPrice
  );

  const totalInBill =
    !isNaN(parsedTotal) && parsedTotal > 0
      ? parsedTotal
      : quantity * unitPriceInBill;

  const personCount = extractPersonCount(name);

  const category = (
    rawItem.category ||
    rawItem.receiptData?.category ||
    ""
  ).trim();

  return {
    name,
    rawUnit,
    quantity,
    unitPriceInBill,
    totalInBill,
    personCount,
    category: category || undefined,
  };
}

/**
 * ล้างข้อมูลยอดเงินและตัดข้อความอ่านตัวเลขภาษาไทยในวงเล็บ เช่น "(สามพันห้าร้อยเก้าสิบสี่บาทถ้วน)"
 * ออกก่อนนำตัวเลข 3,594 ไปแปลงเป็น float/int เพื่อป้องกันข้อผิดพลาด NaN หรือการแปลงผิดพลาด
 */
export function sanitizeTotalAmount(val: any): number {
  if (val == null) return 0;
  if (typeof val === "number") return isNaN(val) ? 0 : val;
  if (typeof val !== "string") return 0;

  let s = val.trim();
  if (!s) return 0;

  // 1. ตัดข้อความอ่านตัวเลขภาษาไทยในวงเล็บทุกรูปแบบ เช่น "(สามพันห้าร้อยเก้าสิบสี่บาทถ้วน)", "（...）", "[...]"
  s = s.replace(/[\(\[（\{][^\)\]）\}]*?(?:บาท|ถ้วน|สตางค์|ศูนย์|หนึ่ง|เอ็ด|สอง|ยี่|สาม|สี่|ห้า|หก|เจ็ด|แปด|เก้า|สิบ|ร้อย|พัน|หมื่น|แสน|ล้าน)[^\)\]）\}]*?[\)\]）\}]/g, "");

  // 2. ตัดข้อความอ่านภาษาไทยที่อาจอยู่นอกวงเล็บ
  s = s.replace(/(?:บาทถ้วน|บาท|ถ้วน|สตางค์|฿)/g, "").trim();

  // 3. แปลงเลขไทย (๐-๙) เป็นเลขอารบิก (0-9)
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  thaiDigits.forEach((td, idx) => {
    s = s.replaceAll(td, String(idx));
  });

  // 4. สกัดเฉพาะตัวเลขที่มีเครื่องหมายคอมม่าและทศนิยม เช่น "3,594", "3,594.00"
  const match = s.match(/[\d,]+(?:\.\d+)?/);
  if (match) {
    const cleanNum = match[0].replace(/,/g, "");
    const parsed = parseFloat(cleanNum);
    return isNaN(parsed) ? 0 : parsed;
  }

  return 0;
}
