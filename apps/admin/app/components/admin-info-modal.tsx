"use client";

import { ReactNode } from "react";

interface AdminInfoModalProps {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}

export default function AdminInfoModal({ open, title, onClose, children }: AdminInfoModalProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-black/35 p-4" onClick={onClose}>
      <article
        className="max-h-[90vh] w-full max-w-5xl overflow-auto rounded-2xl border border-[#d9d0bf] bg-[#fffdf8] shadow-[0_20px_44px_rgba(18,32,22,0.28)]"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="sticky top-0 z-[1] flex items-center justify-between border-b border-[#d9d0bf] bg-[#fffdf8] p-4">
          <h3 className="m-0 text-xl text-[#122016]">{title}</h3>
          <button
            type="button"
            className="rounded-md border border-[#d9d0bf] bg-[#f4f8eb] px-3 py-1.5 text-sm text-[#122016]"
            onClick={onClose}
          >
            Close
          </button>
        </header>
        <div className="flex flex-col gap-4 p-4">{children}</div>
      </article>
    </div>
  );
}
