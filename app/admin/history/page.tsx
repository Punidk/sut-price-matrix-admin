"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { db, isFirebaseConfigured } from "@/lib/firebase";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import {
  ShieldCheck,
  LogOut,
  Database,
  History,
  Search,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Layers,
  Clock,
  FileText,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export interface ReceiptItemData {
  itemName: string;
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

export interface AuditScanItem {
  status: "PASS" | "FAIL" | "NOT_FOUND";
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

export interface AuditLogEntry {
  id: string;
  createdAt: number;
  itemsAnalyzed: number;
  failCount: number;
  scanResults: AuditScanItem[];
}

export default function AdminAuditHistoryPage() {
  const { user, loading: authLoading, logout, isDemoMode } = useAuth();
  const router = useRouter();

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [expandedRowIds, setExpandedRowIds] = useState<Record<string, boolean>>({});

  // 1. Authentication Check
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // 2. Real-time fetch audit_history from Firestore
  useEffect(() => {
    if (!user) return;

    if (isFirebaseConfigured && db) {
      const historyCollectionRef = collection(db, "audit_history");
      const q = query(historyCollectionRef, orderBy("createdAt", "desc"));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const list: AuditLogEntry[] = snapshot.docs.map((docSnap) => {
            const data = docSnap.data();
            let timestamp = Date.now();

            if (data.createdAt?.toMillis) {
              timestamp = data.createdAt.toMillis();
            } else if (data.createdAt instanceof Date) {
              timestamp = data.createdAt.getTime();
            } else if (typeof data.createdAt === "number") {
              timestamp = data.createdAt;
            }

            return {
              id: docSnap.id,
              createdAt: timestamp,
              itemsAnalyzed: Number(data.itemsAnalyzed) || (Array.isArray(data.scanResults) ? data.scanResults.length : 0),
              failCount: Number(data.failCount) || 0,
              scanResults: Array.isArray(data.scanResults) ? data.scanResults : [],
            };
          });

          setLogs(list);
          setDataLoading(false);
        },
        (error) => {
          console.error("Firestore audit_history snapshot error:", error);
          setDataLoading(false);
        }
      );

      return () => unsubscribe();
    } else {
      setDataLoading(false);
    }
  }, [user]);

  // Toggle single row expand
  const toggleRow = (id: string) => {
    setExpandedRowIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  // Toggle expand all
  const toggleExpandAll = () => {
    if (Object.keys(expandedRowIds).length === filteredLogs.length && Object.values(expandedRowIds).every(Boolean)) {
      setExpandedRowIds({});
    } else {
      const all: Record<string, boolean> = {};
      filteredLogs.forEach((l) => {
        all[l.id] = true;
      });
      setExpandedRowIds(all);
    }
  };

  // Format Date to Thai string
  const formatThaiDateTime = (timestamp: number) => {
    if (!timestamp) return "-";
    const date = new Date(timestamp);
    return date.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  // Filtered logs based on Search & Only Issues toggle
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Filter only issues
      if (onlyIssues && log.failCount === 0) {
        return false;
      }

      // 2. Search filter
      if (!searchQuery.trim()) return true;
      const queryLower = searchQuery.toLowerCase().trim();
      const dateStr = formatThaiDateTime(log.createdAt).toLowerCase();

      if (dateStr.includes(queryLower) || log.id.toLowerCase().includes(queryLower)) {
        return true;
      }

      // Search inside scan results item names
      return log.scanResults.some(
        (item) =>
          item.itemInReceipt?.toLowerCase().includes(queryLower) ||
          item.matchedMatrixItem?.toLowerCase().includes(queryLower) ||
          item.message?.toLowerCase().includes(queryLower)
      );
    });
  }, [logs, onlyIssues, searchQuery]);

  // Stats calculation
  const totalScans = logs.length;
  const totalItemsCount = logs.reduce((acc, curr) => acc + curr.itemsAnalyzed, 0);
  const totalIssuesCount = logs.filter((l) => l.failCount > 0).length;
  const totalPassedCount = logs.filter((l) => l.failCount === 0).length;

  if (authLoading || (!user && authLoading)) {
    return (
      <div className="min-h-screen bg-neutral-950 text-neutral-400 flex items-center justify-center font-mono text-sm">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-white" />
        LOADING SYSTEM...
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans selection:bg-white selection:text-black">
      {/* Navbar Header (Monochrome) */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-white text-black font-bold flex items-center justify-center text-lg rounded-none">
              <ShieldCheck className="w-5 h-5 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h1 className="text-sm sm:text-base font-bold font-mono tracking-tight text-white uppercase">
                  SUT CENTRAL PRICE MATRIX
                </h1>
                {isDemoMode && (
                  <span className="bg-neutral-800 border border-neutral-700 text-neutral-300 text-[10px] font-mono px-2 py-0.5 uppercase">
                    DEMO MODE
                  </span>
                )}
              </div>
              <p className="text-[11px] text-neutral-400 font-mono hidden sm:block">
                Firestore Collection: <code className="text-white">audit_history</code>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Navigation Tabs */}
            <nav className="hidden sm:flex items-center space-x-1">
              <Link
                href="/admin"
                className="px-3 py-1.5 text-xs font-mono font-medium transition flex items-center space-x-1.5 border bg-neutral-950 text-neutral-400 border-neutral-800 hover:text-white hover:border-neutral-700"
              >
                <Database className="w-3.5 h-3.5" />
                <span>จัดการราคากลาง</span>
              </Link>
              <Link
                href="/admin/history"
                className="px-3 py-1.5 text-xs font-mono font-medium transition flex items-center space-x-1.5 border bg-white text-black border-white"
              >
                <History className="w-3.5 h-3.5" />
                <span>ประวัติการตรวจสอบ</span>
              </Link>
            </nav>

            <div className="h-6 w-px bg-neutral-800 hidden sm:block"></div>

            <div className="hidden md:flex flex-col items-end text-xs font-mono">
              <span className="text-neutral-500">ADMIN USER</span>
              <span className="text-white font-semibold truncate max-w-[200px]">
                {user.email || "Admin User"}
              </span>
            </div>
            <div className="h-6 w-px bg-neutral-800 hidden md:block"></div>
            <button
              onClick={logout}
              className="bg-neutral-950 hover:bg-neutral-800 text-neutral-300 hover:text-white text-xs font-mono py-2 px-3 border border-neutral-800 hover:border-neutral-700 transition flex items-center space-x-2 rounded-none group"
            >
              <LogOut className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span>LOGOUT</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        
        {/* Title Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
              SUT STUDENT COUNCIL / AUDIT LOGS
            </div>
            <h2 className="text-2xl font-bold font-mono tracking-tight text-white uppercase mt-1">
              ประวัติการตรวจสอบราคากลาง
            </h2>
            <p className="text-xs text-neutral-400 font-mono mt-1">
              บันทึกรายการผลการวิเคราะห์เอกสารใบเสร็จ & งบประมาณที่ส่งเข้ามาตรวจสอบทั้งหมด
            </p>
          </div>

          {/* Quick Mobile Navigation Bar */}
          <div className="flex sm:hidden items-center space-x-2 border border-neutral-800 bg-neutral-900 p-1">
            <Link
              href="/admin"
              className="flex-1 py-1.5 text-center text-xs font-mono text-neutral-400"
            >
              จัดการราคากลาง
            </Link>
            <Link
              href="/admin/history"
              className="flex-1 py-1.5 text-center text-xs font-mono bg-white text-black font-semibold"
            >
              ประวัติการตรวจสอบ
            </Link>
          </div>
        </div>

        {/* Stats Overview Grid (Minimalist Monochrome) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase">สแกนทั้งหมด</span>
            <div className="text-2xl font-bold font-mono text-white">{totalScans} <span className="text-xs font-normal text-neutral-400">ครั้ง</span></div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase">รายการที่ตรวจทั้งหมด</span>
            <div className="text-2xl font-bold font-mono text-white">{totalItemsCount} <span className="text-xs font-normal text-neutral-400">รายการ</span></div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase">พบปัญหา / เกินเกณฑ์</span>
            <div className="text-2xl font-bold font-mono text-rose-400">{totalIssuesCount} <span className="text-xs font-normal text-neutral-400">ครั้ง</span></div>
          </div>
          <div className="bg-neutral-900 border border-neutral-800 p-4 space-y-1">
            <span className="text-[11px] font-mono text-neutral-500 uppercase">ผ่านเกณฑ์สมบูรณ์</span>
            <div className="text-2xl font-bold font-mono text-emerald-400">{totalPassedCount} <span className="text-xs font-normal text-neutral-400">ครั้ง</span></div>
          </div>
        </div>

        {/* Search & Filter Controls Bar */}
        <div className="bg-neutral-900 border border-neutral-800 p-4 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ค้นหาตามวันที่, ชื่อรายการสินค้า หรือผลการวิเคราะห์..."
              className="w-full bg-neutral-950 border border-neutral-800 text-white pl-10 pr-4 py-2.5 text-xs font-mono focus:outline-none focus:border-white transition rounded-none placeholder:text-neutral-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter: Only Issues Toggle */}
            <label className="flex items-center space-x-2.5 bg-neutral-950 border border-neutral-800 px-3.5 py-2.5 cursor-pointer hover:border-neutral-700 transition select-none">
              <input
                type="checkbox"
                checked={onlyIssues}
                onChange={(e) => setOnlyIssues(e.target.checked)}
                className="w-4 h-4 rounded-none accent-white cursor-pointer"
              />
              <span className="text-xs font-mono text-neutral-300">
                แสดงเฉพาะรายการที่มีปัญหา ({totalIssuesCount})
              </span>
            </label>

            {/* Expand / Collapse All Button */}
            {filteredLogs.length > 0 && (
              <button
                type="button"
                onClick={toggleExpandAll}
                className="bg-neutral-950 hover:bg-neutral-800 border border-neutral-800 text-neutral-300 text-xs font-mono py-2.5 px-3.5 transition flex items-center space-x-1.5"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>
                  {Object.keys(expandedRowIds).length === filteredLogs.length && Object.values(expandedRowIds).every(Boolean)
                    ? "ย่อรายละเอียดทั้งหมด"
                    : "กางรายละเอียดทั้งหมด"}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Data Table */}
        <div className="bg-neutral-900 border border-neutral-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-neutral-800 bg-neutral-950 text-neutral-400 font-mono uppercase text-[11px]">
                  <th className="py-3.5 px-4 w-12 text-center">#</th>
                  <th className="py-3.5 px-4 w-48">วันที่ / เวลา</th>
                  <th className="py-3.5 px-4 w-36 text-center">จำนวนที่ตรวจ</th>
                  <th className="py-3.5 px-4 w-48 text-center">สถานะภาพรวม</th>
                  <th className="py-3.5 px-4">ตัวอย่างรายการในบิล</th>
                  <th className="py-3.5 px-4 w-28 text-center">การกระทำ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/80">
                {dataLoading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-mono text-neutral-500">
                      <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-white" />
                      กำลังดึงข้อมูลประวัติการตรวจสอบจาก Firestore...
                    </td>
                  </tr>
                ) : filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-mono text-neutral-500 space-y-2">
                      <History className="w-6 h-6 mx-auto text-neutral-600" />
                      <div>ไม่พบประวัติการตรวจสอบราคากลาง</div>
                      {onlyIssues && (
                        <div className="text-[11px] text-neutral-600">
                          (ลองปลดตัวกรอง "แสดงเฉพาะรายการที่มีปัญหา" เพื่อดูรายการทั้งหมด)
                        </div>
                      )}
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log, idx) => {
                    const isExpanded = !!expandedRowIds[log.id];
                    const hasIssues = log.failCount > 0;
                    const passCount = log.itemsAnalyzed - log.failCount;

                    return (
                      <React.Fragment key={log.id}>
                        {/* Summary Main Row */}
                        <tr
                          onClick={() => toggleRow(log.id)}
                          className={`hover:bg-neutral-850/70 transition cursor-pointer font-sans ${
                            isExpanded ? "bg-neutral-850/50" : ""
                          }`}
                        >
                          <td className="py-4 px-4 text-center font-mono text-neutral-500">
                            {idx + 1}
                          </td>
                          <td className="py-4 px-4 font-mono text-white whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <Clock className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                              <span>{formatThaiDateTime(log.createdAt)}</span>
                            </div>
                          </td>
                          <td className="py-4 px-4 text-center font-mono text-white">
                            <span className="bg-neutral-950 border border-neutral-800 px-2 py-0.5">
                              {log.itemsAnalyzed} รายการ
                            </span>
                          </td>
                          <td className="py-4 px-4 text-center">
                            {hasIssues ? (
                              <span className="inline-flex items-center space-x-1 border border-rose-600/80 bg-rose-950/60 text-rose-300 text-[11px] font-mono px-2.5 py-1">
                                <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                                <span>พบปัญหา {log.failCount} รายการ</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center space-x-1 border border-emerald-500/60 bg-emerald-950/60 text-emerald-300 text-[11px] font-mono px-2.5 py-1">
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                                <span>ผ่านเกณฑ์ทั้งหมด</span>
                              </span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-neutral-300 max-w-xs truncate">
                            {log.scanResults && log.scanResults.length > 0 ? (
                              <span className="text-neutral-400 text-xs truncate block" title={log.scanResults.map((s) => s.itemInReceipt).join(", ")}>
                                {log.scanResults.map((s) => s.itemInReceipt).slice(0, 3).join(", ")}
                                {log.scanResults.length > 3 && ` และอีก ${log.scanResults.length - 3} รายการ...`}
                              </span>
                            ) : (
                              <span className="text-neutral-600 font-mono">-</span>
                            )}
                          </td>
                          <td className="py-4 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={() => toggleRow(log.id)}
                              className="inline-flex items-center space-x-1 text-[11px] font-mono bg-neutral-950 hover:bg-neutral-800 text-neutral-300 border border-neutral-800 hover:border-neutral-700 px-2.5 py-1 transition"
                            >
                              <span>{isExpanded ? "ย่อ" : "ดูผล"}</span>
                              {isExpanded ? (
                                <ChevronUp className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronDown className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </td>
                        </tr>

                        {/* Collapsible Detail Section (Expanded Row) */}
                        {isExpanded && (
                          <tr className="bg-neutral-950 border-y border-neutral-800">
                            <td colSpan={6} className="p-4 sm:p-6 space-y-4">
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-neutral-800 gap-2 font-mono text-xs">
                                <div className="flex items-center space-x-2 text-neutral-300">
                                  <FileText className="w-4 h-4 text-white" />
                                  <span className="font-bold text-white uppercase">
                                    รายละเอียดการตรวจสอบ ({log.itemsAnalyzed} รายการ)
                                  </span>
                                  <span className="text-neutral-500">| Doc ID: {log.id}</span>
                                </div>
                                <div className="flex items-center space-x-3 text-[11px]">
                                  <span className="text-emerald-400">ผ่าน: {passCount}</span>
                                  <span className="text-rose-400">ไม่ผ่าน/ไม่อยู่ในฐาน: {log.failCount}</span>
                                </div>
                              </div>

                              {/* Items List Inside Log */}
                              <div className="grid grid-cols-1 gap-3">
                                {log.scanResults && log.scanResults.length > 0 ? (
                                  log.scanResults.map((item, itemIdx) => {
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
                                    const isMathError = Math.abs(qty * unitPrice - totalPrice) > 0.01;

                                    const hasMax = matrixMaxPrice != null && matrixMaxPrice > 0;
                                    const diff = hasMax ? unitPrice - matrixMaxPrice : 0;

                                    return (
                                      <div
                                        key={itemIdx}
                                        className={`bg-neutral-900 border p-4 space-y-3.5 ${
                                          isPass
                                            ? "border-neutral-800 hover:border-emerald-800/60"
                                            : isFail
                                            ? "border-rose-800/80 bg-rose-950/20 hover:border-rose-700"
                                            : "border-amber-800/80 bg-amber-950/20 hover:border-amber-700"
                                        }`}
                                      >
                                        {/* Item Header */}
                                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5 pb-2.5 border-b border-neutral-800">
                                          <div className="flex items-start space-x-2.5">
                                            <div className={`p-1.5 shrink-0 mt-0.5 ${
                                              isPass
                                                ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                                                : isFail
                                                ? "bg-rose-950 text-rose-400 border border-rose-800"
                                                : "bg-amber-950 text-amber-400 border border-amber-800"
                                            }`}>
                                              {isPass ? (
                                                <CheckCircle2 className="w-4 h-4" />
                                              ) : isFail ? (
                                                <XCircle className="w-4 h-4" />
                                              ) : (
                                                <AlertTriangle className="w-4 h-4" />
                                              )}
                                            </div>
                                            <div className="space-y-0.5">
                                              <span className="text-[10px] font-mono text-neutral-500">
                                                รายการที่ {itemIdx + 1}
                                              </span>
                                              <h5 className="text-sm font-bold text-white">
                                                {itemName}
                                              </h5>
                                              {matrixName && (
                                                <div className="text-[11px] text-neutral-400 font-mono flex items-center space-x-1.5">
                                                  <span>จับคู่ราคากลาง:</span>
                                                  <span className="bg-neutral-950 border border-neutral-800 text-neutral-200 px-1.5 py-0.2">{matrixName}</span>
                                                </div>
                                              )}
                                            </div>
                                          </div>

                                          <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-auto justify-end">
                                            {/* Specific Error Flags */}
                                            {isFail && errorFlags.map((flag, fIdx) => (
                                              <span
                                                key={fIdx}
                                                className="text-[10px] font-mono font-bold px-2 py-0.5 bg-rose-600 text-white"
                                              >
                                                [{flag}]
                                              </span>
                                            ))}
                                            <span
                                              className={`text-xs font-mono font-bold px-2.5 py-0.5 border ${
                                                isPass
                                                  ? "bg-emerald-950/80 text-emerald-300 border-emerald-600"
                                                  : isFail
                                                  ? "bg-rose-950/80 text-rose-300 border-rose-600"
                                                  : "bg-amber-950/80 text-amber-300 border-amber-600"
                                              }`}
                                            >
                                              {isNotFound ? "NOT FOUND" : item.status}
                                            </span>
                                          </div>
                                        </div>

                                        {/* Warning Notice if NOT_FOUND */}
                                        {isNotFound && (
                                          <div className="bg-amber-950/60 border border-amber-700/80 p-2.5 text-xs text-amber-200 flex items-start space-x-2 font-mono">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                            <span>
                                              รายการนี้ไม่อยู่ในราคากลาง ต้องตรวจสอบด้วยดุลยพินิจของคณะกรรมการ
                                            </span>
                                          </div>
                                        )}

                                        {/* Breakdown calculation box */}
                                        <div className="bg-neutral-950 border border-neutral-800 p-3 space-y-1.5 text-xs font-mono">
                                          <div className="flex flex-wrap items-center justify-between gap-2 text-neutral-300">
                                            <div className="flex items-center space-x-2">
                                              <span className="text-neutral-500">จำนวน & ราคาในบิล:</span>
                                              <span className="text-white bg-neutral-900 border border-neutral-700 px-2 py-0.5">
                                                {qty}{" "}
                                                {isUnitMismatch ? (
                                                  <span className="bg-rose-950 text-rose-300 border border-rose-600 px-1 py-0.2 font-bold underline decoration-rose-500">
                                                    {receiptUnit}
                                                  </span>
                                                ) : (
                                                  receiptUnit
                                                )}{" "}
                                                × ฿{Number(unitPrice).toFixed(2)}
                                              </span>
                                            </div>
                                            <div className="text-white font-bold">
                                              ราคารวมในบิล: ฿{Number(totalPrice).toFixed(2)}
                                            </div>
                                          </div>

                                          {/* Math Error Alert */}
                                          {(isMathError || errorFlags.includes("คำนวณเลขผิด")) && (
                                            <div className="bg-rose-950/80 border border-rose-600 text-rose-200 p-2 text-[11px] flex items-start space-x-2">
                                              <AlertTriangle className="w-3.5 h-3.5 text-rose-400 shrink-0 mt-0.5" />
                                              <div>
                                                <span className="font-bold text-rose-100">[คำนวณเลขผิด]: </span>
                                                คำนวณจริง ({qty} × ฿{Number(unitPrice).toFixed(2)} = ฿{(qty * unitPrice).toFixed(2)}) แต่ระบุในบิลเป็น ฿{Number(totalPrice).toFixed(2)}
                                              </div>
                                            </div>
                                          )}

                                          {/* Unit Mismatch Alert */}
                                          {isUnitMismatch && (
                                            <div className="bg-amber-950/80 border border-amber-600 text-amber-200 p-2 text-[11px] flex items-start space-x-2">
                                              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                                              <div>
                                                <span className="font-bold text-amber-100">[หน่วยนับไม่ตรง]: </span>
                                                ในบิลระบุหน่วย <span className="bg-rose-900 px-1 text-white">{receiptUnit}</span> แต่เพดานราคากลางกำหนดหน่วยเป็น <span className="bg-amber-900 px-1 text-white">{matrixUnit}</span>
                                              </div>
                                            </div>
                                          )}
                                        </div>

                                        {/* Pricing Comparison Grid */}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-neutral-950 p-3 border border-neutral-800 font-mono text-xs">
                                          <div className="space-y-0.5">
                                            <span className="text-neutral-500 text-[11px]">ราคาต่อหน่วยในบิล:</span>
                                            <div className="text-sm font-bold text-white">
                                              ฿{Number(unitPrice).toFixed(2)}{" "}
                                              <span className="text-xs text-neutral-400 font-normal">
                                                /{" "}
                                                {isUnitMismatch ? (
                                                  <span className="bg-rose-950 text-rose-300 border border-rose-600 px-1 font-bold">
                                                    {receiptUnit}
                                                  </span>
                                                ) : (
                                                  receiptUnit
                                                )}
                                              </span>
                                            </div>
                                          </div>

                                          <div className="space-y-0.5">
                                            <span className="text-neutral-500 text-[11px]">เพดานราคากลาง:</span>
                                            <div className="text-sm font-bold text-amber-400">
                                              {hasMax ? (
                                                <>
                                                  ฿{Number(matrixMaxPrice).toFixed(2)}{" "}
                                                  <span className="text-xs text-neutral-400 font-normal">
                                                    /{" "}
                                                    {isUnitMismatch ? (
                                                      <span className="bg-amber-950 text-amber-300 border border-amber-600 px-1 font-bold">
                                                        {matrixUnit}
                                                      </span>
                                                    ) : (
                                                      matrixUnit || receiptUnit
                                                    )}
                                                  </span>
                                                </>
                                              ) : (
                                                <span className="text-xs text-neutral-500 font-normal">ไม่มีในฐานราคากลาง</span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="space-y-0.5">
                                            <span className="text-neutral-500 text-[11px]">ส่วนต่างราคาต่อหน่วย:</span>
                                            {isNotFound ? (
                                              <div className="text-xs text-amber-400">รอการพิจารณา</div>
                                            ) : (
                                              <div className={`text-sm font-bold flex items-center space-x-1 ${
                                                diff <= 0 ? "text-emerald-400" : "text-rose-400"
                                              }`}>
                                                {diff <= 0 ? (
                                                  <>
                                                    <TrendingDown className="w-3.5 h-3.5" />
                                                    <span>ประหยัด ฿{Math.abs(diff).toFixed(2)}</span>
                                                  </>
                                                ) : (
                                                  <>
                                                    <TrendingUp className="w-3.5 h-3.5" />
                                                    <span>เกินเกณฑ์ ฿{Math.abs(diff).toFixed(2)}</span>
                                                  </>
                                                )}
                                              </div>
                                            )}
                                          </div>
                                        </div>

                                        {/* Explanation Note */}
                                        <div className="text-xs text-neutral-300 font-sans leading-relaxed bg-neutral-950/60 p-2.5 border border-neutral-800">
                                          <span className="font-semibold text-white font-mono text-[11px]">ผลการวิเคราะห์: </span>
                                          {item.message}
                                        </div>
                                      </div>
                                    );
                                  })
                                ) : (
                                  <div className="text-neutral-500 font-mono text-xs text-center py-4">
                                    ไม่มีรายการบันทึกเพิ่มเติม
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Minimalist Footer */}
      <footer className="bg-neutral-900 border-t border-neutral-800 text-neutral-500 text-xs py-6 font-mono mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div>
            © {new Date().getFullYear()} SUT STUDENT COUNCIL — AUDIT LOG SYSTEM
          </div>
          <div className="flex items-center space-x-4 text-[11px]">
            <Link href="/" className="hover:text-white transition">
              หน้าสแกน User
            </Link>
            <span>•</span>
            <Link href="/admin" className="hover:text-white transition">
              จัดการราคากลาง
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
