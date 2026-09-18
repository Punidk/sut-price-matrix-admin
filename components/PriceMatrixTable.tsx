"use client";

import React, { useState, useMemo } from "react";
import { PriceMatrixItem, SUT_EXPENSE_CATEGORIES, normalizeExpenseCategory } from "@/lib/types";
import {
  Search,
  Edit2,
  Trash2,
  Plus,
  Filter,
  ArrowUpDown,
  Coins,
  Utensils,
  Car,
  Hammer,
  Paperclip,
  Cpu,
  Grid,
} from "lucide-react";

interface PriceMatrixTableProps {
  items: PriceMatrixItem[];
  onAddNew: () => void;
  onEdit: (item: PriceMatrixItem) => void;
  onDelete: (item: PriceMatrixItem) => void;
  loading?: boolean;
}

const FILTER_CATEGORIES = [
  "ทั้งหมด",
  ...SUT_EXPENSE_CATEGORIES,
];

export default function PriceMatrixTable({
  items,
  onAddNew,
  onEdit,
  onDelete,
  loading = false,
}: PriceMatrixTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("ทั้งหมด");
  const [sortField, setSortField] = useState<"itemName" | "maxPrice" | "category">("itemName");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  const filteredItems = useMemo(() => {
    return items
      .filter((item) => {
        const matchesSearch = item.itemName
          .toLowerCase()
          .includes(searchTerm.toLowerCase().trim());
        const normalizedItemCat = normalizeExpenseCategory(item.category, item.itemName);
        const matchesCategory =
          selectedCategory === "ทั้งหมด" ||
          selectedCategory === "ALL" ||
          item.category === selectedCategory ||
          normalizedItemCat === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .sort((a, b) => {
        let valA: any = sortField === "maxPrice" ? (a.maxPrice ?? a.unitPrice ?? 0) : a[sortField];
        let valB: any = sortField === "maxPrice" ? (b.maxPrice ?? b.unitPrice ?? 0) : b[sortField];

        if (typeof valA === "string") {
          valA = (valA as string).toLowerCase();
          valB = (valB as string).toLowerCase();
        }

        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [items, searchTerm, selectedCategory, sortField, sortDirection]);

  const toggleSort = (field: "itemName" | "maxPrice" | "category") => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const getCategoryBadge = (cat: string) => {
    const normalized = normalizeExpenseCategory(cat);
    let IconComponent = Grid;
    switch (normalized) {
      case "หมวดค่าตอบแทน":
        IconComponent = Coins;
        break;
      case "หมวดโภชนาการ":
        IconComponent = Utensils;
        break;
      case "หมวดยานพาหนะ":
        IconComponent = Car;
        break;
      case "หมวดวัสดุก่อสร้าง":
      case "หมวดอุปกรณ์ก่อสร้าง":
        IconComponent = Hammer;
        break;
      case "หมวดอุปกรณ์สำนักงาน":
        IconComponent = Paperclip;
        break;
      case "หมวดอุปกรณ์อิเล็กทรอนิกส์":
        IconComponent = Cpu;
        break;
      default:
        IconComponent = Grid;
    }

    return (
      <span className="inline-flex items-center space-x-1 border border-neutral-700 bg-neutral-900 text-neutral-200 px-2 py-0.5 text-[11px] font-mono">
        <IconComponent className="w-3 h-3 text-neutral-400" />
        <span>{normalized}</span>
      </span>
    );
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 space-y-0 rounded-none shadow-xl">
      
      {/* Controls Header Bar */}
      <div className="p-4 sm:p-5 border-b border-neutral-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
        
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-neutral-500">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search price item by name..."
            className="w-full bg-neutral-950 border border-neutral-800 text-white pl-10 pr-4 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 font-sans rounded-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm("")}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-xs text-neutral-500 hover:text-white font-mono"
            >
              CLEAR
            </button>
          )}
        </div>

        {/* Category Filters & Add Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center space-x-1 bg-neutral-950 border border-neutral-800 p-1 text-xs font-mono overflow-x-auto">
            <Filter className="w-3.5 h-3.5 text-neutral-500 ml-1 mr-1 shrink-0" />
            {FILTER_CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 text-[11px] whitespace-nowrap transition cursor-pointer ${
                  selectedCategory === cat
                    ? "bg-white text-black font-bold"
                    : "text-neutral-400 hover:text-white hover:bg-neutral-900"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <button
            onClick={onAddNew}
            className="bg-white hover:bg-neutral-200 text-black font-semibold font-mono text-xs py-2 px-4 border border-white transition flex items-center space-x-1.5 rounded-none shrink-0"
          >
            <Plus className="w-4 h-4 stroke-[2.5]" />
            <span>ADD NEW ITEM</span>
          </button>
        </div>
      </div>

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse font-sans">
          <thead>
            <tr className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 text-xs font-mono uppercase tracking-wider">
              <th className="py-3.5 px-4 font-semibold">#</th>
              <th className="py-3.5 px-4 font-semibold">
                <button
                  onClick={() => toggleSort("itemName")}
                  className="flex items-center space-x-1.5 hover:text-white transition uppercase"
                >
                  <span>Item Name (รายการ)</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3.5 px-4 font-semibold">
                <button
                  onClick={() => toggleSort("category")}
                  className="flex items-center space-x-1.5 hover:text-white transition uppercase"
                >
                  <span>Category</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3.5 px-4 font-semibold text-right">
                <button
                  onClick={() => toggleSort("maxPrice")}
                  className="flex items-center space-x-1.5 hover:text-white transition uppercase ml-auto"
                >
                  <span>Max Price (THB)</span>
                  <ArrowUpDown className="w-3.5 h-3.5" />
                </button>
              </th>
              <th className="py-3.5 px-4 font-semibold">Unit (หน่วยนับ)</th>
              <th className="py-3.5 px-4 font-semibold text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-800/70 text-sm">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono">
                  <div className="flex items-center justify-center space-x-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                    <span>FETCHING REAL-TIME DATA FROM FIRESTORE...</span>
                  </div>
                </td>
              </tr>
            ) : filteredItems.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-neutral-500 font-mono space-y-2">
                  <div className="text-neutral-400 text-base font-semibold">NO MATCHING PRICE ENTRIES</div>
                  <p className="text-xs text-neutral-500">
                    {searchTerm
                      ? `No items found matching "${searchTerm}". Try a different keyword.`
                      : "No price items in database. Click 'Add New Item' to create one."}
                  </p>
                </td>
              </tr>
            ) : (
              filteredItems.map((item, index) => {
                const price = item.maxPrice ?? item.unitPrice ?? 0;
                const unitStr = item.unit || item.unitType || "";
                return (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-850/60 transition group font-sans text-neutral-200"
                  >
                    <td className="py-3.5 px-4 text-xs font-mono text-neutral-500">
                      {index + 1}
                    </td>
                    <td className="py-3.5 px-4 font-medium text-white group-hover:text-white">
                      {item.itemName}
                    </td>
                    <td className="py-3.5 px-4">
                      {getCategoryBadge(item.category)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-mono font-bold text-white">
                      ฿{price.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-3.5 px-4 text-xs font-mono text-neutral-400">
                      {unitStr}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1.5">
                        <button
                          onClick={() => onEdit(item)}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition"
                          title="Edit Item"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDelete(item)}
                          className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-transparent hover:border-neutral-700 transition"
                          title="Delete Item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Table Footer Status */}
      <div className="p-3 bg-neutral-950 border-t border-neutral-800 flex items-center justify-between text-xs font-mono text-neutral-500">
        <div>
          Showing {filteredItems.length} of {items.length} total entry records
        </div>
        <div>REALTIME SYNC ACTIVE</div>
      </div>
    </div>
  );
}
