import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import OrderForm from "@/components/OrderForm";

export default function NewOrderPage() {
  return (
    <div className="flex-1 flex flex-col">
      <header className="h-16 border-b border-gray-200 bg-white flex items-center px-6 gap-3">
        <Link href="/orders" className="text-gray-500 hover:text-gray-700">
          <ChevronLeft size={20} />
        </Link>
        <h1 className="text-lg font-semibold">Create order</h1>
      </header>
      <div className="p-6 max-w-3xl">
        <OrderForm mode="create" />
      </div>
    </div>
  );
}
