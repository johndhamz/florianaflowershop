import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";

import { ProductEditor } from "@/components/admin/products/product-editor";
import { PageHeader } from "@/components/shared/page-header";
import { TableSkeleton } from "@/components/shared/skeletons";
import { requireStaff } from "@/modules/auth/dal";
import { getAdminProduct } from "@/modules/catalog/admin-queries";

export const metadata: Metadata = { title: "Edit product" };

async function Product({
  params,
}: {
  params: PageProps<"/admin/products/[productId]">["params"];
}) {
  await requireStaff("catalog.manage");
  const { productId } = await params;
  if (!/^[0-9a-f-]{36}$/.test(productId)) notFound();
  const product = await getAdminProduct(productId);
  if (!product) notFound();
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        variant="admin"
        title={product.name}
        description={`/shop/${product.slug}`}
      />
      <ProductEditor product={product} />
    </div>
  );
}

export default function AdminProductPage(
  props: PageProps<"/admin/products/[productId]">,
) {
  return (
    <Suspense fallback={<TableSkeleton rows={6} columns={2} />}>
      <Product params={props.params} />
    </Suspense>
  );
}
