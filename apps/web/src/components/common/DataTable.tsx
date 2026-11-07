import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronLeft, ChevronRight, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface Column<T> {
  header: string;
  accessorKey?: keyof T;
  cell?: (row: T, index: number) => React.ReactNode;
  className?: string;
  headerClassName?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T, index: number) => string;
  emptyMessage?: string;
  emptyAction?: React.ReactNode;
  pageSize?: number;
  className?: string;
}

export function DataTable<T extends object>({
  columns,
  data,
  keyExtractor,
  emptyMessage = "No records found.",
  emptyAction,
  pageSize = 10,
  className,
}: DataTableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const currentData = data.slice(startIndex, startIndex + pageSize);

  const handlePrev = () => {
    setCurrentPage((p) => Math.max(1, p - 1));
  };

  const handleNext = () => {
    setCurrentPage((p) => Math.min(totalPages, p + 1));
  };

  return (
    <div
      className={cn(
        "rounded-xl border border-slate-200/80 bg-white overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.03)]",
        className
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs sm:text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {columns.map((col, idx) => (
                <th
                  key={idx}
                  className={cn(
                    "px-4 py-3 sm:px-5 font-semibold text-slate-600 whitespace-nowrap",
                    col.headerClassName
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {currentData.length > 0 ? (
              currentData.map((row, idx) => (
                <tr
                  key={keyExtractor(row, startIndex + idx)}
                  className="transition-colors hover:bg-slate-50/50"
                >
                  {columns.map((col, cIdx) => (
                    <td
                      key={cIdx}
                      className={cn(
                        "px-4 py-3 sm:px-5 text-slate-700 align-middle",
                        col.className
                      )}
                    >
                      {col.cell
                        ? col.cell(row, startIndex + idx)
                        : col.accessorKey
                        ? String((row as Record<string, unknown>)[col.accessorKey as string] ?? "")
                        : null}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="py-12 text-center text-slate-500"
                >
                  <div className="flex flex-col items-center justify-center">
                    <Inbox className="h-8 w-8 text-slate-300 mb-2" />
                    <p className="text-xs font-medium text-slate-500">{emptyMessage}</p>
                    {emptyAction && <div className="mt-3">{emptyAction}</div>}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {data.length > pageSize && (
        <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3 sm:px-5 bg-slate-50/40">
          <p className="text-xs text-slate-500">
            Showing <span className="font-medium text-slate-700">{startIndex + 1}</span> to{" "}
            <span className="font-medium text-slate-700">
              {Math.min(startIndex + pageSize, data.length)}
            </span>{" "}
            of <span className="font-medium text-slate-700">{data.length}</span> results
          </p>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handlePrev}
              disabled={currentPage === 1}
              className="h-7 w-7 p-0 border-slate-200"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs font-medium text-slate-600">
              {currentPage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={handleNext}
              disabled={currentPage === totalPages}
              className="h-7 w-7 p-0 border-slate-200"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
