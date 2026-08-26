import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { imageBase64, mimeType } = await req.json();

    if (!imageBase64) {
      return NextResponse.json({ error: "ไม่พบข้อมูลรูปภาพ (imageBase64)" }, { status: 400 });
    }

    // 1. เช็กกุญแจ API
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY ในระบบ" }, { status: 500 });
    }

    // 2. เรียกใช้งาน Gemini 1.5 Pro (รุ่นนี้เสถียรและเก่งเรื่องอ่านรูปสุดๆ)
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // 3. สั่งงาน AI
    const prompt = `จงอ่านตารางราคากลางจากรูปภาพนี้ แล้วสกัดข้อมูลออกมาเป็น JSON Array เท่านั้น โดยแต่ละ object ต้องมีโครงสร้างคือ {"itemName": "ชื่อรายการ", "category": "หมวดหมู่", "maxPrice": ตัวเลข, "unit": "หน่วยนับ"} ห้ามมีข้อความอธิบายอื่นปนเด็ดขาด`;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBase64,
          mimeType: mimeType || "image/jpeg",
        },
      },
    ]);

    // 5. ทำความสะอาดข้อความเผื่อ AI แถม Markdown (```json) มาให้
    let text = result.response.text();
    text = text.replace(/```json/g, "").replace(/```/g, "").trim();
    
    // แปลงเป็น Object ส่งกลับไปให้หน้าเว็บ
    const parsedData = JSON.parse(text);
    return NextResponse.json(parsedData);

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    return NextResponse.json({ error: error.message || "เกิดข้อผิดพลาดในการวิเคราะห์ AI" }, { status: 500 });
  }
}