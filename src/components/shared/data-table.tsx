import type { ReactNode } from "react";

import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type DataTableColumn<Row> = {
  /** Stable key for React and for `aria` labelling. */
  id: string;
  header: ReactNode;
  cell: (row: Row) => ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  /** Hide on small screens (keeps tables scannable on phones). */
  hideBelow?: "sm" | "md" | "lg";
};

type DataTableProps<Row> = {
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowId: (row: Row) => string;
  caption?: string;
  /** Rendered when `rows` is empty. */
  emptyState?: ReactNode;
  className?: string;
  /** Make the whole row a link / interactive region (href rendered as overlay). */
  rowHref?: (row: Row) => string;
};

const hideClass = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
} as const;

const alignClass = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

/**
 * Server-renderable data table for admin listings. Sorting/filtering/pagination are
 * driven by the URL (searchParams) in later phases, so this component stays stateless.
 */
export function DataTable<Row>({
  columns,
  rows,
  getRowId,
  caption,
  emptyState,
  className,
}: DataTableProps<Row>) {
  if (rows.length === 0) {
    return (
      <>
        {emptyState ?? (
          <EmptyState
            title="Nothing here yet"
            description="No records to show."
            size="sm"
          />
        )}
      </>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10",
        className,
      )}
    >
      <Table>
        {caption ? <TableCaption className="sr-only">{caption}</TableCaption> : null}
        <TableHeader>
          <TableRow className="bg-muted/40 hover:bg-muted/40">
            {columns.map((col) => (
              <TableHead
                key={col.id}
                scope="col"
                className={cn(
                  "h-10 text-xs font-medium tracking-wide text-muted-foreground uppercase",
                  alignClass[col.align ?? "left"],
                  col.hideBelow && hideClass[col.hideBelow],
                  col.className,
                )}
              >
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={getRowId(row)}>
              {columns.map((col) => (
                <TableCell
                  key={col.id}
                  className={cn(
                    "py-3",
                    alignClass[col.align ?? "left"],
                    col.hideBelow && hideClass[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.cell(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
