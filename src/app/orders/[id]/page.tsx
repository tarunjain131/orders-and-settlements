import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { getOrder, isEditable } from "@/lib/orders";
import { getCurrentUser } from "@/lib/auth";
import StatusBadge from "@/components/StatusBadge";
import { formatDate, formatDateOnly, formatMoney } from "@/lib/format";
import MarkAsPaidButton from "@/components/MarkAsPaidButton";
import VoidButton from "@/components/VoidButton";
import DeleteOrderButton from "@/components/DeleteOrderButton";

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { id } = await params;
  const order = await getOrder(Number(id), user.id);
  if (!order) notFound();

  const currency = order.currency;
  const subtotal = Number(order.subtotalAmount);
  const discount = Number(order.discountAmount);
  const shipping = Number(order.shippingAmount);
  const tax = Number(order.taxAmount);
  const total = Number(order.totalAmount);
  const amountPaid = Number(order.amountPaid);
  const amountRefunded = Number(order.amountRefunded);
  const balanceDue = Math.max(total - amountPaid, 0);
  const refundable = Math.max(amountPaid - amountRefunded, 0);

  const editable = isEditable(order.financialStatus);
  const canVoid = order.financialStatus === "pending" && amountPaid === 0;
  const canPay =
    balanceDue > 0 &&
    order.financialStatus !== "voided" &&
    order.financialStatus !== "refunded";
  const canRefund = refundable > 0;
  const canDelete = amountPaid === 0;

  // Payments get their own table below; the timeline only tracks the
  // remaining lifecycle events (creation, refunds) so it doesn't duplicate
  // what's already shown there.
  const payments = order.transactions.filter((t) => t.kind === "sale");
  const refundEvents = order.transactions
    .filter((t) => t.kind === "refund")
    .map((t) => ({
      date: t.createdAt,
      label: `Refund issued: ${formatMoney(t.amount, currency)}`,
      note: t.note,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center justify-between px-6">
        <div className="flex items-center gap-3">
          <Link href="/orders" className="text-gray-500 hover:text-gray-700">
            <ChevronLeft size={20} />
          </Link>
          <h1 className="text-lg font-semibold">{order.name}</h1>
          <StatusBadge status={order.displayStatus} />
        </div>
        {editable && (
          <Link
            href={`/orders/${order.id}/edit`}
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 px-3.5 py-2 text-sm font-medium hover:bg-gray-50"
          >
            <Pencil size={14} />
            Edit
          </Link>
        )}
      </header>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-medium">
                Placed {formatDate(order.createdAt)} · Due{" "}
                {formatDateOnly(order.dueDate)}
              </h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                <tr>
                  <th className="text-left font-medium px-5 py-2.5">Item</th>
                  <th className="text-right font-medium px-5 py-2.5">Price</th>
                  <th className="text-right font-medium px-5 py-2.5">Qty</th>
                  <th className="text-right font-medium px-5 py-2.5">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {order.lineItems.map((li) => (
                  <tr key={li.id}>
                    <td className="px-5 py-3">
                      <div className="font-medium text-gray-800">{li.description}</div>
                      {(li.variantTitle || li.sku) && (
                        <div className="text-xs text-gray-500">
                          {li.variantTitle}
                          {li.variantTitle && li.sku ? " · " : ""}
                          {li.sku && `SKU: ${li.sku}`}
                        </div>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {formatMoney(li.price, currency)}
                    </td>
                    <td className="px-5 py-3 text-right text-gray-600">
                      {li.quantity}
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatMoney(Number(li.price) * li.quantity, currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end">
              <div className="w-64 text-sm space-y-1.5">
                <Row label="Subtotal" value={formatMoney(subtotal, currency)} />
                {discount > 0 && (
                  <Row
                    label="Discount"
                    value={`-${formatMoney(discount, currency)}`}
                  />
                )}
                {shipping > 0 && (
                  <Row label="Shipping" value={formatMoney(shipping, currency)} />
                )}
                {tax > 0 && <Row label="Tax" value={formatMoney(tax, currency)} />}
                <Row
                  label="Total"
                  value={formatMoney(total, currency)}
                  strong
                />
                <Row
                  label="Paid"
                  value={formatMoney(amountPaid, currency)}
                  muted
                />
                {amountRefunded > 0 && (
                  <Row
                    label="Refunded"
                    value={`-${formatMoney(amountRefunded, currency)}`}
                    muted
                  />
                )}
                <Row
                  label="Balance due"
                  value={formatMoney(balanceDue, currency)}
                  strong
                />
              </div>
            </div>
          </section>

          {payments.length > 0 && (
            <section className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-200">
                <h2 className="font-medium">Payment history</h2>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-right font-medium px-5 py-2.5">Amount</th>
                    <th className="text-left font-medium px-5 py-2.5">Date paid</th>
                    <th className="text-left font-medium px-5 py-2.5">Note</th>
                    <th className="text-left font-medium px-5 py-2.5">Recorded at</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {payments.map((t) => (
                    <tr key={t.id}>
                      <td className="px-5 py-3 text-right font-medium">
                        {formatMoney(t.amount, currency)}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {formatDateOnly(t.paidOn)}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {t.note || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-5 py-3 text-gray-600">
                        {formatDate(t.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {(refundEvents.length > 0 || order.refunds.length > 0) && (
            <section className="bg-white rounded-lg border border-gray-200 p-5">
              <h2 className="font-medium mb-3">Timeline</h2>
              <ul className="space-y-3 text-sm">
                <li className="flex justify-between text-gray-600">
                  <span>Order created</span>
                  <span>{formatDate(order.createdAt)}</span>
                </li>
                {refundEvents.map((e, i) => (
                  <li key={i} className="flex justify-between text-gray-600">
                    <span>
                      {e.label}
                      {e.note && (
                        <span className="text-gray-400"> — {e.note}</span>
                      )}
                    </span>
                    <span>{formatDate(e.date)}</span>
                  </li>
                ))}
              </ul>

              {order.refunds.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
                    Refunds
                  </h3>
                  <div className="space-y-2">
                    {order.refunds.map((r) => (
                      <div
                        key={r.id}
                        className="text-sm flex justify-between items-baseline"
                      >
                        <span className="text-gray-700">
                          {formatMoney(r.amount, currency)}
                          {r.reason ? ` — ${r.reason}` : ""}
                        </span>
                        <span className="text-gray-400 text-xs">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </div>

        <div className="space-y-6">
          <section className="bg-white rounded-lg border border-gray-200 p-5">
            <h2 className="font-medium mb-3">Customer</h2>
            <div className="text-sm space-y-1">
              <div className="font-medium text-gray-800">
                {order.customerName}
              </div>
              {order.customerEmail && (
                <div className="text-gray-600">{order.customerEmail}</div>
              )}
              {order.customerPhone && (
                <div className="text-gray-600">{order.customerPhone}</div>
              )}
            </div>
            {order.description && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                  Description
                </h3>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {order.description}
                </p>
              </div>
            )}
          </section>

          <section className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
            <h2 className="font-medium mb-1">Actions</h2>

            {canPay && (
              <>
                <MarkAsPaidButton orderId={order.id} amount={balanceDue} />
                <Link
                  href={`/orders/${order.id}/pay`}
                  className="block text-center w-full px-3 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
                >
                  Record a partial payment
                </Link>
              </>
            )}

            {canRefund && (
              <Link
                href={`/orders/${order.id}/refund`}
                className="block text-center w-full px-3 py-2 text-sm font-medium rounded-md border border-gray-300 hover:bg-gray-50"
              >
                Refund
              </Link>
            )}

            {canVoid && <VoidButton orderId={order.id} />}

            {canDelete && <DeleteOrderButton orderId={order.id} />}

            {!canPay && !canRefund && !canVoid && !canDelete && (
              <p className="text-sm text-gray-500">
                No further payment actions are available for this order.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  strong,
  muted,
}: {
  label: string;
  value: string;
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div
      className={`flex justify-between ${
        strong
          ? "font-semibold text-base pt-1.5 border-t border-gray-200"
          : muted
          ? "text-gray-500"
          : "text-gray-600"
      }`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
