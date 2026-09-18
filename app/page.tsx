"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import imageCompression from "browser-image-compression";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp, getDocs } from "firebase/firestore";
import {
  PriceMatrixItem,
  SUT_EXPENSE_CATEGORIES,
  SutExpenseCategory,
  normalizeExpenseCategory,
  DocumentMode,
  ProposalAuditData,
  CategorySubtotalCheck,
} from "@/lib/types";
import { initialPriceMatrixData } from "@/lib/mockData";
import {
  UploadCloud,
  Camera,
  CheckCircle2,
  XCircle,
  FileText,
  RefreshCw,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
  AlertCircle,
  TrendingDown,
  TrendingUp,
  Building2,
  Lock,
  ImageIcon,
  Brain,
  FileSpreadsheet,
  Trash2,
  Plus,
  Layers,
  FileCheck,
  AlertTriangle,
  Printer,
  FileWarning,
  Coins,
  Utensils,
  Car,
  Hammer,
  Paperclip,
  Cpu,
} from "lucide-react";

export interface ReceiptItemData {
  itemName: string;
  personCount?: number;
  qty: number;
  unit: string;
  unitPrice: number;
  totalPrice: number;
}

export interface MatrixItemData {
  itemName?: string | null;
  category?: string | null;
  maxPrice?: number | null;
  unit?: string | null;
}

export interface AnalysisItemResult {
  status: "PASS" | "FAIL" | "NOT_FOUND";
  category?: string;
  errorFlags?: string[];
  message?: string;
  receiptData?: ReceiptItemData;
  matrixData?: MatrixItemData | null;
  // Fallbacks for compatibility
  itemInReceipt?: string;
  matchedMatrixItem?: string | null;
  detectedPrice?: number;
  matrixMaxPrice?: number | null;
  unit?: string;
}

export interface MerchantInfo {
  name?: string;
  date?: string;
  hasReceiptSign?: boolean;
  isHandwritten?: boolean;
}

export interface FinancialSummaryData {
  subtotal?: number;
  discount?: number;
  vat?: number;
  total?: number;
  grandTotal?: number;
  approvedTotal?: number;
  isMathCorrect?: boolean;
}

export interface CustomerInfo {
  name?: string;
  address?: string;
  taxId?: string;
  phone?: string;
  isSutCustomer?: boolean;
  hasCorrectAddress?: boolean;
  hasCorrectTaxId?: boolean;
  hasCorrectPhone?: boolean;
}

export interface QuotationTermsData {
  isQuotation?: boolean;
  priceValidity?: string;
  deliveryTerm?: string;
  hasTextAmount?: boolean;
  hasQuotationSign?: boolean;
}

export interface UploadedFileItem {
  id: string;
  file: File;
  type: "image" | "pdf" | "excel" | "other";
  name: string;
  size: number;
  previewUrl?: string;
  mimeType: string;
}

