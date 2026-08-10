import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getOrder, isEditable } from "@/lib/orders";
import OrderForm from "@/components/OrderForm";

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const order = await getOrder(Number(id));
  if (!order) notFound();

  const editable = isEditable(order.financialStatus);

  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 gap-3">
        <Link
          href={`/orders/${order.id}`}
          className="text-gray-500 hover:text-gray-700"
        >
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Edit order {order.name}</h1>
      </header>
      <div className="p-6 max-w-3xl">
        {!editable ? (
          <div className="rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-sm px-4 py-3 mb-4">
            This order can&apos;t be edited because its financial status is{" "}
            <strong>{order.financialStatus.replace("_", " ")}</strong>. Once an
            order is fully paid, changes must go through a refund, an
            additional payment, or a new order — just like Shopify.{" "}
            <Link href={`/orders/${order.id}`} className="underline">
              Go back
            </Link>
            .
          </div>
        ) : (
          <OrderForm
            mode="edit"
            orderId={order.id}
            initialValues={{
              customerName: order.customerName,
              customerEmail: order.customerEmail ?? "",
              customerPhone: order.customerPhone ?? "",
              currency: order.currency,
              note: order.note ?? "",
              discountAmount: Number(order.discountAmount),
              shippingAmount: Number(order.shippingAmount),
              taxAmount: Number(order.taxAmount),
              lineItems: order.lineItems.map((li) => ({
                title: li.title,
                variantTitle: li.variantTitle ?? "",
                sku: li.sku ?? "",
                quantity: li.quantity,
                price: Number(li.price),
              })),
            }}
          />
        )}
      </div>
    </div>
  );
}
