import { redirect } from "next/navigation";
import { Suspense } from "react";

async function SearchRedirect({
  searchParams,
}: {
  searchParams: PageProps<"/search">["searchParams"];
}) {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  redirect(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
  return null;
}

export default function SearchPage({ searchParams }: PageProps<"/search">) {
  return (
    <Suspense fallback={null}>
      <SearchRedirect searchParams={searchParams} />
    </Suspense>
  );
}
