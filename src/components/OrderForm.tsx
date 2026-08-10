"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { formatMoney } from "@/lib/format";

type LineItemRow = {
  description: string;
  variantTitle: string;
  sku: string;
  quantity: number;
  price: number;
};

type OrderFormValues = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  currency: string;
  description: string;
  dueDate: string;
  lineItems: LineItemRow[];
};

const EMPTY_ITEM: LineItemRow = {
  description: "",
  variantTitle: "",
  sku: "",
  quantity: 1,
  price: 0,
};

export default function OrderForm({
  mode,
  orderId,
  initialValues,
}: {
  mode: "create" | "edit";
  orderId?: number;
  initialValues?: Partial<OrderFormValues>;
}) {
  const router = useRouter();
  const [values, setValues] = useState<OrderFormValues>({
    customerName: initialValues?.customerName ?? "",
    customerEmail: initialValues?.customerEmail ?? "",
    customerPhone: initialValues?.customerPhone ?? "",
    currency: initialValues?.currency ?? "INR",
    description: initialValues?.description ?? "",
    dueDate: initialValues?.dueDate ?? "",
    lineItems: initialValues?.lineItems?.length
      ? initialValues.lineItems
      : [{ ...EMPTY_ITEM }],
  });
  const [paymentMode, setPaymentMode] = useState<"pending" | "paid" | "partial">(
    "pending"
  );
  const [partialAmount, setPartialAmount] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const subtotal = useMemo(
    () =>
      values.lineItems.reduce(
        (sum, li) => sum + (Number(li.quantity) || 0) * (Number(li.price) || 0),
        0
      ),
    [values.lineItems]
  );
  const total = subtotal;

  function updateItem(index: number, patch: Partial<LineItemRow>) {
    setValues((v) => ({
      ...v,
      lineItems: v.lineItems.map((li, i) =>
        i === index ? { ...li, ...patch } : li
      ),
    }));
  }

  function addItem() {
    setValues((v) => ({ ...v, lineItems: [...v.lineItems, { ...EMPTY_ITEM }] }));
  }

  function removeItem(index: number) {
    setValues((v) => ({
      ...v,
      lineItems: v.lineItems.filter((_, i) => i !== index),
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const cleanedItems = values.lineItems.filter((li) => li.description.trim());
    if (cleanedItems.length === 0) {
      setError("Add at least one line item with a description.");
      return;
    }

    const payload = {
      customerName: values.customerName,
      customerEmail: values.customerEmail || null,
      customerPhone: values.customerPhone || null,
      currency: values.currency,
      description: values.description || null,
      dueDate: values.dueDate,
      lineItems: cleanedItems,
      initialPayment:
        mode === "create"
          ? paymentMode === "paid"
            ? total
            : paymentMode === "partial"
            ? partialAmount
            : 0
          : 0,
    };

    setSubmitting(true);
    try {
      const res = await fetch(
        mode === "create" ? "/api/orders" : `/api/orders/${orderId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Something went wrong");
      }
      router.push(`/orders/${data.order.id}`);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3">
          {error}
        </div>
      )}

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Customer</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Field label="Name" required>
            <input
              className="input"
              value={values.customerName}
              onChange={(e) =>
                setValues((v) => ({ ...v, customerName: e.target.value }))
              }
              required
            />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input"
              value={values.customerEmail}
              onChange={(e) =>
                setValues((v) => ({ ...v, customerEmail: e.target.value }))
              }
            />
          </Field>
          <Field label="Phone">
            <input
              className="input"
              value={values.customerPhone}
              onChange={(e) =>
                setValues((v) => ({ ...v, customerPhone: e.target.value }))
              }
            />
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Field label="Due date" required>
            <input
              type="date"
              className="input"
              value={values.dueDate}
              onChange={(e) =>
                setValues((v) => ({ ...v, dueDate: e.target.value }))
              }
              required
            />
          </Field>
        </div>
        <div className="mt-4">
          <Field label="Description">
            <textarea
              className="input"
              rows={2}
              value={values.description}
              onChange={(e) =>
                setValues((v) => ({ ...v, description: e.target.value }))
              }
            />
          </Field>
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-medium">Line items</h2>
          <button
            type="button"
            onClick={addItem}
            className="inline-flex items-center gap-1 text-sm text-emerald-700 font-medium hover:text-emerald-800"
          >
            <Plus size={14} /> Add item
          </button>
        </div>

        <div className="space-y-3">
          {values.lineItems.map((li, i) => (
            <div
              key={i}
              className="grid grid-cols-12 gap-2 items-start border-b border-gray-100 pb-3 last:border-0"
            >
              <input
                className="input col-span-5"
                placeholder="Item description"
                value={li.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
              />
              <input
                className="input col-span-2"
                placeholder="SKU"
                value={li.sku}
                onChange={(e) => updateItem(i, { sku: e.target.value })}
              />
              <input
                type="number"
                min={1}
                className="input col-span-1 text-right"
                placeholder="Qty"
                value={li.quantity}
                onChange={(e) =>
                  updateItem(i, { quantity: Number(e.target.value) })
                }
              />
              <input
                type="number"
                min={0}
                step="0.01"
                className="input col-span-2 text-right"
                placeholder="Price"
                value={li.price}
                onChange={(e) => updateItem(i, { price: Number(e.target.value) })}
              />
              <div className="col-span-1 text-right text-sm pt-2 font-medium">
                {formatMoney(
                  (Number(li.quantity) || 0) * (Number(li.price) || 0),
                  values.currency
                )}
              </div>
              <button
                type="button"
                onClick={() => removeItem(i)}
                className="col-span-1 text-gray-400 hover:text-red-600 pt-2"
                aria-label="Remove item"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="font-medium mb-4">Amounts</h2>
        <div className="flex justify-end">
          <div className="w-64 text-sm space-y-1">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span>
              <span>{formatMoney(subtotal, values.currency)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1 border-t border-gray-200">
              <span>Total</span>
              <span>{formatMoney(total, values.currency)}</span>
            </div>
          </div>
        </div>
      </section>

      {mode === "create" && (
        <section className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="font-medium mb-4">Payment</h2>
          <div className="space-y-2 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={paymentMode === "pending"}
                onChange={() => setPaymentMode("pending")}
              />
              Leave unpaid (financial status: pending)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={paymentMode === "paid"}
                onChange={() => setPaymentMode("paid")}
              />
              Mark as fully paid now
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                checked={paymentMode === "partial"}
                onChange={() => setPaymentMode("partial")}
              />
              Record a partial payment
            </label>
            {paymentMode === "partial" && (
              <input
                type="number"
                min={0}
                step="0.01"
                max={total}
                className="input w-40 ml-6"
                placeholder="Amount"
                value={partialAmount}
                onChange={(e) => setPartialAmount(Number(e.target.value))}
              />
            )}
          </div>
        </section>
      )}

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
          {submitting
            ? "Saving..."
            : mode === "create"
            ? "Create order"
            : "Save changes"}
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

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-gray-600 mb-1">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </span>
      {children}
    </label>
  );
}
