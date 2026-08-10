import clsx from "clsx";

const STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-800 ring-amber-600/20",
  partially_paid: "bg-blue-50 text-blue-800 ring-blue-600/20",
  paid: "bg-green-50 text-green-800 ring-green-600/20",
  partially_refunded: "bg-purple-50 text-purple-800 ring-purple-600/20",
  refunded: "bg-slate-100 text-slate-700 ring-slate-500/20",
  voided: "bg-red-50 text-red-700 ring-red-600/20",
};

const LABELS: Record<string, string> = {
  pending: "Pending",
  partially_paid: "Partially paid",
  paid: "Paid",
  partially_refunded: "Partially refunded",
  refunded: "Refunded",
  voided: "Voided",
};

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset",
        STYLES[status] ?? "bg-gray-100 text-gray-800 ring-gray-500/20"
      )}
    >
      {LABELS[status] ?? status}
    </span>
  );
}
