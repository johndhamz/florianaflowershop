import { TableSkeleton } from "@/components/shared/skeletons";
export default function Loading() {
  return <TableSkeleton rows={10} columns={6} />;
}
