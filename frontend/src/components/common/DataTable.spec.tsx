import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable, Column } from "./DataTable";

interface MockRecord {
  id: string;
  code: string;
  name: string;
}

describe("DataTable Component: Large Simulated Volumes & Server-side Pagination", () => {
  const columns: Column<MockRecord>[] = [
    { key: "code", header: "Code" },
    { key: "name", header: "Désignation" },
  ];

  it("should correctly handle and render high simulated volumes (500,000 records)", () => {
    const onPageChange = vi.fn();
    const onLimitChange = vi.fn();

    // 10 items for the current page slice
    const mockPageData: MockRecord[] = Array.from({ length: 10 }, (_, i) => ({
      id: `item-${i + 1}`,
      code: `CODE-${i + 1}`,
      name: `Record ${i + 1}`,
    }));

    render(
      <DataTable<MockRecord>
        columns={columns}
        data={mockPageData}
        total={500000} // 500,000 records simulated on server
        page={1}
        limit={10}
        onPageChange={onPageChange}
        onLimitChange={onLimitChange}
      />,
    );

    // Verify pagination calculation
    expect(screen.getByText("500000")).toBeInTheDocument();
    expect(screen.getByText(/1 \/ 50000/)).toBeInTheDocument(); // 500,000 / 10 = 50,000 pages
    expect(screen.getByText("Affichage de", { exact: false })).toBeInTheDocument();

    // Verify row rendering
    expect(screen.getByText("CODE-1")).toBeInTheDocument();
    expect(screen.getByText("CODE-10")).toBeInTheDocument();
  });

  it("should trigger page navigation when clicking next, previous, or jump buttons", () => {
    const onPageChange = vi.fn();

    const mockPageData: MockRecord[] = [
      { id: "1", code: "C-1", name: "Name 1" },
    ];

    render(
      <DataTable<MockRecord>
        columns={columns}
        data={mockPageData}
        total={1000}
        page={5}
        limit={10}
        onPageChange={onPageChange}
      />,
    );

    // Click Previous (page 5 -> 4)
    const prevBtn = screen.getByLabelText("Page précédente");
    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(4);

    // Click Next (page 5 -> 6)
    const nextBtn = screen.getByLabelText("Page suivante");
    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(6);

    // Click First page (page 5 -> 1)
    const firstBtn = screen.getByLabelText("Première page");
    fireEvent.click(firstBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    // Click Last page (page 5 -> 100)
    const lastBtn = screen.getByLabelText("Dernière page");
    fireEvent.click(lastBtn);
    expect(onPageChange).toHaveBeenCalledWith(100);
  });

  it("should trigger onLimitChange when changing items per page dropdown", () => {
    const onLimitChange = vi.fn();

    render(
      <DataTable<MockRecord>
        columns={columns}
        data={[]}
        total={200}
        page={1}
        limit={10}
        onPageChange={vi.fn()}
        onLimitChange={onLimitChange}
      />,
    );

    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "50" } });
    expect(onLimitChange).toHaveBeenCalledWith(50);
  });
});
