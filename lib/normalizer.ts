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
 * สกัดจำนวนคนจากชื่อรายการ (Extract Person Multiplier)
 * - ค้นหาแพทเทิร์นจำนวนคน เช่น /(?:(?:\(|（)?(\d+)\s*คน(?:\)|）)?)/
 * - รองรับ (30 คน), (40 คน), 3 คน, วิทยากร 2 คน, （40 คน）, [5 คน]
 * - หากไม่พบ คืนค่าเริ่มต้นเป็น 1
 */
export function extractPersonCount(name: string): number {
  if (!name || typeof name !== "string") return 1;

  // แปลงเลขไทย (๐-๙) เป็นเลขอารบิก (0-9)
  const thaiDigits = ["๐", "๑", "๒", "๓", "๔", "๕", "๖", "๗", "๘", "๙"];
  let cleanName = name;
  thaiDigits.forEach((td, idx) => {
    cleanName = cleanName.replaceAll(td, String(idx));
  });

  // 1. ตรวจจับในวงเล็บ/ก้ามปู เช่น "(40 คน)", "(นักศึกษา 40 คน)", "（40 คน）", "[3 ท่าน]"
  const parenMatch = cleanName.match(
    /[\(\[（\{][^\)\]）\}]*?(\d+)\s*(?:คน|ท่าน|ราย)[^\)\]）\}]*?[\)\]）\}]/
  );
  if (parenMatch && parenMatch[1]) {
    const num = parseInt(parenMatch[1], 10);
    if (!isNaN(num) && num > 0) return num;
  }

  // 2. ตรวจจับแพทเทิร์นจำนวนคนทั่วไป เช่น "30 คน", "3 คน", "วิทยากร 2 คน", "จำนวน 40 คน"
  const generalMatch = cleanName.match(
    /(?:(?:\(|（|\[)?(\d+)\s*(?:คน|ท่าน|ราย)(?:\)|）|\])?)/
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
