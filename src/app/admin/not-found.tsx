import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Page not found"
      description="This admin page does not exist yet or has moved."
      action={
        <Button asChild>
          <Link href="/admin">Back to dashboard</Link>
        </Button>
      }
    />
  );
}
