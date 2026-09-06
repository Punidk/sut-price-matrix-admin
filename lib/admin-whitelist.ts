/**
 * รายชื่ออีเมลที่ได้รับอนุญาตให้เข้าถึงระบบ Admin (Whitelist)
 */
export const ALLOWED_ADMINS: string[] = [
  "advice39za@gmail.com",
  // Demo accounts for local fallback testing
  "admin.google@sut.ac.th",
  "admin@sut.ac.th",
];

export const UNAUTHORIZED_ADMIN_MESSAGE = "บัญชีของคุณไม่มีสิทธิ์เข้าถึงระบบ Admin";

/**
 * ตรวจสอบว่า email ได้รับอนุญาตให้เข้าใช้งานระบบ Admin หรือไม่
 * รองรับทั้งตัวแปร ALLOWED_ADMINS และ Environment Variable NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS
 */
export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const cleanEmail = email.trim().toLowerCase();

  // 1. ตรวจสอบจาก Environment Variable (ถ้ามีระบุไว้ คั่นด้วย comma)
  const envAdmins = process.env.NEXT_PUBLIC_ALLOWED_ADMIN_EMAILS;
  if (envAdmins) {
    const list = envAdmins
      .split(",")
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean);
    if (list.includes(cleanEmail)) {
      return true;
    }
  }

  // 2. ตรวจสอบจาก ALLOWED_ADMINS array
  return ALLOWED_ADMINS.some(
    (allowed) => allowed.trim().toLowerCase() === cleanEmail
  );
}