export default function UserFrontendPage() {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFileItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Firestore Price Matrix items state
  const [priceMatrix, setPriceMatrix] = useState<PriceMatrixItem[]>([]);

  // AI Analysis Results state (Array of items + Header metadata)
  const [analysisResults, setAnalysisResults] = useState<AnalysisItemResult[] | null>(null);
  const [merchantInfo, setMerchantInfo] = useState<MerchantInfo | null>(null);
  const [customerInfo, setCustomerInfo] = useState<CustomerInfo | null>(null);
  const [quotationTerms, setQuotationTerms] = useState<QuotationTermsData | null>(null);
  const [documentType, setDocumentType] = useState<string | null>(null);
  const [documentMode, setDocumentMode] = useState<DocumentMode>("PROPOSAL");
  const [proposalAudit, setProposalAudit] = useState<ProposalAuditData | null>(null);
  const [isQuotationCheck, setIsQuotationCheck] = useState<boolean>(false);
  const [financialSummary, setFinancialSummary] = useState<FinancialSummaryData | null>(null);
  const [documentWarnings, setDocumentWarnings] = useState<string[]>([]);
  const [overallStatus, setOverallStatus] = useState<string | null>(null);

  const [auditTimestamp, setAuditTimestamp] = useState<number>(Date.now());
  const [auditRefCode, setAuditRefCode] = useState<string>("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // 1. Fetch Firestore `price_matrix` on page load
  useEffect(() => {
    if (isFirebaseConfigured && db) {
      const matrixRef = collection(db, "price_matrix");
      const unsubscribe = onSnapshot(
        matrixRef,
        (snapshot) => {
          const list: PriceMatrixItem[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            return {
              id: docSnap.id,
              itemName: data.itemName || "",
              category: data.category || "อื่นๆ",
              maxPrice: Number(data.maxPrice || data.unitPrice) || 0,
              unit: data.unit || data.unitType || "",
              updatedAt: data.updatedAt?.toMillis ? data.updatedAt.toMillis() : Date.now(),
            };
          });
          setPriceMatrix(list);
        },
        (err) => {
          console.error("Firestore snapshot error:", err);
          setPriceMatrix(initialPriceMatrixData);
        }
      );
      return () => unsubscribe();
    } else {
      setPriceMatrix(initialPriceMatrixData);
    }
  }, []);

  // Helper to convert Image / PDF File to Base64 String (excluding data URL prefix)
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        const base64Data = result.split(",")[1] || result;
        resolve(base64Data);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  };

  // Helper to read Excel / CSV File via SheetJS and convert to CSV text
  const processExcelFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          let combinedCsv = "";
          workbook.SheetNames.forEach((sheetName) => {
            const worksheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(worksheet);
            if (csv.trim()) {
              combinedCsv += `\n--- Sheet: ${sheetName} ---\n` + csv;
            }
          });
          resolve(combinedCsv.trim());
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle adding new files to list
  const addFiles = (fileList: FileList | File[]) => {
    const newItems: UploadedFileItem[] = [];
    setUploadError(null);
    setAnalysisResults(null);

    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      const isExcel =
        file.name.toLowerCase().endsWith(".xlsx") ||
        file.name.toLowerCase().endsWith(".xls") ||
        file.name.toLowerCase().endsWith(".csv") ||
        file.type.includes("spreadsheet") ||
        file.type.includes("excel") ||
        file.type.includes("csv");

      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      if (isImage) {
        newItems.push({
          id,
          file,
          type: "image",
          name: file.name,
          size: file.size,
          previewUrl: URL.createObjectURL(file),
          mimeType: file.type || "image/jpeg",
        });
      } else if (isPdf) {
        newItems.push({
          id,
          file,
          type: "pdf",
          name: file.name,
          size: file.size,
          mimeType: "application/pdf",
        });
      } else if (isExcel) {
        newItems.push({
          id,
          file,
          type: "excel",
          name: file.name,
          size: file.size,
          mimeType: file.type || "text/csv",
        });
      } else {
        newItems.push({
          id,
          file,
          type: "other",
          name: file.name,
          size: file.size,
          mimeType: file.type || "application/octet-stream",
        });
      }
    }

    setSelectedFiles((prev) => [...prev, ...newItems]);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(e.target.files);
    }
  };

  const handleRemoveFile = (id: string) => {
    setSelectedFiles((prev) => prev.filter((item) => item.id !== id));
  };

  // Sample file preview simulation - สร้างเอกสารตัวอย่างตาม documentMode
  const handleSelectSample = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 750;
    canvas.height = 620;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (documentMode === "PROPOSAL") {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 750, 620);

      // Header Bar
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 0, 750, 44);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 16px sans-serif";
      ctx.fillText("แบบเสนอโครงการและประมาณการค่าใช้จ่าย ประจำปีการศึกษา 2569", 25, 28);

      // Project Info
      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 13px sans-serif";
      ctx.fillText("ชื่อโครงการ: ค่ายพัฒนาทักษะวิศวกรรมและเทคโนโลยีเพื่อชุมชน", 25, 72);
      ctx.font = "12px sans-serif";
      ctx.fillText("หน่วยงาน/ชมรม: ชมรมวิชาการ สภานักศึกษา มทส. | วันที่จัดกิจกรรม: 15-16 พฤศจิกายน 2569", 25, 94);

      // Category 1: หมวดโภชนาการ
      ctx.fillStyle = "#f97316";
      ctx.fillRect(25, 115, 700, 24);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("หมวดโภชนาการ", 35, 132);

      // Table Header
      ctx.fillStyle = "#334155";
      ctx.fillRect(25, 140, 700, 24);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("ลำดับ", 35, 156);
      ctx.fillText("รายการ", 90, 156);
      ctx.fillText("จำนวน", 400, 156);
      ctx.fillText("ราคา/หน่วย", 490, 156);
      ctx.fillText("รวมเป็นเงิน (บาท)", 600, 156);

      ctx.fillStyle = "#1e293b";
      ctx.font = "11px sans-serif";
      ctx.fillText("1", 45, 182);
      ctx.fillText("ข้าวกล่อง (กระเพราไก่ไข่ดาว)", 90, 182);
      ctx.fillText("100 กล่อง", 400, 182);
      ctx.fillText("45.00", 500, 182);
      ctx.fillText("4,500.00", 620, 182);

      ctx.fillText("2", 45, 206);
      ctx.fillText("น้ำดื่มขวด 600ml", 90, 206);
      ctx.fillText("100 ขวด", 400, 206);
      ctx.fillText("7.00", 500, 206);
      ctx.fillText("700.00", 620, 206);

      // Subtotal Cat 1
      ctx.fillStyle = "#fff7ed";
      ctx.fillRect(25, 218, 700, 24);
      ctx.fillStyle = "#c2410c";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("รวมเงินหมวดโภชนาการ จำนวน 5,200.00 บาท", 420, 234);

      // Category 2: หมวดอุปกรณ์สำนักงาน
      ctx.fillStyle = "#f97316";
      ctx.fillRect(25, 252, 700, 24);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("หมวดอุปกรณ์สำนักงาน", 35, 269);

      // Table Header Cat 2
      ctx.fillStyle = "#334155";
      ctx.fillRect(25, 277, 700, 24);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("ลำดับ", 35, 293);
      ctx.fillText("รายการ", 90, 293);
      ctx.fillText("จำนวน", 400, 293);
      ctx.fillText("ราคา/หน่วย", 490, 293);
      ctx.fillText("รวมเป็นเงิน (บาท)", 600, 293);

      ctx.fillStyle = "#1e293b";
      ctx.font = "11px sans-serif";
      ctx.fillText("3", 45, 319);
      ctx.fillText("กระดาษถ่ายเอกสาร A4 80 แกรม", 90, 319);
      ctx.fillText("5 รีม", 400, 319);
      ctx.fillText("115.00", 500, 319);
      ctx.fillText("575.00", 620, 319);

      ctx.fillText("4", 45, 343);
      ctx.fillText("ป้ายไวนิลโครงการ 1x3m", 90, 343);
      ctx.fillText("1 ผืน", 400, 343);
      ctx.fillText("350.00", 500, 343);
      ctx.fillText("350.00", 620, 343);

      // Subtotal Cat 2
      ctx.fillStyle = "#fff7ed";
      ctx.fillRect(25, 355, 700, 24);
      ctx.fillStyle = "#c2410c";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("รวมเงินหมวดอุปกรณ์สำนักงาน จำนวน 925.00 บาท", 390, 371);

      // Grand Total Box
      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(25, 395, 700, 100);
      ctx.strokeStyle = "#cbd5e1";
      ctx.strokeRect(25, 395, 700, 100);

      ctx.fillStyle = "#0f172a";
      ctx.font = "bold 14px sans-serif";
      ctx.fillText("งบประมาณที่ขอรับการสนับสนุนทั้งสิ้น: 6,125.00 บาท", 45, 432);
      ctx.fillStyle = "#ea580c";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("(จำนวนเงินตัวหนังสือ: หกพันหนึ่งร้อยยี่สิบห้าบาทถ้วน)", 45, 458);
      ctx.font = "11px sans-serif";
      ctx.fillStyle = "#64748b";
      ctx.fillText("หมายเหตุ: สรุปผลรวมหมวดโภชนาการ (5,200.00) + หมวดอุปกรณ์สำนักงาน (925.00) = 6,125.00 บาท", 45, 480);

      // Signatures
      ctx.fillStyle = "#334155";
      ctx.font = "11px sans-serif";
      ctx.fillText("ลงชื่อ ...................................................... ผู้รับผิดชอบโครงการ", 45, 545);
      ctx.fillText("ลงชื่อ ...................................................... อาจารย์ที่ปรึกษา", 420, 545);
      ctx.fillText("(นายสมชาย มุ่งมั่น)", 75, 570);
      ctx.fillText("(ผศ.ดร.ใจดี มีสุข)", 450, 570);

      canvas.toBlob((blob) => {
        if (blob) {
          const sampleFile = new File([blob], "ตารางของบประมาณโครงการ_ตัวอย่าง_2569.jpg", { type: "image/jpeg" });
          addFiles([sampleFile]);
        }
      }, "image/jpeg");
      return;
    }

    // โหมดใบเสนอราคา / ใบเสร็จร้านค้า (QUOTATION MODE)
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, 750, 580);

    // Header Bar
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(0, 0, 750, 42);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 18px sans-serif";
    ctx.fillText("ใบเสนอราคา (QUOTATION)", 25, 28);

    // Vendor Info
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 14px sans-serif";
    ctx.fillText("ผู้เสนอราคา: บริษัท สุรนารี ออฟฟิศ ซัพพลาย แอนด์ เซอร์วิส จำกัด", 25, 70);
    ctx.font = "12px sans-serif";
    ctx.fillText("เลขผู้เสียภาษีผู้ขาย: 0105559012345 | โทร. 044-112233 | วันที่: 15 มกราคม 2568", 25, 90);

    // Customer Info Box (ตามระเบียบ มทส.)
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(25, 105, 700, 95);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(25, 105, 700, 95);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("ลูกค้า / ผู้รับการเสนอราคา (Customer):", 35, 125);
    ctx.font = "12px sans-serif";
    ctx.fillText("ชื่อลูกค้า: มหาวิทยาลัยเทคโนโลยีสุรนารี", 35, 145);
    ctx.fillText("ที่อยู่: 111 ถนนมหาวิทยาลัย ตำบล สุรนารี อำเภอเมือง จังหวัดนครราชสีมา 30000", 35, 165);
    ctx.fillText("เลขประจำตัวผู้เสียภาษี: 0994000288654   |   เบอร์โทรศัพท์: 04-422-0000", 35, 185);

    // Items Table
    ctx.fillStyle = "#ea580c";
    ctx.fillRect(25, 215, 700, 26);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("ลำดับ", 35, 233);
    ctx.fillText("รายการพัสดุ / บริการ", 90, 233);
    ctx.fillText("จำนวน", 400, 233);
    ctx.fillText("ราคา/หน่วย", 490, 233);
    ctx.fillText("จำนวนเงิน (บาท)", 600, 233);

    ctx.fillStyle = "#1e293b";
    ctx.font = "12px sans-serif";
    ctx.fillText("1", 45, 260);
    ctx.fillText("ข้าวกล่อง (กระเพราไก่ไข่ดาว)", 90, 260);
    ctx.fillText("100 กล่อง", 400, 260);
    ctx.fillText("45.00", 500, 260);
    ctx.fillText("4,500.00", 620, 260);

    ctx.fillText("2", 45, 285);
    ctx.fillText("น้ำดื่มขวด 600ml", 90, 285);
    ctx.fillText("100 ขวด", 400, 285);
    ctx.fillText("7.00", 500, 285);
    ctx.fillText("700.00", 620, 285);

    ctx.fillText("3", 45, 310);
    ctx.fillText("ป้ายไวนิลโครงการ 1x3m", 90, 310);
    ctx.fillText("1 ผืน", 400, 310);
    ctx.fillText("350.00", 500, 310);
    ctx.fillText("350.00", 620, 310);

    // Total Line
    ctx.strokeStyle = "#94a3b8";
    ctx.beginPath();
    ctx.moveTo(25, 330);
    ctx.lineTo(725, 330);
    ctx.stroke();

    ctx.font = "bold 13px sans-serif";
    ctx.fillText("ยอดรวมสุทธิทั้งสิ้น (Grand Total): ฿5,550.00", 430, 355);
    ctx.fillStyle = "#ea580c";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("(จำนวนเงินตัวหนังสือ: ห้าพันห้าร้อยห้าสิบบาทถ้วน)", 300, 375);

    // Terms Box
    ctx.fillStyle = "#f8fafc";
    ctx.fillRect(25, 395, 700, 160);
    ctx.strokeStyle = "#cbd5e1";
    ctx.strokeRect(25, 395, 700, 160);

    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("เงื่อนไขและข้อตกลงทางการค้า (Terms & Conditions):", 35, 418);
    ctx.font = "12px sans-serif";
    ctx.fillText("1. กำหนดยืนราคา: 30 วัน นับจากวันที่ออกใบเสนอราคา", 35, 440);
    ctx.fillText("2. กำหนดเวลาส่งมอบพัสดุ: ภายใน 7 วัน นับถัดจากวันได้รับใบสั่งจ้าง", 35, 462);

    ctx.fillText("ลงชื่อผู้เสนอราคา: .....................................................", 420, 495);
    ctx.font = "bold 12px sans-serif";
    ctx.fillText("(นายสมชาย สุรนารี)", 495, 520);
    ctx.font = "italic 11px sans-serif";
    ctx.fillText("ผู้จัดการฝ่ายขาย / ประทับตรา", 480, 538);

    canvas.toBlob((blob) => {
      if (blob) {
        const sampleFile = new File([blob], "ใบเสนอราคา_มทส_ตามระเบียบ.jpg", { type: "image/jpeg" });
        setIsQuotationCheck(true);
        addFiles([sampleFile]);
      }
    }, "image/jpeg");
  };

  // Clear selected files & reset state
  const handleReset = () => {
    setSelectedFiles([]);
    setAnalysisResults(null);
    setMerchantInfo(null);
    setCustomerInfo(null);
    setQuotationTerms(null);
    setProposalAudit(null);
    setDocumentType(null);
    setFinancialSummary(null);
    setDocumentWarnings([]);
    setOverallStatus(null);
    setUploadError(null);
    setIsProcessing(false);
    setProcessingStep(0);
    setIsQuotationCheck(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Multiple Files Analysis Handler
  const handleStartAudit = async () => {
    if (selectedFiles.length === 0 || isProcessing) return;

    setIsProcessing(true);
    setProcessingStep(1); // 1. กำลังบีบอัดรูปภาพและเตรียมข้อมูลไฟล์ (Client-side Compression & Base64)...
    setUploadError(null);
    setAnalysisResults(null);
    setMerchantInfo(null);
    setCustomerInfo(null);
    setQuotationTerms(null);
    setProposalAudit(null);
    setFinancialSummary(null);
    setDocumentWarnings([]);
    setOverallStatus(null);

    try {
      const payloadFiles: Array<{ mimeType: string; base64Data: string }> = [];
      let combinedExcelText = "";

      for (const item of selectedFiles) {
        if (item.type === "image") {
          // Client-side Image Compression via browser-image-compression
          let fileToProcess = item.file;
          try {
            const compressionOptions = {
              maxSizeMB: 1.2,
              maxWidthOrHeight: 1920,
              useWebWorker: true,
            };
            fileToProcess = await imageCompression(item.file, compressionOptions);
          } catch (compressionErr) {
            console.warn(`Image compression failed for ${item.name}, using original:`, compressionErr);
            fileToProcess = item.file;
          }

          const base64 = await fileToBase64(fileToProcess);
          payloadFiles.push({
            mimeType: fileToProcess.type || item.mimeType,
            base64Data: base64,
          });
        } else if (item.type === "pdf") {
          const base64 = await fileToBase64(item.file);
          payloadFiles.push({
            mimeType: item.mimeType,
            base64Data: base64,
          });
        } else if (item.type === "excel") {
          const csvText = await processExcelFile(item.file);
          if (csvText) {
            combinedExcelText += `\n[ไฟล์ Excel: ${item.name}]\n` + csvText + "\n";
          }
        }
      }

      // Step 2: Send to Native Gemini Fetch API (/api/analyze)
      setProcessingStep(2); // 2. กำลังวิเคราะห์และจับคู่ราคากลางด้วย Gemini AI...

      const aiRes = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: payloadFiles,
          excelText: combinedExcelText.trim(),
          priceMatrix: priceMatrix,
          documentMode: documentMode,
          isQuotationCheck: documentMode === "QUOTATION",
        }),
      });

      if (!aiRes.ok) {
        const errorJson = await aiRes.json().catch(() => ({}));
        throw new Error(errorJson.details || errorJson.error || `AI API returned status ${aiRes.status}`);
      }

      const data = await aiRes.json();
      let results: AnalysisItemResult[] = [];
      let merchant: MerchantInfo | null = null;
      let customer: CustomerInfo | null = null;
      let qTerms: QuotationTermsData | null = null;
      let propAudit: ProposalAuditData | null = null;
      let docTypeStr: string | null = null;
      let finSummary: FinancialSummaryData | null = null;
      let warningsList: string[] = [];
      let overallStatusStr: string | null = null;

      if (data && typeof data === "object" && !Array.isArray(data)) {
        results = Array.isArray(data.items) ? data.items : [];
        merchant = data.merchant || null;
        customer = data.customer || null;
        qTerms = data.quotationTerms || null;
        propAudit = data.proposalAudit || null;
        docTypeStr = data.documentType || null;
        finSummary = data.financialSummary || null;
        warningsList = Array.isArray(data.warnings) ? data.warnings : [];
        overallStatusStr = data.overallStatus || null;
      } else if (Array.isArray(data)) {
        results = data;
      }
      setProposalAudit(propAudit);

      // เงื่อนไข Math Error (!isMathCorrect) ให้ทำงานเฉพาะเมื่อเอกสารเป็นใบเสร็จที่ถูกต้อง (overallStatus !== 'INVALID_DOCUMENT' และมี items.length > 0) เท่านั้น
      if (
        overallStatusStr !== "INVALID_DOCUMENT" &&
        results.length > 0 &&
        finSummary?.isMathCorrect === false
      ) {
        overallStatusStr = "FAIL";
      }

      // ระบบตรวจจับบิลซ้ำ (Duplicate Receipt Detection)
      let isPossibleDuplicate = false;
      let duplicateOfDocId: string | null = null;
      const currentGrandTotal = Number(finSummary?.grandTotal ?? finSummary?.total ?? 0);

      if (
        overallStatusStr !== "INVALID_DOCUMENT" &&
        currentGrandTotal > 0 &&
        isFirebaseConfigured &&
        db
      ) {
        try {
          const historyRef = collection(db, "audit_history");
          const snapshot = await getDocs(historyRef);

          const currentMerchantName = (merchant?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
          const currentDate = (merchant?.date || "").trim().replace(/\s+/g, "");

          for (const docSnap of snapshot.docs) {
            const docData = docSnap.data();
            // กรองเอาเฉพาะข้อมูลที่ยังไม่ถูกลบ (isDeleted !== true)
            if (docData.isDeleted === true) continue;

            const existingTotal = Number(
              docData.financialSummary?.grandTotal ?? docData.financialSummary?.total ?? 0
            );
            const existingMerchantName = (docData.merchant?.name || "").trim().toLowerCase().replace(/\s+/g, " ");
            const existingDate = (docData.merchant?.date || "").trim().replace(/\s+/g, "");

            // ตรวจสอบว่าชื่อร้านค้า วันที่ในบิล และยอดเงินสุทธิตรงกันหรือไม่
            const isMerchantMatch =
              Boolean(currentMerchantName) &&
              currentMerchantName !== "ไม่ระบุ" &&
              Boolean(existingMerchantName) &&
              existingMerchantName !== "ไม่ระบุ" &&
              currentMerchantName === existingMerchantName;

            const isDateMatch =
              Boolean(currentDate) &&
              currentDate !== "ไม่ระบุ" &&
              Boolean(existingDate) &&
              existingDate !== "ไม่ระบุ" &&
              currentDate === existingDate;

            const isTotalMatch = Math.abs(existingTotal - currentGrandTotal) < 0.01;

            if (isMerchantMatch && isDateMatch && isTotalMatch) {
              isPossibleDuplicate = true;
              duplicateOfDocId = docSnap.id;
              break;
            }
          }
        } catch (dupErr) {
          console.warn("Error checking for duplicate receipts in Firestore:", dupErr);
        }
      }

      // หากตรวจพบรายการที่เข้าข่ายซ้ำ: ให้เพิ่มคำเตือนเข้าไปในลิสต์ warnings
      if (isPossibleDuplicate && duplicateOfDocId) {
        const duplicateWarningMsg = `⚠️ ตรวจพบบิลที่อาจซ้ำซ้อน: เคยมีประวัติการตรวจสอบบิลยอดนี้จากร้านนี้ในระบบแล้ว (Doc ID ที่ซ้ำ: ${duplicateOfDocId}) กรุณาตรวจสอบว่าไม่ใช่การนำบิลเก่ามาเบิกซ้ำ`;
        warningsList = [duplicateWarningMsg, ...warningsList];
      }

      setMerchantInfo(merchant);
      setCustomerInfo(customer);
      setQuotationTerms(qTerms);
      setDocumentType(docTypeStr);
      setFinancialSummary(finSummary);
      setDocumentWarnings(warningsList);
      setOverallStatus(overallStatusStr);

      // บันทึกประวัติการตรวจสอบลง Firestore collection `audit_history` (ข้ามหากเอกสารไม่ใช่ใบเสร็จ)
      if (isFirebaseConfigured && db && overallStatusStr !== "INVALID_DOCUMENT") {
        const failCount = results.filter(
          (item) => item.status === "FAIL" || item.status === "NOT_FOUND"
        ).length;

        addDoc(collection(db, "audit_history"), {
          createdAt: serverTimestamp(),
          itemsAnalyzed: results.length,
          failCount: failCount,
          scanResults: results,
          merchant: merchant || null,
          customer: customer || null,
          quotationTerms: qTerms || null,
          documentType: docTypeStr || null,
          financialSummary: finSummary || null,
          warnings: warningsList,
          overallStatus: overallStatusStr || (failCount > 0 ? "FAIL" : "PASS"),
          isPossibleDuplicate: isPossibleDuplicate,
          duplicateOfDocId: duplicateOfDocId || null,
        }).catch((err) => {
          console.warn("Error saving audit_history:", err);
        });
      }

      setProcessingStep(3); // 3. สรุปผลการตรวจสอบอนุมัติ...
      await new Promise((r) => setTimeout(r, 400));

      const now = Date.now();
      setAuditTimestamp(now);
      const datePart = new Date(now).toISOString().slice(2, 10).replace(/-/g, "");
      const randPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      setAuditRefCode(`AUD-${datePart}-${randPart}`);

      setAnalysisResults(results);
    } catch (err: any) {
      console.error("Audit Processing Error:", err);
      setUploadError(err.message || "เกิดข้อผิดพลาดในการประมวลผลวิเคราะห์เอกสาร");
    } finally {
      setIsProcessing(false);
      setProcessingStep(0);
    }
  };

  // Summary calculation
  const totalItemsCount = analysisResults ? analysisResults.length : 0;
  const passItemsCount = analysisResults ? analysisResults.filter((r) => r.status === "PASS").length : 0;
  const failItemsCount = analysisResults ? analysisResults.filter((r) => r.status === "FAIL").length : 0;
  const notFoundItemsCount = analysisResults ? analysisResults.filter((r) => r.status === "NOT_FOUND").length : 0;
  const isInvalidDocument = overallStatus === "INVALID_DOCUMENT";

  // Financial summary for print report & UI
  const calculatedItemsTotal = analysisResults
    ? analysisResults.reduce((acc, item) => {
        const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
        const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
        const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);
        return acc + Number(totalPrice);
      }, 0)
    : 0;

  const totalBillAmount = financialSummary && financialSummary.total && financialSummary.total > 0
    ? financialSummary.total
    : calculatedItemsTotal;

  // กฎ: เงื่อนไข Math Error (!isMathCorrect) ให้ทำงานเฉพาะเมื่อเอกสารเป็นใบเสร็จที่ถูกต้อง (overallStatus !== 'INVALID_DOCUMENT' และมี items.length > 0) เท่านั้น
  const hasApprovedItems = passItemsCount > 0;
  const hasValidAmount = totalBillAmount > 0;
  const isMathError =
    !isInvalidDocument &&
    totalItemsCount > 0 &&
    financialSummary?.isMathCorrect === false;

  const hasTampering =
    !isInvalidDocument &&
    (documentWarnings?.some((w) => typeof w === "string" && w.includes("ดัดแปลงหรือแก้ไข")) ?? false);

  const duplicateWarningText =
    documentWarnings?.find((w) => typeof w === "string" && w.includes("ตรวจพบบิลที่อาจซ้ำซ้อน")) || null;
  const hasDuplicate = !isInvalidDocument && Boolean(duplicateWarningText);

  const hasSutQuotationViolation =
    !isInvalidDocument &&
    (documentWarnings?.some((w) => typeof w === "string" && w.includes("[ระเบียบ มทส.]")) ?? false);

  const hasCompensationViolation =
    !isInvalidDocument &&
    (documentWarnings?.some((w) => typeof w === "string" && w.includes("อัตราค่าตอบแทนไม่ถูกต้อง")) ?? false);

  const isQuotationDoc =
    documentMode === "QUOTATION" &&
    (documentType === "QUOTATION" ||
      Boolean(quotationTerms?.isQuotation) ||
      isQuotationCheck ||
      hasSutQuotationViolation);

  const hasProposalViolation =
    documentMode === "PROPOSAL" &&
    !isInvalidDocument &&
    (proposalAudit?.isHorizontalMathCorrect === false ||
      proposalAudit?.isGrandTotalMatch === false ||
      (proposalAudit?.categoryChecks?.some((c) => !c.isMatch) ?? false));

  const isOverallPass =
    !isInvalidDocument &&
    !isMathError &&
    !hasTampering &&
    !hasDuplicate &&
    !hasSutQuotationViolation &&
    !hasCompensationViolation &&
    !hasProposalViolation &&
    totalItemsCount > 0 &&
    hasApprovedItems &&
    hasValidAmount &&
    failItemsCount === 0 &&
    notFoundItemsCount === 0;

  const isOverallHasFail =
    !isInvalidDocument &&
    (failItemsCount > 0 ||
      isMathError ||
      hasTampering ||
      hasSutQuotationViolation ||
      hasCompensationViolation ||
      hasProposalViolation);

  const isOverallPendingReview =
    !isInvalidDocument &&
    !isMathError &&
    !hasTampering &&
    !hasSutQuotationViolation &&
    !hasCompensationViolation &&
    !hasProposalViolation &&
    (hasDuplicate || (totalItemsCount > 0 && failItemsCount === 0 && (notFoundItemsCount > 0 || !hasApprovedItems || !hasValidAmount)));

  const totalPassAmount = analysisResults
    ? analysisResults
        .filter((item) => item.status === "PASS")
        .reduce((acc, item) => {
          const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
          const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
          const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);
          return acc + Number(totalPrice);
        }, 0)
    : 0;

  const totalFailOrPendingAmount = Math.max(0, totalBillAmount - totalPassAmount);

  // จัดกลุ่มรายการสินค้าตาม 6 หมวดหมู่งบประมาณสภานักศึกษา มทส.
  const groupedExpenseCategories = useMemo(() => {
    if (!analysisResults || analysisResults.length === 0) return [];

    const categoryGroups: {
      category: SutExpenseCategory;
      items: { item: AnalysisItemResult; originalIndex: number }[];
      subtotal: number;
      passCount: number;
      failCount: number;
    }[] = [];

    SUT_EXPENSE_CATEGORIES.forEach((cat) => {
      const itemsInCat: { item: AnalysisItemResult; originalIndex: number }[] = [];

      analysisResults.forEach((item, idx) => {
        const itemCat = normalizeExpenseCategory(
          item.category || item.matrixData?.category,
          item.receiptData?.itemName || item.itemInReceipt
        );
        if (itemCat === cat) {
          itemsInCat.push({ item, originalIndex: idx });
        }
      });

      if (itemsInCat.length > 0) {
        const subtotal = itemsInCat.reduce((sum, { item }) => {
          const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
          const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
          const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);
          return sum + Number(totalPrice);
        }, 0);

        const passCount = itemsInCat.filter(({ item }) => item.status === "PASS").length;
        const failCount = itemsInCat.filter(({ item }) => item.status === "FAIL" || item.status === "NOT_FOUND").length;

        categoryGroups.push({
          category: cat,
          items: itemsInCat,
          subtotal,
          passCount,
          failCount,
        });
      }
    });

    return categoryGroups;
  }, [analysisResults]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "หมวดค่าตอบแทน":
        return <Coins className="w-4 h-4 text-purple-600" />;
      case "หมวดโภชนาการ":
        return <Utensils className="w-4 h-4 text-emerald-600" />;
      case "หมวดยานพาหนะ":
        return <Car className="w-4 h-4 text-blue-600" />;
      case "หมวดอุปกรณ์ก่อสร้าง":
        return <Hammer className="w-4 h-4 text-amber-600" />;
      case "หมวดอุปกรณ์อิเล็กทรอนิกส์":
        return <Cpu className="w-4 h-4 text-indigo-600" />;
      case "หมวดอุปกรณ์สำนักงาน":
      default:
        return <Paperclip className="w-4 h-4 text-orange-600" />;
    }
  };

  const getCategoryBadgeStyle = (category: string) => {
    switch (category) {
      case "หมวดค่าตอบแทน":
        return "bg-purple-100 text-purple-800 border-purple-200";
      case "หมวดโภชนาการ":
        return "bg-emerald-100 text-emerald-800 border-emerald-200";
      case "หมวดยานพาหนะ":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "หมวดอุปกรณ์ก่อสร้าง":
        return "bg-amber-100 text-amber-800 border-amber-200";
      case "หมวดอุปกรณ์อิเล็กทรอนิกส์":
        return "bg-indigo-100 text-indigo-800 border-indigo-200";
      case "หมวดอุปกรณ์สำนักงาน":
      default:
        return "bg-orange-100 text-orange-800 border-orange-200";
    }
  };

  const formatThaiDateTime = (timestamp: number) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Print Page Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          @page {
            size: A4 portrait;
            margin: 12mm 15mm;
          }
          body {
            background-color: #ffffff !important;
            color: #000000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />

      {/* Header Bar (Orange & Amber SUT Identity) */}
      <header className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-md sticky top-0 z-50 print:hidden">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl flex items-center justify-center text-white shadow-inner">
              <ShieldCheck className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-base sm:text-lg font-bold tracking-tight text-white font-mono">
                  SUT PRE-AUDIT SYSTEM
                </h1>
                <span className="bg-amber-400/20 border border-amber-300/30 text-amber-100 text-[10px] px-2 py-0.5 rounded-full font-mono">
                  STUDENT COUNCIL
                </span>
              </div>
              <p className="text-[11px] text-orange-100 hidden sm:block">
                ระบบตรวจสอบเอกสารสภานักศึกษา มทส.
              </p>
            </div>
          </div>

          <Link
            href="/admin/login"
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-mono py-2 px-3.5 rounded-lg transition flex items-center space-x-1.5 backdrop-blur-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ Admin</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8 print:p-0 print:m-0 print:max-w-none print:space-y-0">
        
        {/* Banner Section */}
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden print:hidden">
          <div className="absolute top-0 right-0 transform translate-x-4 -translate-y-4 w-40 h-40 bg-orange-500/10 rounded-full blur-2xl pointer-events-none"></div>
          <div className="relative z-10 space-y-3">
            <div className="inline-flex items-center space-x-2 bg-orange-500/10 border border-orange-500/20 text-orange-700 text-xs font-semibold px-3 py-1 rounded-full">
              <Brain className="w-3.5 h-3.5 text-orange-600" />
              <span>ระบบวิเคราะห์ใบเสร็จ & ราคากลางด้วย Gemini AI</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              ตรวจสอบราคากลางโครงการนักศึกษา
            </h2>
            <p className="text-sm text-slate-600 leading-relaxed max-w-2xl">
              รองรับการอัปโหลดหลายไฟล์พร้อมกัน ทั้งภาพใบเสร็จ (JPG, PNG), เอกสาร PDF และตารางงบประมาณ Excel (.xlsx, .csv) เพื่อเปรียบเทียบกับฐานข้อมูลราคากลาง (<code className="text-orange-700 font-semibold font-mono">price_matrix</code>) 
              ของสภานักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี
            </p>
          </div>
        </section>

        {/* Step Process Bar */}
        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            selectedFiles.length > 0 ? "bg-orange-500 text-white border-orange-500 shadow-sm" : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 1</span>
            1. แนบเอกสาร ({selectedFiles.length} ไฟล์)
          </div>
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            isProcessing ? "bg-amber-500 text-white border-amber-500 shadow-sm animate-pulse" : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 2</span>
            2. วิเคราะห์ด้วย Gemini AI
          </div>
          <div className={`p-3 rounded-xl border text-xs sm:text-sm font-medium transition ${
            analysisResults
              ? isOverallPass
                ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                : isOverallHasFail
                ? "bg-rose-600 text-white border-rose-600 shadow-sm"
                : "bg-amber-500 text-white border-amber-500 shadow-sm"
              : "bg-white text-slate-500 border-slate-200"
          }`}>
            <span className="block font-mono text-[10px] uppercase opacity-80">ขั้นตอน 3</span>
            3. ผลการตรวจสอบ ({totalItemsCount} รายการ)
          </div>
        </div>

        {/* Error Alert Box */}
        {uploadError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-xs font-mono text-rose-700 flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-rose-900">[ERROR]: เกิดข้อผิดพลาดในระบบ</span>
              <p className="font-sans text-xs text-rose-700">{uploadError}</p>
            </div>
          </div>
        )}

        {/* Upload Section (Dropzone & Selection) */}
        {selectedFiles.length === 0 && (
          <div className="bg-white border-2 border-dashed border-orange-200 rounded-2xl p-6 sm:p-10 shadow-sm text-center space-y-6">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-amber-500 text-white rounded-2xl mx-auto flex items-center justify-center shadow-md">
              <UploadCloud className="w-8 h-8 stroke-[2]" />
            </div>

            <div className="space-y-1">
              <h3 className="text-lg font-bold text-slate-900">
                เลือกวิธีอัปโหลดเอกสารตรวจสอบราคากลาง
              </h3>
              <p className="text-xs text-slate-500">
                รองรับหลายไฟล์พร้อมกัน: รูปภาพ (JPG, PNG), เอกสาร PDF และไฟล์ Excel (.xlsx, .csv)
              </p>
            </div>

            {/* Hidden Input Elements */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*, application/pdf, .xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Main Action Buttons */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto pt-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold py-4 px-5 rounded-xl shadow-sm hover:shadow-md transition flex items-center justify-center space-x-3 group"
              >
                <Layers className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span className="text-sm">เลือกไฟล์ (รูป/PDF/Excel)</span>
              </button>

              <button
                type="button"
                onClick={() => cameraInputRef.current?.click()}
                className="w-full bg-slate-900 hover:bg-slate-800 text-white font-semibold py-4 px-5 rounded-xl shadow-sm hover:shadow-md transition flex items-center justify-center space-x-3 group"
              >
                <Camera className="w-5 h-5 group-hover:scale-110 transition-transform text-amber-400" />
                <span className="text-sm">ถ่ายรูปด้วยกล้อง</span>
              </button>
            </div>

            {/* Sample Button */}
            <div className="pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={handleSelectSample}
                className="inline-flex items-center space-x-2 text-xs font-medium text-orange-600 hover:text-orange-700 bg-orange-50 hover:bg-orange-100/80 px-4 py-2 rounded-lg transition"
              >
                <Zap className="w-3.5 h-3.5" />
                <span>ทดลองใช้เอกสารตัวอย่าง (ใบเสนอราคาโครงการ มทส.)</span>
              </button>
            </div>
          </div>
        )}

        {/* Selected Files List & Preview Section */}
        {selectedFiles.length > 0 && !analysisResults && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <FileCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900">
                    รายการไฟล์ที่เลือก ({selectedFiles.length} ไฟล์)
                  </h4>
                  <p className="text-xs text-slate-500">
                    พร้อมสำหรับการส่งไปสกัดและตรวจสอบราคากลางด้วย Gemini AI
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isProcessing}
                  className="text-xs text-orange-700 hover:text-orange-800 bg-orange-50 hover:bg-orange-100 px-3 py-1.5 rounded-lg transition border border-orange-200 font-medium flex items-center space-x-1.5 disabled:opacity-50"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>เพิ่มไฟล์</span>
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isProcessing}
                  className="text-xs text-slate-500 hover:text-rose-600 bg-slate-100 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition border border-slate-200 disabled:opacity-50"
                >
                  ล้างทั้งหมด
                </button>
              </div>
            </div>

            {/* Hidden Input Elements for Additional Files */}
            <input
              type="file"
              ref={fileInputRef}
              multiple
              accept="image/*, application/pdf, .xlsx, .xls, .csv"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Grid of Selected Files */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {selectedFiles.map((item) => (
                <div
                  key={item.id}
                  className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col justify-between space-y-3 relative group hover:border-orange-300 transition"
                >
                  <div className="flex items-start space-x-3">
                    <div className="p-2.5 rounded-lg shrink-0 flex items-center justify-center">
                      {item.type === "image" && (
                        item.previewUrl ? (
                          <img
                            src={item.previewUrl}
                            alt={item.name}
                            className="w-10 h-10 object-cover rounded-md border border-slate-200"
                          />
                        ) : (
                          <div className="w-10 h-10 bg-orange-100 text-orange-600 rounded-md flex items-center justify-center">
                            <ImageIcon className="w-5 h-5" />
                          </div>
                        )
                      )}
                      {item.type === "pdf" && (
                        <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-md flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                      {item.type === "excel" && (
                        <div className="w-10 h-10 bg-emerald-100 text-emerald-700 rounded-md flex items-center justify-center">
                          <FileSpreadsheet className="w-5 h-5" />
                        </div>
                      )}
                      {item.type === "other" && (
                        <div className="w-10 h-10 bg-slate-200 text-slate-600 rounded-md flex items-center justify-center">
                          <FileText className="w-5 h-5" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate" title={item.name}>
                        {item.name}
                      </p>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-[10px] uppercase font-mono px-1.5 py-0.2 bg-slate-200/80 text-slate-700 rounded">
                          {item.type}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {(item.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveFile(item.id)}
                      disabled={isProcessing}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded transition disabled:opacity-30"
                      title="ลบไฟล์นี้"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Processing Progress Status */}
            {isProcessing && (
              <div className="bg-slate-900 text-white rounded-xl p-4 space-y-3 font-mono text-xs">
                <div className="flex items-center space-x-2 text-amber-400 font-bold">
                  <RefreshCw className="w-4 h-4 animate-spin shrink-0" />
                  <span>
                    {processingStep === 1 && "กำลังบีบอัดรูปภาพและเตรียมข้อมูลไฟล์ (Client-side Compression & Base64)..."}
                    {processingStep === 2 && "กำลังให้ Gemini AI อ่านและเปรียบเทียบกับฐานข้อมูลราคากลาง..."}
                    {processingStep === 3 && "กำลังประมวลผลและจัดทำรายงานสรุป..."}
                  </span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-400 h-full transition-all duration-300"
                    style={{
                      width: processingStep === 1 ? "35%" : processingStep === 2 ? "70%" : "95%",
                    }}
                  ></div>
                </div>
              </div>
            )}

            {/* Document Mode Selector: Segmented Control */}
            <div className="bg-slate-100/90 p-2 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between px-1.5 pt-0.5">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-orange-600" />
                  เลือกประเภทเอกสารก่อนสแกน (Document Mode)
                </span>
                <span className="text-[11px] font-semibold text-orange-800 bg-orange-100/80 px-2 py-0.5 rounded-full border border-orange-200">
                  {documentMode === "PROPOSAL" ? "ตารางของบประมาณโครงการ" : "ใบเสนอราคา / ใบเสร็จร้านค้า"}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {/* Mode 1: Project Proposal Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setDocumentMode("PROPOSAL");
                    setIsQuotationCheck(false);
                  }}
                  className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    documentMode === "PROPOSAL"
                      ? "bg-white border-orange-500 shadow-sm ring-2 ring-orange-400/20"
                      : "bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      documentMode === "PROPOSAL" ? "bg-orange-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold block ${
                          documentMode === "PROPOSAL" ? "text-orange-950" : "text-slate-700"
                        }`}
                      >
                        ตารางของบประมาณโครงการ
                      </span>
                      {documentMode === "PROPOSAL" && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      ตรวจสูตรแนวนอน (จำนวน × ราคา), ผลรวม 6 หมวด และยอดงบที่ขอ เทียบราคากลางปี 2569 (ไม่ตรวจ Tax ID)
                    </p>
                  </div>
                </button>

                {/* Mode 2: Quotation / Receipt Mode */}
                <button
                  type="button"
                  onClick={() => {
                    setDocumentMode("QUOTATION");
                    setIsQuotationCheck(true);
                  }}
                  className={`relative flex items-start gap-3 p-3 rounded-xl border text-left transition-all ${
                    documentMode === "QUOTATION"
                      ? "bg-white border-orange-500 shadow-sm ring-2 ring-orange-400/20"
                      : "bg-white/60 border-slate-200 hover:bg-white hover:border-slate-300 text-slate-600"
                  }`}
                >
                  <div
                    className={`p-2 rounded-lg shrink-0 ${
                      documentMode === "QUOTATION" ? "bg-orange-500 text-white shadow-sm" : "bg-slate-100 text-slate-500"
                    }`}
                  >
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-bold block ${
                          documentMode === "QUOTATION" ? "text-orange-950" : "text-slate-700"
                        }`}
                      >
                        ใบเสนอราคา / ใบเสร็จร้านค้า
                      </span>
                      {documentMode === "QUOTATION" && (
                        <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0"></span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                      ตรวจระเบียบจัดซื้อจัดจ้าง มทส. 8 ข้อ (ชื่อ มทส., Tax ID 0994000288654, ยืนราคา, ลายเซ็น)
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Audit Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleStartAudit}
                disabled={isProcessing || selectedFiles.length === 0}
                className="w-full bg-gradient-to-r from-orange-500 via-orange-600 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-bold text-base py-4 px-6 rounded-xl shadow-md hover:shadow-lg transition flex items-center justify-center space-x-3 disabled:opacity-60 disabled:cursor-not-allowed group"
              >
                {isProcessing ? (
                  <>
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span>กำลังบีบอัดและวิเคราะห์เอกสาร...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-200 group-hover:rotate-12 transition-transform" />
                    <span>
                      เริ่มตรวจสอบ{documentMode === "PROPOSAL" ? "ตารางของบประมาณ" : "ใบเสนอราคา/ใบเสร็จ"}ด้วย Gemini AI ({selectedFiles.length} ไฟล์)
                    </span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Real Gemini AI Analysis Results Display */}
        {analysisResults && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300 print:hidden">
            
            {/* Overall Summary Card (แถบสถานะด้านบน) */}
            <div className={`rounded-2xl border-2 overflow-hidden shadow-lg ${
              isInvalidDocument
                ? "border-rose-500 bg-white"
                : isOverallPass
                ? "border-emerald-500 bg-white"
                : isOverallHasFail
                ? "border-rose-500 bg-white"
                : "border-amber-400 bg-white"
            }`}>
              <div className={`p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r ${
                isInvalidDocument
                  ? "from-rose-600 via-red-600 to-rose-700"
                  : isOverallPass
                  ? "from-emerald-600 via-teal-600 to-emerald-700"
                  : isOverallHasFail
                  ? "from-rose-600 via-red-600 to-rose-700"
                  : "from-amber-500 via-orange-500 to-amber-600"
              }`}>
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner">
                    {isInvalidDocument ? (
                      <FileWarning className="w-9 h-9 stroke-[2.2]" />
                    ) : isOverallPass ? (
                      <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                    ) : isOverallHasFail ? (
                      <XCircle className="w-9 h-9 stroke-[2.2]" />
                    ) : (
                      <AlertTriangle className="w-9 h-9 stroke-[2.2]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="inline-block bg-white/20 text-white text-xs font-mono px-2.5 py-0.5 rounded-full font-semibold">
                      ภาพรวม: {isInvalidDocument
                        ? "เอกสารไม่ถูกต้อง"
                        : hasTampering
                        ? "พบข้อสงสัยดัดแปลงเอกสาร"
                        : hasDuplicate
                        ? "ตรวจพบบิลที่อาจซ้ำซ้อน"
                        : hasSutQuotationViolation
                        ? "ผิดระเบียบใบเสนอราคา มทส."
                        : isOverallPass
                        ? "ทุกรายการผ่านเกณฑ์"
                        : isMathError
                        ? "คำนวณเลขท้ายบิลไม่ถูกต้อง"
                        : isOverallHasFail
                        ? "พบรายการที่ไม่ผ่านเกณฑ์"
                        : "มีรายการต้องใช้ดุลยพินิจ"}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                      {isInvalidDocument
                        ? "เอกสารไม่ถูกต้อง / ไม่ใช่ใบเสร็จรับเงิน"
                        : hasTampering
                        ? "พบข้อสงสัย: ตัวเลขในเอกสารอาจมีการดัดแปลงหรือแก้ไข"
                        : hasDuplicate
                        ? "ตรวจพบบิลที่อาจซ้ำซ้อน: เคยมีประวัติการตรวจสอบบิลนี้ในระบบแล้ว"
                        : hasSutQuotationViolation
                        ? "เอกสารไม่ผ่านระเบียบใบเสนอราคา มหาวิทยาลัยเทคโนโลยีสุรนารี"
                        : isOverallPass
                        ? "ผ่านการตรวจสอบราคากลางทั้งหมด"
                        : isMathError
                        ? "พบข้อผิดพลาด: ยอดคำนวณท้ายบิลไม่ถูกต้อง"
                        : isOverallHasFail
                        ? `พบ ${failItemsCount} รายการที่เกินเพดานราคากลาง`
                        : `พบ ${notFoundItemsCount} รายการที่ไม่อยู่ในฐานข้อมูลราคากลาง`}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/90">
                      {isInvalidDocument
                        ? (documentWarnings && documentWarnings.length > 0
                            ? documentWarnings[0]
                            : "รูปภาพที่ส่งเข้ามาไม่ใช่เอกสารทางการเงินหรือใบเสร็จรับเงิน กรุณาถ่ายภาพใบเสร็จให้ชัดเจน")
                        : hasSutQuotationViolation
                        ? (documentWarnings?.find((w) => typeof w === "string" && w.includes("[ระเบียบ มทส.]")) || "พบข้อกำหนดไม่ตรงตามระเบียบการจัดซื้อจัดจ้าง มทส.")
                        : `ตรวจพบทั้งหมด ${totalItemsCount} รายการ (ผ่าน ${passItemsCount} รายการ${
                            failItemsCount > 0 ? `, ไม่ผ่าน ${failItemsCount} รายการ` : ""
                          }${notFoundItemsCount > 0 ? `, ไม่อยู่ในฐานข้อมูล ${notFoundItemsCount} รายการ` : ""})`}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 self-stretch sm:self-auto justify-end">
                  {!isInvalidDocument && (
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="bg-white hover:bg-slate-100 text-slate-900 border border-slate-300 text-xs font-semibold py-2.5 px-4 rounded-xl shadow-xs transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <Printer className="w-3.5 h-3.5 text-slate-700" />
                      <span>พิมพ์ใบสรุปผล (Export PDF)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleReset}
                    className={`${
                      isInvalidDocument
                        ? "bg-white hover:bg-slate-100 text-slate-900 font-bold"
                        : "bg-white/20 hover:bg-white/30 text-white font-semibold"
                    } text-xs py-2.5 px-4 rounded-xl backdrop-blur-xs transition flex items-center space-x-1.5 cursor-pointer shadow-xs`}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ตรวจเอกสารชุดใหม่</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Document Integrity Warnings Alert Box */}
            {(isMathError || hasTampering || hasDuplicate || hasSutQuotationViolation || hasCompensationViolation || (documentWarnings && documentWarnings.length > 0)) && (
              <div className={`border-2 p-4 sm:p-5 rounded-2xl space-y-3 shadow-sm animate-in fade-in duration-300 ${
                isInvalidDocument || isMathError || hasTampering || hasSutQuotationViolation || hasCompensationViolation
                  ? "bg-rose-50 border-rose-400 text-rose-900"
                  : "bg-amber-50 border-amber-400 text-amber-900"
              }`}>
                {/* Red Alert Bar for Tampering Detection */}
                {!isInvalidDocument && hasTampering && (
                  <div className="bg-rose-600 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
                    <span>⚠️ พบข้อสงสัย: ตรวจพบร่องรอยการตัดต่อ ดัดแปลง หรือแก้ไขตัวเลขในเอกสาร</span>
                  </div>
                )}

                {/* Red Alert Bar for SUT Quotation Violation */}
                {!isInvalidDocument && hasSutQuotationViolation && (
                  <div className="bg-rose-600 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-xs">
                    <FileWarning className="w-4 h-4 shrink-0 text-white" />
                    <span>⚠️ เอกสารผิดระเบียบใบเสนอราคา มทส.: ตรวจพบข้อกำหนดที่ไม่เป็นไปตามระเบียบของมหาวิทยาลัย</span>
                  </div>
                )}

                {/* Red Alert Bar for Compensation Rate Violation */}
                {!isInvalidDocument && hasCompensationViolation && (
                  <div className="bg-rose-600 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
                    <span>⚠️ อัตราค่าตอบแทนไม่ถูกต้อง: วันที่จัดกิจกรรมตรงกับวันธรรมดา ต้องใช้อัตราวันธรรมดาแทนอัตราวันหยุด</span>
                  </div>
                )}

                {/* Red Alert Bar for Math Error - ซ่อนหาก isInvalidDocument หรือมี Tampering */}
                {!isInvalidDocument && !hasTampering && isMathError && (
                  <div className="bg-rose-600 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
                    <span>⚠️ ยอดคำนวณท้ายบิลไม่ถูกต้อง: ผลรวมรายการไม่ตรงกับยอดสุทธิ</span>
                  </div>
                )}

                {/* Amber Alert Bar for Duplicate Receipt Detection */}
                {!isInvalidDocument && hasDuplicate && duplicateWarningText && (
                  <div className="bg-amber-500 text-white font-bold text-xs sm:text-sm py-2.5 px-4 rounded-xl flex items-center space-x-2 shadow-xs">
                    <AlertTriangle className="w-4 h-4 shrink-0 text-white" />
                    <span>{duplicateWarningText}</span>
                  </div>
                )}

                <div className={`flex items-center space-x-2.5 font-bold text-sm ${isInvalidDocument || isMathError || hasTampering || hasSutQuotationViolation || hasCompensationViolation ? "text-rose-800" : "text-amber-800"}`}>
                  <AlertTriangle className={`w-5 h-5 shrink-0 ${isInvalidDocument || isMathError || hasTampering || hasSutQuotationViolation || hasCompensationViolation ? "text-rose-600" : "text-amber-600"}`} />
                  <span>แจ้งเตือนความสมบูรณ์ของเอกสาร (Document Integrity Warnings):</span>
                </div>
                {documentWarnings && documentWarnings.length > 0 && (
                  <ul className={`list-disc list-inside text-xs font-semibold space-y-1.5 pl-1.5 ${isInvalidDocument || isMathError || hasTampering || hasSutQuotationViolation || hasCompensationViolation ? "text-rose-900" : "text-amber-900"}`}>
                    {documentWarnings
                      .filter((warning) => (!isInvalidDocument || !warning.includes("คณิตศาสตร์")) && (!hasDuplicate || warning !== duplicateWarningText))
                      .map((warning, wIdx) => (
                        <li key={wIdx} className={warning.includes("[ระเบียบ มทส.]") || warning.includes("อัตราค่าตอบแทนไม่ถูกต้อง") ? "text-rose-700 font-bold" : ""}>
                          {warning}
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            )}

            {/* Merchant / Project & Financial Breakdown Card */}
            {(merchantInfo || financialSummary || proposalAudit) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
                {/* Document Information */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center space-x-1.5">
                    {documentMode === "PROPOSAL" ? (
                      <>
                        <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                        <span>ข้อมูลเอกสารโครงการ (Project Proposal Details)</span>
                      </>
                    ) : (
                      <>
                        <Building2 className="w-4 h-4 text-orange-600" />
                        <span>ข้อมูลร้านค้า / ผู้จำหน่าย (Merchant Details)</span>
                      </>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        {documentMode === "PROPOSAL" ? "ชื่อโครงการ / เอกสาร:" : "ร้านค้า / ผู้ให้บริการ:"}
                      </span>
                      <span className="font-bold text-slate-900 text-sm">
                        {isInvalidDocument
                          ? "-"
                          : documentMode === "PROPOSAL"
                          ? proposalAudit?.projectName || merchantInfo?.name || "โครงการกิจกรรมนักศึกษา"
                          : merchantInfo?.name || "ไม่ระบุ"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">วันที่ในเอกสาร:</span>
                      <span className="font-medium text-slate-800">
                        {isInvalidDocument ? "-" : (merchantInfo?.date || "ไม่ระบุ")}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">ประเภทเอกสาร:</span>
                      <span className="text-slate-800 font-medium">
                        {isInvalidDocument
                          ? "-"
                          : documentMode === "PROPOSAL"
                          ? "ตารางของบประมาณโครงการ"
                          : isQuotationDoc
                          ? "ใบเสนอราคา (Quotation)"
                          : merchantInfo?.isHandwritten
                          ? "บิลเงินสดเขียนมือ"
                          : "ใบเสร็จพิมพ์ / POS"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block text-[11px]">
                        {documentMode === "PROPOSAL" ? "สถานะการตรวจสอบ:" : "ลายเซ็นผู้รับเงิน:"}
                      </span>
                      <span
                        className={`font-semibold inline-flex items-center space-x-1 ${
                          isInvalidDocument
                            ? "text-slate-500 font-medium"
                            : documentMode === "PROPOSAL"
                            ? isOverallPass
                              ? "text-emerald-700"
                              : "text-rose-600 font-bold"
                            : merchantInfo?.hasReceiptSign
                            ? "text-emerald-700"
                            : "text-rose-600 font-bold"
                        }`}
                      >
                        {isInvalidDocument
                          ? "-"
                          : documentMode === "PROPOSAL"
                          ? isOverallPass
                            ? "✓ พร้อมเสนอขออนุมัติ"
                            : "✕ พบข้อผิดพลาด"
                          : merchantInfo?.hasReceiptSign
                          ? "✓ พบลายเซ็น/ตรายาง"
                          : "✕ ไม่พบลายเซ็น"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Financial Breakdown */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-1.5 flex items-center space-x-1.5">
                    <FileText className="w-4 h-4 text-orange-600" />
                    <span>
                      {documentMode === "PROPOSAL"
                        ? "สรุปยอดงบประมาณโครงการ (Budget Summary)"
                        : "สรุปยอดภาษีและส่วนลด (VAT & Discount Summary)"}
                    </span>
                  </div>
                  {documentMode === "PROPOSAL" ? (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">ผลรวมคำนวณจริง:</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {isInvalidDocument
                            ? "-"
                            : `฿${(proposalAudit?.calculatedGrandTotal || calculatedItemsTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">งบประมาณที่ขอ:</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {isInvalidDocument
                            ? "-"
                            : `฿${(proposalAudit?.requestedBudgetTotal || totalBillAmount).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">ผลต่าง (Diff):</span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            proposalAudit?.isGrandTotalMatch ? "text-emerald-600" : "text-rose-600"
                          }`}
                        >
                          {isInvalidDocument
                            ? "-"
                            : `฿${Math.abs((proposalAudit?.requestedBudgetTotal || 0) - (proposalAudit?.calculatedGrandTotal || 0)).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="bg-orange-50/60 p-2.5 rounded-xl border border-orange-200">
                        <span className="text-orange-900 block text-[10px] font-semibold">ยอดสุทธิรวม:</span>
                        <span className="font-mono font-bold text-orange-800 text-xs">
                          {isInvalidDocument
                            ? "-"
                            : `฿${totalBillAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">ยอดรวมก่อนลด:</span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {isInvalidDocument
                            ? "-"
                            : `฿${(financialSummary?.subtotal || calculatedItemsTotal).toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">ส่วนลด (Discount):</span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            !isInvalidDocument && (financialSummary?.discount || 0) > 0
                              ? "text-emerald-600"
                              : "text-slate-400"
                          }`}
                        >
                          {isInvalidDocument
                            ? "-"
                            : (financialSummary?.discount || 0) > 0
                            ? `-฿${financialSummary?.discount?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                            : "฿0.00"}
                        </span>
                      </div>
                      <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <span className="text-slate-500 block text-[10px]">ภาษีมูลค่าเพิ่ม (VAT):</span>
                        <span
                          className={`font-mono font-bold text-xs ${
                            !isInvalidDocument && (financialSummary?.vat || 0) > 0 ? "text-blue-600" : "text-slate-400"
                          }`}
                        >
                          {isInvalidDocument
                            ? "-"
                            : (financialSummary?.vat || 0) > 0
                            ? `+฿${financialSummary?.vat?.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`
                            : "฿0.00"}
                        </span>
                      </div>
                      <div className="bg-orange-50/60 p-2.5 rounded-xl border border-orange-200">
                        <span className="text-orange-900 block text-[10px] font-semibold">ยอดสุทธิรวม:</span>
                        <span className="font-mono font-bold text-orange-800 text-xs">
                          {isInvalidDocument
                            ? "-"
                            : `฿${totalBillAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Project Proposal Budget Audit Card (โหมด: ตารางของบประมาณโครงการ) */}
            {!isInvalidDocument && documentMode === "PROPOSAL" && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                      <FileSpreadsheet className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <span>ผลการตรวจสอบตารางของบประมาณโครงการ</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-mono px-2 py-0.5 rounded-full border border-amber-200">
                          Project Proposal Audit
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {proposalAudit?.projectName
                          ? `ชื่อโครงการ: ${proposalAudit.projectName}`
                          : "ตรวจสอบความถูกต้องของโครงสร้างตารางงบประมาณ 6 หมวด และสูตรคณิตศาสตร์"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span
                      className={`text-xs font-bold font-mono px-3 py-1 rounded-full border ${
                        proposalAudit?.isGrandTotalMatch &&
                        proposalAudit?.isHorizontalMathCorrect &&
                        (!proposalAudit?.categoryChecks || proposalAudit.categoryChecks.every((c) => c.isMatch))
                          ? "bg-emerald-100 text-emerald-800 border-emerald-300"
                          : "bg-rose-100 text-rose-800 border-rose-300"
                      }`}
                    >
                      {proposalAudit?.isGrandTotalMatch &&
                      proposalAudit?.isHorizontalMathCorrect &&
                      (!proposalAudit?.categoryChecks || proposalAudit.categoryChecks.every((c) => c.isMatch))
                        ? "✓ ตารางงบประมาณถูกต้องครบถ้วน"
                        : "✕ พบข้อผิดพลาดในตารางงบประมาณ"}
                    </span>
                  </div>
                </div>

                {/* 3 Metrics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                  {/* Metric 1: Horizontal Math */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        1. สูตรแนวนอน
                      </span>
                      {proposalAudit?.isHorizontalMathCorrect ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ ผ่านทุกรายการ
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                          ✕ คำนวณเลขผิด
                        </span>
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        จำนวน × ราคา/หน่วย == รวมเงิน
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {proposalAudit?.isHorizontalMathCorrect
                          ? "คำนวณถูกต้องครบทุกแถวรายการ"
                          : "พบแถวรายการที่คำนวณตัวเลขผิด"}
                      </p>
                    </div>
                  </div>

                  {/* Metric 2: Category Subtotals */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        2. ยอดรวมแต่ละหมวด
                      </span>
                      {(!proposalAudit?.categoryChecks || proposalAudit.categoryChecks.every((c) => c.isMatch)) ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ ตรงกันทุกหมวด
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                          ✕ มียอดหมวดไม่ตรง
                        </span>
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        ผลรวมรายการ == ยอดรวมหมวด
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {proposalAudit?.categoryChecks?.length || 0} หมวดงบประมาณที่ตรวจพบ
                      </p>
                    </div>
                  </div>

                  {/* Metric 3: Grand Total Match */}
                  <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                        3. งบประมาณทั้งสิ้น
                      </span>
                      {proposalAudit?.isGrandTotalMatch ? (
                        <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded border border-emerald-200">
                          ✓ ยอดตรงกัน
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded border border-rose-200">
                          ✕ ยอดไม่ตรง
                        </span>
                      )}
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">
                        งบที่ขอ: ฿{(proposalAudit?.requestedBudgetTotal || 0).toLocaleString()}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        คำนวณจริง: ฿{(proposalAudit?.calculatedGrandTotal || 0).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Category Subtotals Detailed Table */}
                {proposalAudit?.categoryChecks && proposalAudit.categoryChecks.length > 0 && (
                  <div className="border border-slate-200/80 rounded-xl overflow-hidden">
                    <div className="bg-slate-100/70 px-3.5 py-2 border-b border-slate-200/80 flex items-center justify-between text-xs font-bold text-slate-700">
                      <span className="flex items-center gap-1.5">
                        <Layers className="w-3.5 h-3.5 text-orange-600" />
                        ตารางสรุปผลรวมรายหมวดงบประมาณ (Category Subtotals)
                      </span>
                      <span className="text-[11px] font-normal text-slate-500">
                        ผลรวมรายการย่อยเทียบกับข้อความ &ldquo;รวมเงินหมวด...&rdquo;
                      </span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-slate-50 text-[11px] text-slate-500 border-b border-slate-200/60 uppercase font-semibold">
                            <th className="py-2.5 px-3">หมวดงบประมาณ</th>
                            <th className="py-2.5 px-3 text-center">จำนวนรายการ</th>
                            <th className="py-2.5 px-3 text-right">ยอดที่ระบุในตาราง (บาท)</th>
                            <th className="py-2.5 px-3 text-right">ผลรวมคำนวณจริง (บาท)</th>
                            <th className="py-2.5 px-3 text-center">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {proposalAudit.categoryChecks.map((catCheck, cIdx) => (
                            <tr key={cIdx} className="hover:bg-slate-50/50">
                              <td className="py-2.5 px-3 font-semibold text-slate-800">
                                {catCheck.category}
                              </td>
                              <td className="py-2.5 px-3 text-center text-slate-600">
                                {catCheck.itemCount} รายการ
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                                ฿{catCheck.detectedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                ฿{catCheck.calculatedSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2.5 px-3 text-center">
                                {catCheck.isMatch ? (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                    ตรงกัน
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                                    <XCircle className="w-3 h-3 text-rose-600" />
                                    ไม่ตรงกัน
                                  </span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* SUT Quotation Compliance Audit Card (8 ข้อกำหนดระเบียบ มทส. - เฉพาะโหมดใบเสนอราคา) */}
            {!isInvalidDocument && documentMode === "QUOTATION" && (isQuotationDoc || quotationTerms || customerInfo) && (
              <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-orange-100 text-orange-600 rounded-xl">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 flex items-center space-x-2">
                        <span>ผลการตรวจสอบตามระเบียบใบเสนอราคา มทส. (8 ข้อกำหนด)</span>
                        <span className="text-[10px] bg-orange-100 text-orange-800 font-mono px-2 py-0.5 rounded-full border border-orange-200">
                          SUT Procurement Rules
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        เกณฑ์ข้อกำหนดสำหรับใบเสนอราคาในการจัดซื้อจัดจ้าง มหาวิทยาลัยเทคโนโลยีสุรนารี
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`text-xs font-bold font-mono px-3 py-1 rounded-full border ${
                      hasSutQuotationViolation
                        ? "bg-rose-100 text-rose-800 border-rose-300"
                        : "bg-emerald-100 text-emerald-800 border-emerald-300"
                    }`}>
                      {hasSutQuotationViolation ? "✕ ผิดระเบียบ มทส." : "✓ ครบถ้วนตามระเบียบ มทส."}
                    </span>
                  </div>
                </div>

                {/* 8 Rules Checklist Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Category 1: ข้อมูลลูกค้า (Customer Info) */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5 border-b border-slate-200/60 pb-1.5">
                      <Building2 className="w-3.5 h-3.5 text-orange-600" />
                      <span>1. ข้อมูลมหาวิทยาลัยผู้จัดซื้อ (Customer Details)</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      {/* Rule 1: Customer Name */}
                      <div className="flex items-start space-x-2">
                        {customerInfo?.isSutCustomer ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              1. ชื่อลูกค้า: &ldquo;มหาวิทยาลัยเทคโนโลยีสุรนารี&rdquo;
                            </span>
                            <span className={`text-[10px] font-bold ${customerInfo?.isSutCustomer ? "text-emerald-700" : "text-rose-600"}`}>
                              {customerInfo?.isSutCustomer ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 truncate" title={customerInfo?.name || "ไม่ระบุ"}>
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{customerInfo?.name || "ไม่ระบุ"}</span>
                          </p>
                          {!customerInfo?.isSutCustomer && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ต้องเป็นชื่อ &ldquo;มหาวิทยาลัยเทคโนโลยีสุรนารี&rdquo; เท่านั้น (ห้ามเป็นชื่อนักศึกษา/ชมรม/อาจารย์)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 2: Customer Address */}
                      <div className="flex items-start space-x-2">
                        {customerInfo?.hasCorrectAddress ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              2. ที่อยู่ลูกค้า: ระบุที่อยู่ มทส. ครบถ้วน
                            </span>
                            <span className={`text-[10px] font-bold ${customerInfo?.hasCorrectAddress ? "text-emerald-700" : "text-rose-600"}`}>
                              {customerInfo?.hasCorrectAddress ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 line-clamp-2" title={customerInfo?.address || "ไม่ระบุ"}>
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{customerInfo?.address || "ไม่ระบุ"}</span>
                          </p>
                          {!customerInfo?.hasCorrectAddress && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ต้องมี &ldquo;111 ถนนมหาวิทยาลัย ตำบล สุรนารี อำเภอเมือง จังหวัดนครราชสีมา 30000&rdquo;
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 3: Customer Tax ID */}
                      <div className="flex items-start space-x-2">
                        {customerInfo?.hasCorrectTaxId ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              3. เลขประจำตัวผู้เสียภาษี: 0994000288654
                            </span>
                            <span className={`text-[10px] font-bold ${customerInfo?.hasCorrectTaxId ? "text-emerald-700" : "text-rose-600"}`}>
                              {customerInfo?.hasCorrectTaxId ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-mono">
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{customerInfo?.taxId || "ไม่ระบุ"}</span>
                          </p>
                          {!customerInfo?.hasCorrectTaxId && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ขาดหรือระบุไม่ตรงกับเลขประจำตัวผู้เสียภาษี มทส. (0994000288654)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 4: Customer Phone */}
                      <div className="flex items-start space-x-2">
                        {customerInfo?.hasCorrectPhone ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              4. เบอร์โทรศัพท์ลูกค้า: 04-422-0000
                            </span>
                            <span className={`text-[10px] font-bold ${customerInfo?.hasCorrectPhone ? "text-emerald-700" : "text-rose-600"}`}>
                              {customerInfo?.hasCorrectPhone ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600 font-mono">
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{customerInfo?.phone || "ไม่ระบุ"}</span>
                          </p>
                          {!customerInfo?.hasCorrectPhone && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ขาดหรือไม่พบเบอร์โทรศัพท์ของมหาวิทยาลัย (04-422-0000)
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Category 2: เงื่อนไขเอกสาร (Terms & Conditions) */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3.5 space-y-3">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5 border-b border-slate-200/60 pb-1.5">
                      <FileCheck className="w-3.5 h-3.5 text-orange-600" />
                      <span>2. เงื่อนไขและข้อกำหนด (Terms & Conditions)</span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      {/* Rule 5: Price Validity */}
                      <div className="flex items-start space-x-2">
                        {Boolean(quotationTerms?.priceValidity && quotationTerms.priceValidity.trim() !== "") ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              5. ระยะเวลายืนราคา (Price Validity)
                            </span>
                            <span className={`text-[10px] font-bold ${Boolean(quotationTerms?.priceValidity && quotationTerms.priceValidity.trim() !== "") ? "text-emerald-700" : "text-rose-600"}`}>
                              {Boolean(quotationTerms?.priceValidity && quotationTerms.priceValidity.trim() !== "") ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{quotationTerms?.priceValidity || "ไม่ระบุ"}</span>
                          </p>
                          {!Boolean(quotationTerms?.priceValidity && quotationTerms.priceValidity.trim() !== "") && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ไม่พบข้อความระบุระยะเวลายืนราคา (เช่น 30 วัน, 60 วัน)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 6: Delivery Term */}
                      <div className="flex items-start space-x-2">
                        {Boolean(quotationTerms?.deliveryTerm && quotationTerms.deliveryTerm.trim() !== "") ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              6. กำหนดเวลาส่งมอบพัสดุ (Delivery Time)
                            </span>
                            <span className={`text-[10px] font-bold ${Boolean(quotationTerms?.deliveryTerm && quotationTerms.deliveryTerm.trim() !== "") ? "text-emerald-700" : "text-rose-600"}`}>
                              {Boolean(quotationTerms?.deliveryTerm && quotationTerms.deliveryTerm.trim() !== "") ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            ที่ตรวจพบ: <span className="font-medium text-slate-900">{quotationTerms?.deliveryTerm || "ไม่ระบุ"}</span>
                          </p>
                          {!Boolean(quotationTerms?.deliveryTerm && quotationTerms.deliveryTerm.trim() !== "") && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ไม่พบข้อความระบุกำหนดเวลาส่งมอบพัสดุ
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 7: Text Amount */}
                      <div className="flex items-start space-x-2">
                        {Boolean(quotationTerms?.hasTextAmount) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              7. ตัวหนังสือกำกับยอดสุทธิ (Text Amount)
                            </span>
                            <span className={`text-[10px] font-bold ${Boolean(quotationTerms?.hasTextAmount) ? "text-emerald-700" : "text-rose-600"}`}>
                              {Boolean(quotationTerms?.hasTextAmount) ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            สถานะ: <span className="font-medium text-slate-900">{quotationTerms?.hasTextAmount ? "✓ มีตัวหนังสือภาษาไทยกำกับ" : "✕ ไม่พบตัวหนังสือ"}</span>
                          </p>
                          {!Boolean(quotationTerms?.hasTextAmount) && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ยอดสุทธิขาดตัวหนังสือกำกับจำนวนเงิน (Text Amount)
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Rule 8: Quotation Signature */}
                      <div className="flex items-start space-x-2">
                        {Boolean(quotationTerms?.hasQuotationSign) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        )}
                        <div className="space-y-0.5 flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <span className="font-semibold text-slate-800 text-[11px]">
                              8. ลายมือชื่อผู้เสนอราคา / ตรายาง
                            </span>
                            <span className={`text-[10px] font-bold ${Boolean(quotationTerms?.hasQuotationSign) ? "text-emerald-700" : "text-rose-600"}`}>
                              {Boolean(quotationTerms?.hasQuotationSign) ? "ผ่าน" : "ไม่ผ่าน"}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-600">
                            สถานะ: <span className="font-medium text-slate-900">{quotationTerms?.hasQuotationSign ? "✓ พบลายเซ็น/ตราประทับร้านค้า" : "✕ ขาดลายเซ็นผู้เสนอราคา"}</span>
                          </p>
                          {!Boolean(quotationTerms?.hasQuotationSign) && (
                            <p className="text-[10px] text-rose-600 font-medium">
                              * ขาดลายมือชื่อผู้เสนอราคาหรือตราประทับ
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* List of Detected Items */}
            {isInvalidDocument ? (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 sm:p-10 text-center text-slate-500 space-y-3 shadow-sm">
                <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto">
                  <FileWarning className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-slate-800 text-base">ไม่สามารถวิเคราะห์รายการสินค้า/บริการได้</h4>
                <p className="text-xs sm:text-sm text-slate-500 max-w-md mx-auto">
                  เนื่องจากเอกสารที่อัปโหลดไม่ใช่ใบเสร็จรับเงินหรือเอกสารการเบิกจ่ายทางการเงิน กรุณากดปุ่ม &ldquo;ตรวจเอกสารชุดใหม่&rdquo; เพื่ออัปโหลดเอกสารที่ถูกต้อง
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-black text-white text-xs font-semibold py-2.5 px-4 rounded-xl transition cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ตรวจเอกสารชุดใหม่</span>
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                    <Layers className="w-5 h-5 text-orange-600" />
                    <span>รายละเอียดผลการตรวจสอบแยกตาม 6 หมวดงบประมาณ ({totalItemsCount} รายการ)</span>
                  </h4>
                </div>

                {/* 6 SUT Budget Categories Summary Bar */}
                {groupedExpenseCategories.length > 0 && (
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                      <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
                        <FileSpreadsheet className="w-4 h-4 text-orange-600" />
                        <span>สรุปยอดเงินแยกตามหมวดหมู่งบประมาณสภานักศึกษา มทส.</span>
                      </span>
                      <span className="text-[11px] font-mono text-slate-500">
                        {groupedExpenseCategories.length} หมวดที่มีการเบิกจ่าย
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {groupedExpenseCategories.map((group) => (
                        <div
                          key={group.category}
                          className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1 hover:border-orange-300 transition"
                        >
                          <div className="flex items-center space-x-1.5 text-xs">
                            {getCategoryIcon(group.category)}
                            <span className="font-bold text-slate-800 text-[11px] truncate" title={group.category}>
                              {group.category}
                            </span>
                          </div>
                          <div className="flex justify-between items-baseline">
                            <span className="font-mono font-extrabold text-xs sm:text-sm text-slate-900">
                              ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <span className="text-[10px] text-slate-500 block">
                            {group.items.length} รายการ (ผ่าน {group.passCount}{group.failCount > 0 ? `, ไม่ผ่าน ${group.failCount}` : ""})
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Items Grouped by Category */}
                <div className="space-y-6">
                  {groupedExpenseCategories.map((group) => (
                    <div
                      key={group.category}
                      className="bg-white border-2 border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-sm space-y-4"
                    >
                      {/* Category Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                        <div className="flex items-center space-x-3">
                          <div className="p-2.5 bg-slate-100 rounded-xl">
                            {getCategoryIcon(group.category)}
                          </div>
                          <div>
                            <div className="flex items-center space-x-2">
                              <h5 className="text-base font-extrabold text-slate-900">
                                {group.category}
                              </h5>
                              <span className="text-xs bg-slate-100 text-slate-600 px-2.5 py-0.5 rounded-full font-mono font-semibold">
                                {group.items.length} รายการ
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500">
                              ผ่านเกณฑ์ {group.passCount} รายการ
                              {group.failCount > 0 && `, ต้องตรวจสอบ ${group.failCount} รายการ`}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2 self-end sm:self-auto bg-slate-50 px-3.5 py-2 rounded-xl border border-slate-200">
                          <span className="text-xs text-slate-600 font-semibold">รวมเงิน{group.category}:</span>
                          <span className="font-mono font-extrabold text-base text-slate-900">
                            ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                      </div>

                      {/* Item Cards inside this Category */}
                      <div className="grid grid-cols-1 gap-4">
                        {group.items.map(({ item, originalIndex }) => {
                          const idx = originalIndex;
                          const isPass = item.status === "PASS";
                          const isFail = item.status === "FAIL";
                          const isNotFound = item.status === "NOT_FOUND";

                          const itemName = item.receiptData?.itemName || item.itemInReceipt || "รายการที่ตรวจพบ";
                          const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
                          const personCount = item.receiptData?.personCount;
                          const receiptUnit = item.receiptData?.unit || item.unit || "หน่วย";
                          const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
                          const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);

                          const matrixName = item.matrixData?.itemName || item.matchedMatrixItem || null;
                          const matrixMaxPrice = item.matrixData?.maxPrice != null ? item.matrixData.maxPrice : (item.matrixMaxPrice != null ? item.matrixMaxPrice : null);
                          const matrixUnit = item.matrixData?.unit || null;

                          const errorFlags = Array.isArray(item.errorFlags) ? item.errorFlags : [];
                          const isUnitMismatch = errorFlags.includes("หน่วยไม่ตรง") || !!(matrixUnit && receiptUnit && matrixUnit.trim().toLowerCase() !== receiptUnit.trim().toLowerCase() && !(personCount && personCount > 1 && matrixUnit.toLowerCase().includes(receiptUnit.toLowerCase())));

                          const hasBackendMathError = errorFlags.includes("คำนวณเลขผิด");
                          const expectedStandard = qty * unitPrice;
                          const expectedMultidim = (personCount || 1) * qty * unitPrice;
                          const isClientMathError =
                            Math.abs(expectedStandard - totalPrice) > 0.05 &&
                            Math.abs(expectedMultidim - totalPrice) > 0.05;
                          const isMathError = hasBackendMathError || isClientMathError;

                          const hasMatrixMax = matrixMaxPrice != null && matrixMaxPrice > 0;
                          const priceDiff = hasMatrixMax ? unitPrice - matrixMaxPrice : 0;

                          return (
                            <div
                              key={originalIndex}
                              className={`bg-white border-2 rounded-xl p-4 sm:p-5 shadow-xs transition space-y-3.5 ${
                                isPass
                                  ? "border-emerald-200 hover:border-emerald-400"
                                  : isFail
                                  ? "border-rose-300 hover:border-rose-500 bg-rose-50/10"
                                  : "border-amber-300 bg-amber-50/30 hover:border-amber-400"
                              }`}
                            >
                              {/* Item Header */}
                              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                                <div className="flex items-start space-x-3">
                                  <div className={`p-2.5 rounded-xl shrink-0 mt-0.5 ${
                                    isPass
                                      ? "bg-emerald-100 text-emerald-700"
                                      : isFail
                                      ? "bg-rose-100 text-rose-700"
                                      : "bg-amber-100 text-amber-800"
                                  }`}>
                                    {isPass ? (
                                      <CheckCircle2 className="w-5 h-5" />
                                    ) : isFail ? (
                                      <XCircle className="w-5 h-5" />
                                    ) : (
                                      <AlertTriangle className="w-5 h-5" />
                                    )}
                                  </div>
                                  <div className="space-y-1">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-[11px] font-mono text-slate-400">ลำดับที่ {idx + 1}</span>
                                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${getCategoryBadgeStyle(group.category)}`}>
                                        {group.category}
                                      </span>
                                    </div>
                                    <h5 className="text-base font-bold text-slate-900 leading-snug">
                                      {itemName}
                                    </h5>
                                    {matrixName && (
                                      <div className="text-xs text-slate-500 font-mono flex items-center space-x-1.5">
                                        <span>จับคู่ราคากลาง:</span>
                                        <span className="bg-slate-100 text-slate-800 px-2 py-0.5 rounded font-semibold">{matrixName}</span>
                                      </div>
                                    )}
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto justify-end">
                                  {isFail && errorFlags.map((flag, fIdx) => (
                                    <span
                                      key={fIdx}
                                      className="text-xs font-bold font-mono px-2.5 py-0.5 rounded-full bg-rose-600 text-white shadow-xs"
                                    >
                                      [{flag}]
                                    </span>
                                  ))}
                                  <span
                                    className={`text-xs font-bold font-mono px-3 py-1 rounded-full ${
                                      isPass
                                        ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                                        : isFail
                                        ? "bg-rose-100 text-rose-800 border border-rose-300"
                                        : "bg-amber-100 text-amber-900 border border-amber-300"
                                    }`}
                                  >
                                    {isNotFound ? "NOT FOUND" : item.status}
                                  </span>
                                </div>
                              </div>

                              {/* Not Found Special Alert Notice */}
                              {isNotFound && (
                                <div className="bg-amber-100/70 border border-amber-300 p-3 rounded-xl flex items-start space-x-2.5 text-xs text-amber-900">
                                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                  <span className="font-medium">
                                    รายการนี้ไม่อยู่ในราคากลาง ต้องตรวจสอบด้วยดุลยพินิจของคณะกรรมการ
                                  </span>
                                </div>
                              )}

                              {/* Receipt Math & Qty Calculation Breakdown Box */}
                              <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3.5 space-y-1.5 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <div className="flex items-center space-x-2 text-slate-700 flex-wrap">
                                    <span className="font-semibold text-slate-900">จำนวน & ราคาในบิล:</span>
                                    {personCount && personCount > 1 && (
                                      <>
                                        <span className="font-mono bg-blue-50 text-blue-800 px-2 py-0.5 border border-blue-200 rounded font-bold">
                                          {personCount} คน
                                        </span>
                                        <span>×</span>
                                      </>
                                    )}
                                    <span className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded text-slate-900">
                                      {qty}{" "}
                                      {isUnitMismatch ? (
                                        <span className="text-amber-700 font-bold underline" title={`หน่วยในบิล '${receiptUnit}' ไม่ตรงกับหน่วยราคากลาง '${matrixUnit}'`}>
                                          {receiptUnit} (หน่วยไม่ตรง)
                                        </span>
                                      ) : (
                                        receiptUnit
                                      )}
                                    </span>
                                    <span>×</span>
                                    <span className="font-mono bg-white px-2 py-0.5 border border-slate-200 rounded font-bold text-slate-900">
                                      ฿{Number(unitPrice).toFixed(2)}
                                    </span>
                                  </div>

                                  <div className="text-right">
                                    <span className="text-slate-500">ราคารวมในบิล: </span>
                                    <span className="font-mono font-bold text-sm text-slate-900">
                                      ฿{Number(totalPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                                    </span>
                                  </div>
                                </div>

                                {isMathError && (
                                  <div className="text-[11px] text-rose-600 font-medium flex items-center space-x-1 pt-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>
                                      คูณเลขไม่ตรง:{" "}
                                      {personCount && personCount > 1 ? `${personCount} คน × ` : ""}
                                      {qty} × {unitPrice} = {((personCount && personCount > 1 ? personCount : 1) * qty * unitPrice).toFixed(2)} แต่ในบิลระบุ {Number(totalPrice).toFixed(2)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Price Matrix Comparison Box */}
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50/50 p-3 rounded-xl border border-slate-100 text-xs">
                                <div className="space-y-1">
                                  <span className="text-slate-500">เพดานราคากลาง (Price Matrix Limit):</span>
                                  <div className="font-mono font-bold text-slate-900 flex items-center space-x-1">
                                    {hasMatrixMax ? (
                                      <>
                                        <span className="text-sm">฿{Number(matrixMaxPrice).toFixed(2)}</span>
                                        <span className="text-slate-500 font-normal">
                                          /{" "}
                                          {isUnitMismatch ? (
                                            <span className="text-amber-700 font-bold">{matrixUnit}</span>
                                          ) : (
                                            matrixUnit || receiptUnit
                                          )}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-xs text-slate-400 font-sans font-normal">ไม่มีในฐานราคากลาง</span>
                                    )}
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <span className="text-slate-500">ส่วนต่างราคาต่อหน่วย:</span>
                                  {isNotFound ? (
                                    <div className="text-xs font-semibold text-amber-800 flex items-center space-x-1 mt-0.5">
                                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                                      <span>รอการพิจารณา</span>
                                    </div>
                                  ) : (
                                    <div className={`text-base font-extrabold font-mono flex items-center space-x-1 ${
                                      priceDiff <= 0 ? "text-emerald-600" : "text-rose-600"
                                    }`}>
                                      {priceDiff <= 0 ? (
                                        <>
                                          <TrendingDown className="w-4 h-4 shrink-0" />
                                          <span>ประหยัด ฿{Math.abs(priceDiff).toFixed(2)}</span>
                                        </>
                                      ) : (
                                        <>
                                          <TrendingUp className="w-4 h-4 shrink-0" />
                                          <span>เกินเกณฑ์ ฿{Math.abs(priceDiff).toFixed(2)}</span>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Message Explanation */}
                              <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                                <span className="font-semibold text-slate-800 font-mono text-[11px]">ผลการวิเคราะห์: </span>
                                {item.message}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Category Subtotal Footer */}
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex justify-between items-center text-xs font-bold text-slate-800">
                        <div className="flex items-center space-x-2">
                          {getCategoryIcon(group.category)}
                          <span>สรุปรวมเงิน{group.category} ({group.items.length} รายการ)</span>
                        </div>
                        <span className="font-mono text-sm sm:text-base text-slate-900">
                          ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                {!isInvalidDocument && (
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="w-full sm:w-auto bg-white hover:bg-slate-100 text-slate-900 font-semibold text-xs py-3 px-5 rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2 shadow-xs cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-slate-700" />
                    <span>พิมพ์ใบสรุปผล (Export PDF)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleReset}
                  className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-3 px-5 rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>ตรวจเอกสารชุดใหม่</span>
                </button>
              </div>

              <Link
                href="/admin"
                className="w-full sm:w-auto bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs py-3 px-5 rounded-xl transition flex items-center justify-center space-x-2"
              >
                <Building2 className="w-4 h-4 text-amber-400" />
                <span>เข้าสู่ระบบจัดการฐานข้อมูล Admin</span>
              </Link>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* PRINTABLE A4 AUDIT SUMMARY (VISIBLE ONLY ON PRINT: @media print)          */}
        {/* ========================================================================= */}
        {analysisResults && overallStatus !== "INVALID_DOCUMENT" && (
          <div
            id="printable-audit-summary"
            className="hidden print:block text-black bg-white w-full max-w-[210mm] mx-auto p-0 font-sans leading-normal"
          >
            {/* Header */}
            <div className="border-b-2 border-black pb-4 mb-5">
              <div className="flex justify-between items-start">
                <div>
                  <h1 className="text-xl font-bold tracking-tight uppercase text-black">
                    SUT STUDENT COUNCIL - BUDGET PRE-AUDIT SUMMARY
                  </h1>
                  <p className="text-sm font-bold text-neutral-800">
                    สภานักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี (Suranaree University of Technology Student Council)
                  </p>
                  <p className="text-xs text-neutral-600">
                    ใบสรุปรายงานผลการตรวจสอบราคากลางและหลักฐานการเบิกจ่ายงบประมาณเบื้องต้น (Pre-Audit Report)
                  </p>
                </div>
                <div className="text-right text-xs font-mono text-neutral-800 space-y-1 shrink-0 ml-4">
                  <div><span className="font-bold">เลขอ้างอิง:</span> {auditRefCode || "AUD-REF-01"}</div>
                  <div><span className="font-bold">วันที่พิมพ์:</span> {formatThaiDateTime(auditTimestamp)}</div>
                </div>
              </div>

              {/* Meta information bar */}
              <div className="mt-4 pt-3 border-t border-dashed border-neutral-300 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <span className="text-neutral-500">จำนวนรายการที่ตรวจ:</span>{" "}
                  <span className="font-bold font-mono">{totalItemsCount} รายการ</span>
                </div>
                <div>
                  <span className="text-neutral-500">สถานะภาพรวม:</span>{" "}
                  <span className="font-bold">
                    {isOverallPass
                      ? "ผ่านเกณฑ์ทั้งหมด (PASS)"
                      : isOverallHasFail
                      ? `พบปัญหา ${failItemsCount} รายการ (FAIL)`
                      : `รอดุลยพินิจ ${notFoundItemsCount} รายการ (NOT FOUND)`}
                  </span>
                </div>
                <div>
                  <span className="text-neutral-500">ไฟล์แนบ:</span>{" "}
                  <span className="font-mono truncate inline-block max-w-[180px] align-bottom">
                    {selectedFiles.map((f) => f.name).join(", ") || "-"}
                  </span>
                </div>
              </div>

              {/* Merchant / Project Details in Print */}
              {merchantInfo && (
                <div className="mt-2 pt-2 border-t border-neutral-300 grid grid-cols-3 gap-2 text-[10px]">
                  <div>
                    <span className="text-neutral-500">
                      {documentMode === "PROPOSAL" ? "โครงการ / เอกสาร:" : "ร้านค้า/ผู้ให้บริการ:"}
                    </span>{" "}
                    <span className="font-bold">
                      {documentMode === "PROPOSAL"
                        ? proposalAudit?.projectName || merchantInfo.name || "โครงการกิจกรรมนักศึกษา"
                        : merchantInfo.name || "ไม่ระบุ"}
                    </span>
                  </div>
                  <div>
                    <span className="text-neutral-500">วันที่ในเอกสาร:</span>{" "}
                    <span>{merchantInfo.date || "ไม่ระบุ"}</span>
                  </div>
                  <div>
                    <span className="text-neutral-500">ประเภทเอกสาร:</span>{" "}
                    <span className="text-black font-bold">
                      {documentMode === "PROPOSAL"
                        ? "ตารางของบประมาณโครงการ"
                        : isQuotationDoc
                        ? "ใบเสนอราคา"
                        : merchantInfo.isHandwritten
                        ? "บิลเขียนมือ"
                        : "บิลพิมพ์/POS"}
                    </span>
                  </div>
                </div>
              )}

              {/* Project Proposal Audit Summary in Print */}
              {documentMode === "PROPOSAL" && proposalAudit && (
                <div className="mt-2 p-2 border border-black bg-neutral-50 text-[10px] space-y-1">
                  <div className="flex justify-between items-center font-bold border-b border-neutral-300 pb-0.5">
                    <span>ผลการตรวจสอบตารางของบประมาณโครงการ (Project Proposal Audit):</span>
                    <span className="font-bold text-black">
                      {proposalAudit.isGrandTotalMatch && proposalAudit.isHorizontalMathCorrect
                        ? "✓ ยอดรวมและสูตรแนวนอนถูกต้อง"
                        : "✕ พบข้อผิดพลาดในการคำนวณงบประมาณ"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] leading-tight">
                    <div>1. สูตรแนวนอน (จำนวน × ราคา): {proposalAudit.isHorizontalMathCorrect ? "✓ ถูกต้องทุกรายการ" : "✕ มีรายการคำนวณผิด"}</div>
                    <div>3. งบประมาณที่ขอรับการสนับสนุน: ฿{(proposalAudit.requestedBudgetTotal || 0).toLocaleString()}</div>
                    <div>2. ผลรวม 6 หมวดงบประมาณ: {(!proposalAudit.categoryChecks || proposalAudit.categoryChecks.every((c) => c.isMatch)) ? "✓ ตรงกันทุกหมวด" : "✕ มียอดหมวดไม่ตรง"}</div>
                    <div>4. ผลรวมคำนวณจริง: ฿{(proposalAudit.calculatedGrandTotal || 0).toLocaleString()} ({proposalAudit.isGrandTotalMatch ? "✓ ตรงกับงบที่ขอ" : "✕ ไม่ตรงกับงบที่ขอ"})</div>
                  </div>
                </div>
              )}

              {/* SUT Quotation Compliance Summary in Print */}
              {documentMode === "QUOTATION" && isQuotationDoc && (
                <div className="mt-2 p-2 border border-black bg-neutral-50 text-[10px] space-y-1">
                  <div className="flex justify-between items-center font-bold border-b border-neutral-300 pb-0.5">
                    <span>ผลตรวจสอบตามระเบียบใบเสนอราคา มทส. (8 ข้อกำหนด):</span>
                    <span className={hasSutQuotationViolation ? "font-bold text-black" : "text-black"}>
                      {hasSutQuotationViolation ? "✕ ผิดระเบียบ มทส." : "✓ ครบถ้วนตามระเบียบ"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[9px] leading-tight">
                    <div>1. ลูกค้า: {customerInfo?.isSutCustomer ? "✓ มหาวิทยาลัยเทคโนโลยีสุรนารี" : `✕ ไม่ถูกต้อง (${customerInfo?.name || "-"})`}</div>
                    <div>5. ระยะเวลายืนราคา: {quotationTerms?.priceValidity ? `✓ ${quotationTerms.priceValidity}` : "✕ ไม่ระบุ"}</div>
                    <div>2. ที่อยู่: {customerInfo?.hasCorrectAddress ? "✓ 111 ถ.มหาวิทยาลัย..." : "✕ ไม่ครบถ้วน"}</div>
                    <div>6. กำหนดส่งมอบ: {quotationTerms?.deliveryTerm ? `✓ ${quotationTerms.deliveryTerm}` : "✕ ไม่ระบุ"}</div>
                    <div>3. เลขผู้เสียภาษี: {customerInfo?.hasCorrectTaxId ? "✓ 0994000288654" : `✕ ${customerInfo?.taxId || "ไม่ระบุ"}`}</div>
                    <div>7. ตัวหนังสือกำกับยอด: {quotationTerms?.hasTextAmount ? "✓ มีตัวหนังสือกำกับ" : "✕ ขาดตัวหนังสือ"}</div>
                    <div>4. โทรศัพท์: {customerInfo?.hasCorrectPhone ? "✓ 04-422-0000" : `✕ ${customerInfo?.phone || "ไม่ระบุ"}`}</div>
                    <div>8. ลายเซ็นผู้เสนอราคา: {quotationTerms?.hasQuotationSign ? "✓ พบลายเซ็น/ตรายาง" : "✕ ขาดลายเซ็น"}</div>
                  </div>
                </div>
              )}

              {/* Document Warnings Banner in Print */}
              {documentWarnings && documentWarnings.length > 0 && (
                <div className="mt-2 p-2 bg-neutral-100 border border-black text-[10px] space-y-1">
                  <span className="font-bold underline block">ข้อสังเกตความสมบูรณ์ของเอกสาร:</span>
                  <ul className="list-disc list-inside">
                    {documentWarnings.map((w, wIdx) => (
                      <li key={wIdx} className="font-semibold">{w}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Table of items */}
            <div className="mb-5">
              <table className="w-full text-left border-collapse text-[11px]">
                <thead>
                  <tr className="border-y-2 border-black bg-neutral-100 text-black font-bold uppercase">
                    <th className="py-2 px-2 text-center w-8">#</th>
                    <th className="py-2 px-2">รายการในเอกสาร / รายละเอียดการตรวจสอบ</th>
                    <th className="py-2 px-2 text-right w-28 whitespace-nowrap">จำนวน × ราคาในบิล</th>
                    <th className="py-2 px-2 text-right w-24">ราคารวมในบิล</th>
                    <th className="py-2 px-2 text-right w-24">เพดานราคากลาง</th>
                    <th className="py-2 px-2 text-center w-20">สถานะ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-300">
                  {groupedExpenseCategories.length > 0 ? (
                    groupedExpenseCategories.map((group) => (
                      <React.Fragment key={group.category}>
                        {/* Category Header Row */}
                        <tr className="bg-neutral-200 border-t-2 border-b border-black font-bold text-black">
                          <td colSpan={6} className="py-1.5 px-2 text-xs">
                            <div className="flex justify-between items-center">
                              <span className="font-bold">📁 {group.category} ({group.items.length} รายการ)</span>
                              <span className="font-mono text-[11px] font-normal">
                                ผ่าน {group.passCount} รายการ{group.failCount > 0 ? `, ตรวจสอบ ${group.failCount} รายการ` : ""}
                              </span>
                            </div>
                          </td>
                        </tr>

                        {/* Items in this Category */}
                        {group.items.map(({ item, originalIndex }) => {
                          const isPass = item.status === "PASS";
                          const isFail = item.status === "FAIL";
                          const isNotFound = item.status === "NOT_FOUND";

                          const itemName = item.receiptData?.itemName || item.itemInReceipt || "รายการที่ตรวจพบ";
                          const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
                          const receiptUnit = item.receiptData?.unit || item.unit || "หน่วย";
                          const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
                          const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);

                          const matrixName = item.matrixData?.itemName || item.matchedMatrixItem || null;
                          const matrixMaxPrice = item.matrixData?.maxPrice != null ? item.matrixData.maxPrice : (item.matrixMaxPrice != null ? item.matrixMaxPrice : null);
                          const matrixUnit = item.matrixData?.unit || null;

                          const errorFlags = Array.isArray(item.errorFlags) ? item.errorFlags : [];
                          const isUnitMismatch = !!(matrixUnit && receiptUnit && matrixUnit.trim().toLowerCase() !== receiptUnit.trim().toLowerCase());
                          const hasMatrixMax = matrixMaxPrice != null && matrixMaxPrice > 0;

                          return (
                            <tr key={originalIndex} className="align-top border-b border-neutral-200">
                              <td className="py-2 px-2 text-center font-mono">{originalIndex + 1}</td>
                              <td className="py-2 px-2">
                                <div className="font-bold text-black">{itemName}</div>
                                {matrixName && (
                                  <div className="text-[10px] text-neutral-600">
                                    (เทียบราคากลาง: {matrixName})
                                  </div>
                                )}
                                {/* Failure explanation / flags */}
                                {isFail && (
                                  <div className="mt-1 text-[10px] text-black font-semibold">
                                    <span className="underline">หมายเหตุข้อผิดพลาด:</span>{" "}
                                    {errorFlags.map((flag) => `[${flag}]`).join(" ")}
                                    {item.message && ` - ${item.message}`}
                                  </div>
                                )}
                                {isNotFound && (
                                  <div className="mt-1 text-[10px] text-neutral-700 italic">
                                    * ไม่อยู่ในฐานข้อมูลราคากลาง (ต้องใช้ดุลยพินิจของคณะกรรมการ)
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                {item.receiptData?.personCount && item.receiptData.personCount > 1 ? `${item.receiptData.personCount} คน × ` : ""}
                                {qty} {receiptUnit} × ฿{Number(unitPrice).toFixed(2)}
                                {isUnitMismatch && (
                                  <div className="text-[9px] text-neutral-600 font-sans">
                                    (หน่วยกลาง: {matrixUnit})
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-2 text-right font-mono font-semibold whitespace-nowrap">
                                ฿{Number(totalPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                                {hasMatrixMax ? (
                                  `฿${Number(matrixMaxPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })} / ${matrixUnit || receiptUnit}`
                                ) : (
                                  <span className="text-neutral-400">-</span>
                                )}
                              </td>
                              <td className="py-2 px-2 text-center font-mono">
                                <span
                                  className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border ${
                                    isPass
                                      ? "border-black bg-neutral-100 text-black"
                                      : isFail
                                      ? "border-black bg-black text-white"
                                      : "border-neutral-500 bg-neutral-200 text-black"
                                  }`}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Category Subtotal Row */}
                        <tr className="bg-neutral-100 border-b-2 border-neutral-400 font-bold text-xs">
                          <td colSpan={3} className="py-2 px-2 text-right text-neutral-800">
                            รวมเงิน{group.category} ({group.items.length} รายการ):
                          </td>
                          <td className="py-2 px-2 text-right font-mono text-black font-extrabold whitespace-nowrap">
                            ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </React.Fragment>
                    ))
                  ) : (
                    analysisResults.map((item, idx) => {
                      const isPass = item.status === "PASS";
                      const isFail = item.status === "FAIL";
                      const isNotFound = item.status === "NOT_FOUND";

                      const itemName = item.receiptData?.itemName || item.itemInReceipt || "รายการที่ตรวจพบ";
                      const qty = item.receiptData?.qty != null ? item.receiptData.qty : 1;
                      const receiptUnit = item.receiptData?.unit || item.unit || "หน่วย";
                      const unitPrice = item.receiptData?.unitPrice != null ? item.receiptData.unitPrice : (item.detectedPrice || 0);
                      const totalPrice = item.receiptData?.totalPrice != null ? item.receiptData.totalPrice : (qty * unitPrice);

                      const matrixName = item.matrixData?.itemName || item.matchedMatrixItem || null;
                      const matrixMaxPrice = item.matrixData?.maxPrice != null ? item.matrixData.maxPrice : (item.matrixMaxPrice != null ? item.matrixMaxPrice : null);
                      const matrixUnit = item.matrixData?.unit || null;

                      const errorFlags = Array.isArray(item.errorFlags) ? item.errorFlags : [];
                      const isUnitMismatch = !!(matrixUnit && receiptUnit && matrixUnit.trim().toLowerCase() !== receiptUnit.trim().toLowerCase());
                      const hasMatrixMax = matrixMaxPrice != null && matrixMaxPrice > 0;

                      return (
                        <tr key={idx} className="align-top">
                          <td className="py-2 px-2 text-center font-mono">{idx + 1}</td>
                          <td className="py-2 px-2">
                            <div className="font-bold text-black">{itemName}</div>
                            {matrixName && (
                              <div className="text-[10px] text-neutral-600">
                                (เทียบราคากลาง: {matrixName})
                              </div>
                            )}
                            {isFail && (
                              <div className="mt-1 text-[10px] text-black font-semibold">
                                <span className="underline">หมายเหตุข้อผิดพลาด:</span>{" "}
                                {errorFlags.map((flag) => `[${flag}]`).join(" ")}
                                {item.message && ` - ${item.message}`}
                              </div>
                            )}
                            {isNotFound && (
                              <div className="mt-1 text-[10px] text-neutral-700 italic">
                                * ไม่อยู่ในฐานข้อมูลราคากลาง (ต้องใช้ดุลยพินิจของคณะกรรมการ)
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            {qty} {receiptUnit} × ฿{Number(unitPrice).toFixed(2)}
                            {isUnitMismatch && (
                              <div className="text-[9px] text-neutral-600 font-sans">
                                (หน่วยกลาง: {matrixUnit})
                              </div>
                            )}
                          </td>
                          <td className="py-2 px-2 text-right font-mono font-semibold whitespace-nowrap">
                            ฿{Number(totalPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-2 text-right font-mono whitespace-nowrap">
                            {hasMatrixMax ? (
                              `฿${Number(matrixMaxPrice).toLocaleString("th-TH", { minimumFractionDigits: 2 })} / ${matrixUnit || receiptUnit}`
                            ) : (
                              <span className="text-neutral-400">-</span>
                            )}
                          </td>
                          <td className="py-2 px-2 text-center font-mono">
                            <span
                              className={`inline-block px-1.5 py-0.5 text-[10px] font-bold border ${
                                isPass
                                  ? "border-black bg-neutral-100 text-black"
                                  : isFail
                                  ? "border-black bg-black text-white"
                                  : "border-neutral-500 bg-neutral-200 text-black"
                              }`}
                            >
                              {item.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Category Breakdown Summary Box in Print */}
            {groupedExpenseCategories.length > 0 && (
              <div className="border border-black p-3 mb-4 bg-neutral-50">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-black pb-1">
                  สรุปยอดเงินแยกตามหมวดหมู่งบประมาณ 6 หมวด (Expense Category Subtotals)
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                  {groupedExpenseCategories.map((group) => (
                    <div key={group.category} className="border border-neutral-300 bg-white p-2 flex justify-between items-center">
                      <span className="font-semibold text-neutral-800">{group.category} ({group.items.length}):</span>
                      <span className="font-mono font-bold text-black whitespace-nowrap">
                        ฿{group.subtotal.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Financial Summary Breakdown */}
            <div className="border border-black p-4 mb-6 bg-neutral-50">
              <h3 className="text-xs font-bold uppercase tracking-wider mb-2 border-b border-black pb-1">
                สรุปยอดเงินสุทธิ (Financial Summary)
              </h3>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <div className="text-neutral-600 text-[11px]">ยอดรวมขอเบิกในเอกสารทั้งหมด:</div>
                  <div className="text-base font-bold font-mono">
                    ฿{totalBillAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </div>
                  {financialSummary && ((financialSummary.discount || 0) > 0 || (financialSummary.vat || 0) > 0) && (
                    <div className="text-[10px] text-neutral-600 mt-1 font-mono leading-tight">
                      (ก่อนลด ฿{(financialSummary.subtotal || calculatedItemsTotal).toFixed(2)}
                      {(financialSummary.discount || 0) > 0 && ` - ลด ฿${financialSummary.discount?.toFixed(2)}`}
                      {(financialSummary.vat || 0) > 0 && ` + VAT ฿${financialSummary.vat?.toFixed(2)}`})
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-neutral-600 text-[11px]">ยอดรวมเฉพาะรายการที่ผ่านเกณฑ์:</div>
                  <div className="text-base font-bold font-mono text-black">
                    ฿{totalPassAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <div>
                  <div className="text-neutral-600 text-[11px]">ยอดรวมรายการที่เกินเกณฑ์ / รอดุลยพินิจ:</div>
                  <div className="text-base font-bold font-mono text-black">
                    ฿{totalFailOrPendingAmount.toLocaleString("th-TH", { minimumFractionDigits: 2 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Signature Section */}
            <div className="pt-4 border-t border-neutral-300">
              <div className="grid grid-cols-2 gap-12 text-center text-xs">
                {/* Left signature */}
                <div className="space-y-3">
                  <p className="font-semibold text-neutral-800">ผู้ยื่นขออนุมัติ / ประธานโครงการ</p>
                  <div className="pt-10">
                    <p>ลงชื่อ ................................................................................</p>
                    <p className="mt-1.5">( ................................................................................ )</p>
                    <p className="mt-2 text-neutral-600">วันที่ .......... / .......... / ................</p>
                  </div>
                </div>

                {/* Right signature */}
                <div className="space-y-3">
                  <p className="font-semibold text-neutral-800">ผู้ตรวจสอบ / ตัวแทนฝ่ายงบประมาณสภานักศึกษา</p>
                  <div className="pt-10">
                    <p>ลงชื่อ ................................................................................</p>
                    <p className="mt-1.5">( ................................................................................ )</p>
                    <p className="mt-2 text-neutral-600">วันที่ .......... / .......... / ................</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Print Footer Note */}
            <div className="mt-8 pt-3 border-t border-dotted border-neutral-300 flex justify-between items-center text-[10px] text-neutral-500">
              <span>* เอกสารนี้สร้างขึ้นโดยระบบตรวจสอบราคากลางอัตโนมัติ (SUT Budget Pre-Audit System)</span>
              <span>หน้า 1 จาก 1</span>
            </div>
          </div>
        )}

        {/* Informational Footer Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-3 print:hidden">
          <div className="flex items-center space-x-2 font-bold text-slate-800">
            <AlertCircle className="w-4 h-4 text-orange-500" />
            <span>คำแนะนำเพิ่มเติมสำหรับการจัดเตรียมเอกสาร</span>
          </div>
          <ul className="list-disc pl-5 space-y-1 text-slate-500 leading-relaxed">
            <li>สามารถอัปโหลดไฟล์พร้อมกันได้หลายไฟล์ ทั้งรูปถ่ายใบเสร็จ (JPG, PNG), เอกสาร PDF และไฟล์ Excel รายการงบประมาณ</li>
            <li>ระบบใช้ Gemini AI สกัดชื่อรายการและราคาต่อหน่วย แล้วเทียบกับคอลเลกชัน <code className="text-slate-800 font-mono">price_matrix</code> อัตโนมัติ</li>
          </ul>
        </section>
      </main>

      {/* Footer Bar */}
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-auto print:hidden">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} สภานักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี (SUT Student Council)
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-500">
            <span>Pre-Audit System v2.0 (Multi-File & Excel)</span>
            <span>•</span>
            <Link href="/admin/login" className="hover:text-amber-400 transition">
              Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
