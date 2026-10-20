import { Container } from "@/components/shared/container";
import { Skeleton } from "@/components/ui/skeleton";

export default function ProductLoading() {
  return (
    <Container className="flex flex-col gap-8 py-8 sm:py-12">
      <Skeleton className="h-4 w-48" />
      <div className="grid gap-8 lg:grid-cols-2 lg:gap-14">
        <Skeleton className="aspect-[4/5] w-full rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-10 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-11 w-full" />
        </div>
      </div>
    </Container>
  );
}
