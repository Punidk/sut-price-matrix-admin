"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { PriceMatrixItem } from "@/lib/types";
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
} from "lucide-react";

export interface AnalysisItemResult {
  status: "PASS" | "FAIL" | "NOT_FOUND";
  message: string;
  itemInReceipt: string;
  matchedMatrixItem?: string | null;
  detectedPrice: number;
  matrixMaxPrice?: number | null;
  unit: string;
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

  // AI Analysis Results state (Array of items)
  const [analysisResults, setAnalysisResults] = useState<AnalysisItemResult[] | null>(null);

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

  // Sample file preview simulation
  const handleSelectSample = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 500;
    canvas.height = 350;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#ea580c";
      ctx.fillRect(0, 0, 500, 350);
      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 22px sans-serif";
      ctx.fillText("ใบเสนอราคาโครงการกิจกรรมนักศึกษา มทส.", 30, 80);
      ctx.font = "16px sans-serif";
      ctx.fillText("1. ข้าวกล่อง (กระเพราไก่ไข่ดาว) - 45 บาท/กล่อง", 30, 140);
      ctx.fillText("2. น้ำดื่มขวด 600ml - 7 บาท/ขวด", 30, 180);
      ctx.fillText("3. ป้ายไวนิลโครงการ 1x3m - 350 บาท/ผืน", 30, 220);
    }

    canvas.toBlob((blob) => {
      if (blob) {
        const sampleFile = new File([blob], "ใบเสนอราคา_กิจกรรมนักศึกษา_มทส.jpg", { type: "image/jpeg" });
        addFiles([sampleFile]);
      }
    }, "image/jpeg");
  };

  // Clear selected files & reset state
  const handleReset = () => {
    setSelectedFiles([]);
    setAnalysisResults(null);
    setUploadError(null);
    setIsProcessing(false);
    setProcessingStep(0);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  // Multiple Files Analysis Handler
  const handleStartAudit = async () => {
    if (selectedFiles.length === 0) return;

    setIsProcessing(true);
    setProcessingStep(1); // 1. กำลังประมวลผลไฟล์ (แปลงภาพ/PDF เป็น Base64 และอ่าน Excel)...
    setUploadError(null);
    setAnalysisResults(null);

    try {
      const payloadFiles: Array<{ mimeType: string; base64Data: string }> = [];
      let combinedExcelText = "";

      for (const item of selectedFiles) {
        if (item.type === "image" || item.type === "pdf") {
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
        }),
      });

      if (!aiRes.ok) {
        const errorJson = await aiRes.json().catch(() => ({}));
        throw new Error(errorJson.details || errorJson.error || `AI API returned status ${aiRes.status}`);
      }

      const data = await aiRes.json();
      const results: AnalysisItemResult[] = Array.isArray(data) ? data : [data];

      // บันทึกประวัติการตรวจสอบลง Firestore collection `audit_history`
      if (isFirebaseConfigured && db) {
        const failCount = results.filter(
          (item) => item.status === "FAIL" || item.status === "NOT_FOUND"
        ).length;

        addDoc(collection(db, "audit_history"), {
          createdAt: serverTimestamp(),
          itemsAnalyzed: results.length,
          failCount: failCount,
          scanResults: results,
        }).catch((err) => {
          console.warn("Error saving audit_history:", err);
        });
      }

      setProcessingStep(3); // 3. สรุปผลการตรวจสอบอนุมัติ...
      await new Promise((r) => setTimeout(r, 400));

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
  const isOverallPass = totalItemsCount > 0 && failItemsCount === 0 && notFoundItemsCount === 0;
  const isOverallHasFail = failItemsCount > 0;
  const isOverallPendingReview = totalItemsCount > 0 && failItemsCount === 0 && notFoundItemsCount > 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans selection:bg-orange-500 selection:text-white">
      {/* Header Bar (Orange & Amber SUT Identity) */}
      <header className="bg-gradient-to-r from-orange-600 via-orange-500 to-amber-500 text-white shadow-md sticky top-0 z-50">
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
                ระบบตรวจสอบราคากลางงบประมาณสโมสรนักศึกษา มทส.
              </p>
            </div>
          </div>

          <Link
            href="/login"
            className="bg-white/10 hover:bg-white/20 border border-white/30 text-white text-xs font-mono py-2 px-3.5 rounded-lg transition flex items-center space-x-1.5 backdrop-blur-xs"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>เข้าสู่ระบบ Admin</span>
          </Link>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-8 space-y-8">
        
        {/* Banner Section */}
        <section className="bg-gradient-to-br from-orange-50 to-amber-50 border border-orange-200/80 rounded-2xl p-6 sm:p-8 shadow-xs relative overflow-hidden">
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
              ของสโมสรนักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี
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
                    {processingStep === 1 && "กำลังเตรียมข้อมูลไฟล์ (แปลงรูปภาพ/PDF เป็น Base64 & อ่าน Excel)..."}
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
                    <span>กำลังวิเคราะห์เอกสาร...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-5 h-5 text-amber-200 group-hover:rotate-12 transition-transform" />
                    <span>เริ่มตรวจสอบราคากลางด้วย Gemini AI ({selectedFiles.length} ไฟล์)</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Real Gemini AI Analysis Results Display (Multiple Items List) */}
        {analysisResults && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            
            {/* Overall Summary Card */}
            <div className={`rounded-2xl border-2 overflow-hidden shadow-lg ${
              isOverallPass
                ? "border-emerald-500 bg-white"
                : isOverallHasFail
                ? "border-rose-500 bg-white"
                : "border-amber-400 bg-white"
            }`}>
              <div className={`p-6 sm:p-8 text-white flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-gradient-to-r ${
                isOverallPass
                  ? "from-emerald-600 via-teal-600 to-emerald-700"
                  : isOverallHasFail
                  ? "from-rose-600 via-red-600 to-rose-700"
                  : "from-amber-500 via-orange-500 to-amber-600"
              }`}>
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-white/15 backdrop-blur-md rounded-2xl flex items-center justify-center text-white shrink-0 shadow-inner">
                    {isOverallPass ? (
                      <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
                    ) : isOverallHasFail ? (
                      <XCircle className="w-9 h-9 stroke-[2.2]" />
                    ) : (
                      <AlertTriangle className="w-9 h-9 stroke-[2.2]" />
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="inline-block bg-white/20 text-white text-xs font-mono px-2.5 py-0.5 rounded-full font-semibold">
                      ภาพรวม: {isOverallPass
                        ? "ทุกรายการผ่านเกณฑ์"
                        : isOverallHasFail
                        ? "พบรายการที่ไม่ผ่านเกณฑ์"
                        : "มีรายการต้องใช้ดุลยพินิจ"}
                    </div>
                    <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                      {isOverallPass
                        ? "ผ่านการตรวจสอบราคากลางทั้งหมด"
                        : isOverallHasFail
                        ? `พบ ${failItemsCount} รายการที่เกินเพดานราคากลาง`
                        : `พบ ${notFoundItemsCount} รายการที่ไม่อยู่ในฐานข้อมูลราคากลาง`}
                    </h3>
                    <p className="text-xs sm:text-sm text-white/90">
                      ตรวจพบทั้งหมด {totalItemsCount} รายการ (ผ่าน {passItemsCount} รายการ
                      {failItemsCount > 0 && `, ไม่ผ่าน ${failItemsCount} รายการ`}
                      {notFoundItemsCount > 0 && `, ไม่อยู่ในฐานข้อมูล ${notFoundItemsCount} รายการ`})
                    </p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 self-stretch sm:self-auto justify-end">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="bg-white/20 hover:bg-white/30 text-white text-xs font-semibold py-2.5 px-4 rounded-xl backdrop-blur-xs transition flex items-center space-x-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>ตรวจเอกสารชุดใหม่</span>
                  </button>
                </div>
              </div>
            </div>

            {/* List of Detected Items */}
            <div className="space-y-4">
              <div className="flex items-center justify-between px-1">
                <h4 className="text-base font-bold text-slate-900 flex items-center space-x-2">
                  <Layers className="w-5 h-5 text-orange-600" />
                  <span>รายละเอียดผลการตรวจสอบแต่ละรายการ ({totalItemsCount})</span>
                </h4>
              </div>

              <div className="grid grid-cols-1 gap-4">
                {analysisResults.map((item, idx) => {
                  const isPass = item.status === "PASS";
                  const isFail = item.status === "FAIL";
                  const isNotFound = item.status === "NOT_FOUND";
                  const hasMatrixMax = item.matrixMaxPrice != null && item.matrixMaxPrice > 0;
                  const priceDiff = hasMatrixMax ? item.detectedPrice - (item.matrixMaxPrice as number) : 0;

                  return (
                    <div
                      key={idx}
                      className={`bg-white border-2 rounded-2xl p-5 sm:p-6 shadow-sm transition space-y-4 ${
                        isPass
                          ? "border-emerald-200 hover:border-emerald-400"
                          : isFail
                          ? "border-rose-200 hover:border-rose-400"
                          : "border-amber-300 bg-amber-50/30 hover:border-amber-400"
                      }`}
                    >
                      {/* Item Header */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-xl shrink-0 ${
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
                          <div>
                            <span className="text-[11px] font-mono text-slate-400">รายการที่ {idx + 1}</span>
                            <h5 className="text-base font-bold text-slate-900">
                              {item.itemInReceipt || "รายการที่ตรวจพบ"}
                            </h5>
                          </div>
                        </div>

                        <div className="flex items-center space-x-2">
                          {item.matchedMatrixItem && (
                            <span className="text-xs bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg font-mono">
                              จับคู่: {item.matchedMatrixItem}
                            </span>
                          )}
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

                      {/* Pricing Comparison Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs">
                        <div className="space-y-1">
                          <span className="text-slate-500">ราคาเสนอในเอกสาร:</span>
                          <div className="text-base font-extrabold text-slate-900 font-mono">
                            ฿{Number(item.detectedPrice).toFixed(2)}{" "}
                            <span className="text-xs font-normal text-slate-500">{item.unit || "หน่วย"}</span>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-500">เพดานราคากลางสูงสุด:</span>
                          <div className="text-base font-extrabold font-mono text-amber-600">
                            {hasMatrixMax ? (
                              <>
                                ฿{Number(item.matrixMaxPrice).toFixed(2)}{" "}
                                <span className="text-xs font-normal text-slate-500">{item.unit || "หน่วย"}</span>
                              </>
                            ) : (
                              <span className="text-xs text-slate-400 font-sans font-normal">ไม่มีในฐานราคากลาง</span>
                            )}
                          </div>
                        </div>

                        <div className="space-y-1">
                          <span className="text-slate-500">ส่วนต่างราคา:</span>
                          {isNotFound ? (
                            <div className="text-xs font-semibold text-amber-800 flex items-center space-x-1 mt-0.5">
                              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                              <span>รอการพิจารณา</span>
                            </div>
                          ) : (
                            <div className={`text-base font-extrabold font-mono flex items-center space-x-1 ${
                              isPass ? "text-emerald-600" : "text-rose-600"
                            }`}>
                              {isPass ? (
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
                      <div className="text-xs text-slate-600 bg-white p-3 rounded-lg border border-slate-200/80 leading-relaxed">
                        <span className="font-semibold text-slate-800">ผลการวิเคราะห์: </span>
                        {item.message}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="bg-white border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm">
              <button
                type="button"
                onClick={handleReset}
                className="w-full sm:w-auto bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs py-3 px-5 rounded-xl border border-slate-300 transition flex items-center justify-center space-x-2"
              >
                <RefreshCw className="w-4 h-4" />
                <span>สแกนตรวจสอบเอกสารชุดอื่น</span>
              </button>

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

        {/* Informational Footer Section */}
        <section className="bg-white border border-slate-200 rounded-2xl p-6 text-xs text-slate-600 space-y-3">
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
      <footer className="bg-slate-900 text-slate-400 text-xs py-6 border-t border-slate-800 mt-auto">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
          <div>
            © {new Date().getFullYear()} สโมสรนักศึกษา มหาวิทยาลัยเทคโนโลยีสุรนารี (SUT Student Council)
          </div>
          <div className="flex items-center space-x-4 font-mono text-[11px] text-slate-500">
            <span>Pre-Audit System v2.0 (Multi-File & Excel)</span>
            <span>•</span>
            <Link href="/login" className="hover:text-amber-400 transition">
              Admin Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
