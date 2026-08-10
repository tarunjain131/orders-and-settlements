"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function PaymentForm({
  orderId,
  maxAmount,
}: {
  orderId: number;
  maxAmount: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(maxAmount);
  const [paidOn, setPaidOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/orders/${orderId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, paidOn, note: note || null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to record payment");
      router.push(`/orders/${orderId}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Amount
        </span>
        <input
          type="number"
          min={0.01}
          max={maxAmount}
          step="0.01"
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value))}
          className="input"
          required
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Payment date
        </span>
        <input
          type="date"
          value={paidOn}
          onChange={(e) => setPaidOn(e.target.value)}
          className="input"
          required
        />
      </label>
      <label className="block">
        <span className="block text-xs font-medium text-gray-600 mb-1">
          Note (optional)
        </span>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="input"
        />
      </label>
      <div className="flex justify-end gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="px-4 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-4 py-2 text-sm font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {submitting ? "Recording..." : "Record payment"}
        </button>
      </div>
      <style jsx global>{`
        .input {
          border: 1px solid rgb(209 213 219);
          border-radius: 6px;
          padding: 0.5rem 0.65rem;
          font-size: 0.875rem;
          width: 100%;
        }
        .input:focus {
          outline: none;
          box-shadow: 0 0 0 2px rgb(16 185 129 / 0.5);
          border-color: rgb(16 185 129);
        }
      `}</style>
    </form>
  );
}
