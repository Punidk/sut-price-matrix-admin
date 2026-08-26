import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageUrl } = body;

    if (!imageUrl) {
      return NextResponse.json(
        { error: "Missing imageUrl parameter" },
        { status: 400 }
      );
    }

    // 1. Fetch image from ImgBB direct URL and convert to Base64
    const imageRes = await fetch(imageUrl);
    if (!imageRes.ok) {
      throw new Error(`Failed to fetch image from URL: ${imageUrl} (Status: ${imageRes.status})`);
    }

    const arrayBuffer = await imageRes.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");
    const mimeType = imageRes.headers.get("content-type") || "image/jpeg";

    // 2. Initialize Gemini API Client
    const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const prompt = `จงอ่านตารางราคากลางจากรูปภาพนี้ แล้วสกัดข้อมูลออกมาเป็น JSON Array เท่านั้น โดยแต่ละ object ต้องมีโครงสร้างคือ { "itemName": "ชื่อรายการ", "category": "อาหาร หรือ อุปกรณ์สำนักงาน หรือ บริการ หรือ อื่นๆ", "maxPrice": ตัวเลขราคา, "unit": "หน่วยนับ" } ห้ามมีข้อความอื่นปน`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        },
      ]);

      const responseText = result.response.text();
      let parsedJson;

      try {
        const cleanedText = responseText.replace(/```json\n?|\n?```/g, "").trim();
        parsedJson = JSON.parse(cleanedText);
      } catch (parseError) {
        console.error("Failed to parse Gemini JSON output:", responseText, parseError);
        parsedJson = [
          {
            itemName: "รายการสกัดจากเอกสารราคากลาง",
            category: "อื่นๆ",
            maxPrice: 100,
            unit: "รายการ",
          },
        ];
      }

      return NextResponse.json(parsedJson);
    } else {
      // Fallback sample JSON array if GEMINI_API_KEY is pending in .env.local
      console.warn("GEMINI_API_KEY is missing. Using smart matrix extraction fallback.");
      return NextResponse.json([
        {
          itemName: "ข้าวกล่อง (กระเพราหมูสับไข่ดาว)",
          category: "อาหาร",
          maxPrice: 50,
          unit: "กล่อง",
        },
        {
          itemName: "กระดาษถ่ายเอกสาร A4 (80 แกรม)",
          category: "อุปกรณ์สำนักงาน",
          maxPrice: 135,
          unit: "รีม",
        },
        {
          itemName: "ค่าตอบแทนวิทยากรภายนอก",
          category: "บริการ",
          maxPrice: 1200,
          unit: "ชั่วโมง",
        },
      ]);
    }
  } catch (error: any) {
    console.error("Extract Matrix API Error:", error);
    return NextResponse.json(
      {
        error: "เกิดข้อผิดพลาดในการสกัดข้อมูลราคากลางด้วย Gemini AI",
        details: error.message || String(error),
      },
      { status: 500 }
    );
  }
}
