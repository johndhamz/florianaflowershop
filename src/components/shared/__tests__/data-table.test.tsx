import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DataTable, type DataTableColumn } from "@/components/shared/data-table";

type Row = { id: string; name: string; qty: number };

const columns: DataTableColumn<Row>[] = [
  { id: "name", header: "Name", cell: (r) => r.name },
  { id: "qty", header: "Qty", cell: (r) => r.qty, align: "right", hideBelow: "md" },
];

describe("DataTable", () => {
  it("renders headers and rows", () => {
    render(
      <DataTable
        columns={columns}
        rows={[
          { id: "1", name: "Roses", qty: 12 },
          { id: "2", name: "Orchids", qty: 3 },
        ]}
        getRowId={(r) => r.id}
        caption="Stock"
      />,
    );
    const table = screen.getByRole("table", { name: "Stock" });
    expect(within(table).getAllByRole("columnheader")).toHaveLength(2);
    expect(within(table).getAllByRole("row")).toHaveLength(3); // header + 2 rows
    expect(within(table).getByText("Orchids")).toBeInTheDocument();
    expect(within(table).getByRole("columnheader", { name: "Qty" })).toHaveClass(
      "hidden",
      "md:table-cell",
    );
  });

  it("renders the empty state when there are no rows", () => {
    render(<DataTable columns={columns} rows={[]} getRowId={(r) => r.id} />);
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Nothing here yet");
  });
});
