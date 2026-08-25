"use client";

import React, { useState, useEffect } from "react";
import { PriceMatrixItem, PriceMatrixFormData, CategoryType } from "@/lib/types";
import { X, Save, PlusCircle, AlertCircle } from "lucide-react";

interface ItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: PriceMatrixFormData, id?: string) => Promise<void>;
  initialData?: PriceMatrixItem | null;
}

const CATEGORIES: CategoryType[] = ["Food", "Material", "Service", "Other"];

export default function ItemModal({
  isOpen,
  onClose,
  onSave,
  initialData,
}: ItemModalProps) {
  const [itemName, setItemName] = useState("");
  const [category, setCategory] = useState<CategoryType>("Food");
  const [unitPrice, setUnitPrice] = useState<string>("");
  const [unitType, setUnitType] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const isEditing = Boolean(initialData);

  useEffect(() => {
    if (initialData) {
      setItemName(initialData.itemName);
      setCategory(initialData.category);
      setUnitPrice(initialData.unitPrice.toString());
      setUnitType(initialData.unitType);
    } else {
      setItemName("");
      setCategory("Food");
      setUnitPrice("");
      setUnitType("");
    }
    setError(null);
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const priceNum = parseFloat(unitPrice);
    if (!itemName.trim()) {
      setError("Please enter a valid item name.");
      return;
    }
    if (isNaN(priceNum) || priceNum < 0) {
      setError("Unit price must be a valid positive number.");
      return;
    }
    if (!unitType.trim()) {
      setError("Please specify the unit type (e.g., บาท/มื้อ, ตร.ม.).");
      return;
    }

    setLoading(true);
    try {
      await onSave(
        {
          itemName: itemName.trim(),
          category,
          unitPrice: priceNum,
          unitType: unitType.trim(),
        },
        initialData?.id
      );
      onClose();
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An error occurred while saving the item.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-lg shadow-2xl rounded-none overflow-hidden space-y-0">
        
        {/* Modal Header */}
        <div className="bg-neutral-950 px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            {isEditing ? (
              <Save className="w-5 h-5 text-white" />
            ) : (
              <PlusCircle className="w-5 h-5 text-white" />
            )}
            <h2 className="text-base font-bold font-mono uppercase tracking-tight text-white">
              {isEditing ? "Edit Matrix Entry" : "Create New Matrix Entry"}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 border border-transparent hover:border-neutral-700 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body / Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="bg-neutral-950 border border-neutral-700 p-3 text-xs font-mono text-neutral-200 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-white shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Item Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono uppercase text-neutral-300">
              Item Name (ชื่อรายการ) <span className="text-neutral-400">*</span>
            </label>
            <input
              type="text"
              required
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              placeholder="e.g. ข้าวกล่อง, ป้ายไวนิล, ค่าตอบแทนวิทยากร"
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none"
            />
          </div>

          {/* Category Dropdown */}
          <div className="space-y-1.5">
            <label className="block text-xs font-mono uppercase text-neutral-300">
              Category (หมวดหมู่) <span className="text-neutral-400">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as CategoryType)}
              className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition rounded-none font-mono"
            >
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>

          {/* Unit Price & Unit Type Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-neutral-300">
                Unit Price (ราคาต่อหน่วย - THB) <span className="text-neutral-400">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                placeholder="e.g. 50"
                className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 font-mono rounded-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-mono uppercase text-neutral-300">
                Unit Type (หน่วยนับ) <span className="text-neutral-400">*</span>
              </label>
              <input
                type="text"
                required
                value={unitType}
                onChange={(e) => setUnitType(e.target.value)}
                placeholder="e.g. บาท/มื้อ, ตร.ม., บาท/วัน"
                className="w-full bg-neutral-950 border border-neutral-800 text-white px-3 py-2 text-sm focus:outline-none focus:border-white transition placeholder-neutral-600 rounded-none"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-neutral-800 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none"
            >
              CANCEL
            </button>
            <button
              type="submit"
              disabled={loading}
              className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition disabled:opacity-50 rounded-none flex items-center space-x-2"
            >
              <span>{loading ? "SAVING..." : isEditing ? "UPDATE ENTRY" : "CREATE ENTRY"}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
