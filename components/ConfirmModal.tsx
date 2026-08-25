"use client";

import React from "react";
import { AlertTriangle, Trash2, X } from "lucide-react";

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  title?: string;
  message?: string;
  itemName?: string;
  loading?: boolean;
}

export default function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Document Deletion",
  message = "Are you sure you want to delete this price entry from the central database? This action cannot be undone.",
  itemName,
  loading = false,
}: ConfirmModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-xs font-sans">
      <div className="bg-neutral-900 border border-neutral-700 w-full max-w-md shadow-2xl rounded-none p-6 space-y-5">
        
        {/* Header Icon & Title */}
        <div className="flex items-start space-x-3.5">
          <div className="p-2.5 bg-neutral-950 border border-neutral-700 text-white shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2]" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono uppercase tracking-tight text-white">
              {title}
            </h3>
            <p className="text-xs text-neutral-400 mt-1 leading-relaxed">
              {message}
            </p>
          </div>
        </div>

        {/* Item Preview Box */}
        {itemName && (
          <div className="bg-neutral-950 border border-neutral-800 p-3 text-xs font-mono text-white">
            <span className="text-neutral-500 uppercase block text-[10px] mb-0.5">Target Document:</span>
            <span className="font-semibold">{itemName}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-3 border-t border-neutral-800 flex items-center justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="bg-neutral-950 hover:bg-neutral-800 text-neutral-400 hover:text-white border border-neutral-800 px-4 py-2 text-xs font-mono transition rounded-none disabled:opacity-50"
          >
            CANCEL
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className="bg-white hover:bg-neutral-200 text-black font-semibold border border-white px-5 py-2 text-xs font-mono transition rounded-none flex items-center space-x-1.5 disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{loading ? "DELETING..." : "CONFIRM DELETE"}</span>
          </button>
        </div>

      </div>
    </div>
  );
}
