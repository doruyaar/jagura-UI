/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect, MouseEvent } from "react";
import {
  Plus,
  CheckCircle2,
  ChevronUp,
  ChevronDown as ChevronDownIcon,
} from "lucide-react";
import { CiPlay1 } from "react-icons/ci";
import { GoClock, GoNumber, GoTerminal } from "react-icons/go";
import { VscSymbolKey } from "react-icons/vsc";
import { RxComponentBoolean } from "react-icons/rx";
import { FaComputer} from "react-icons/fa6";
import { BsExclamationOctagon, BsClipboardData } from "react-icons/bs";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

const highlightSQL = (sql: string) => {
  const escapedSql = sql
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  const keywords =
    /\b(SELECT|FROM|CREATE|STOP|REMOVE|TABLE|INSERT|INTO|VALUES|UPDATE|DELETE|DROP|ALTER|INDEX|VIEW|LAUNCH|SHOW|NUMBER|STRING|BOOLEAN|CONTAINER)\b/gi;
  const operators =
    /\b(\*|=|\+|-|>|<|>=|<=|<>|!=|IS|NULL|metadata|run_cmd|AND|OR|LIKE|IN|BETWEEN|EXISTS|TABLES|WHERE|false|true)\b/gi;

  const highlighted = escapedSql
    .replace(keywords, '<span style="color: #4A90E2;">$1</span>')
    .replace(operators, '<span style="color: #D0021B;">$1</span>');

  return highlighted;
};

enum ColumnType {
  NUMBER = "NUMBER",
  INT = "INT",
  STRING = "STRING",
  BOOLEAN = "BOOLEAN",
  CONTAINER = "CONTAINER",
  METADATA = "METADATA",
  RUN = "RUN",
  UNKNOWN = "UNKNOWN",
}

interface Column {
  name: string;
  type: ColumnType;
}

interface QueryResult {
  columns: Column[];
  rows: any[][];
}

interface Tab {
  id: string;
  name: string;
  content: string;
  queryResult: QueryResult | null;
  executionTime: number | null;
}

export default function SqlQueryInterface() {
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: "1",
      name: "New Query",
      content: "",
      queryResult: null,
      executionTime: null,
    },
  ]);
  const [activeTab, setActiveTab] = useState("1");
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [sortConfig, setSortConfig] = useState<{
    key: number;
    direction: "asc" | "desc";
  } | null>(null);

  const [columnWidths, setColumnWidths] = useState<number[]>([]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const resizingCol = useRef<number | null>(null);
  const startX = useRef<number>(0);
  const startWidth = useRef<number>(0);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "auto";
    };
  }, []);

  const addTab = () => {
    const newTab = {
      id: Date.now().toString(),
      name: `New Query`,
      content: "",
      queryResult: null,
      executionTime: null,
    };
    setTabs([...tabs, newTab]);
    setActiveTab(newTab.id);
  };

  const removeTab = (id: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== id);
    setTabs(newTabs);
    if (activeTab === id) {
      setActiveTab(newTabs.length > 0 ? newTabs[0].id : "");
    }
  };

  const updateTabContent = (id: string, content: string) => {
    setTabs(tabs.map((tab) => (tab.id === id ? { ...tab, content } : tab)));
  };

  const updateTabName = (id: string, name: string) => {
    setTabs(tabs.map((tab) => (tab.id === id ? { ...tab, name } : tab)));
  };

  const getSelectedText = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      return textarea.value.substring(start, end);
    }
    return "";
  };

  const runQuery = async (queries: string) => {
    const currentTab = tabs.find((tab) => tab.id === activeTab);
    if (!currentTab) return;

    if (queries.trim() === "") {
      alert("Please enter a SQL query to execute.");
      return;
    }

    setIsLoading(true);
    const startTime = performance.now();

    try {
      const response = await fetch("http://localhost:3000/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: queries }),
      });

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`);
      }

      const jsonRes = (await response.json()) as { result: any[][] };
      const data: any[][] = jsonRes.result;

      if (
        !Array.isArray(data) ||
        data.length === 0 ||
        !Array.isArray(data[0])
      ) {
        throw new Error("Invalid response format from server.");
      }

      const firstRow = data[0];
      let columns: Column[];
      let isErrorResponse = false;

      if (
        Array.isArray(firstRow) &&
        firstRow.length === 1 &&
        firstRow[0] === ""
      ) {
        isErrorResponse = true;
        columns = [{ name: "", type: ColumnType.UNKNOWN }];
      } else if (
        Array.isArray(firstRow) &&
        firstRow.length > 0 &&
        typeof firstRow[0] === "object" &&
        firstRow[0] !== null &&
        "type" in firstRow[0] &&
        "name" in firstRow[0]
      ) {
        columns = firstRow.map((col: any) => ({
          name: col.name,
          type: (col.type as string).toUpperCase() as ColumnType,
        }));
      } else {
        columns = firstRow.map((colName: string) => ({
          name: colName,
          type: ColumnType.UNKNOWN,
        }));
      }

      let updatedQueryResult: QueryResult;

      if (isErrorResponse && data.length >= 2) {
        updatedQueryResult = {
          columns,
          rows: [data[1]],
        };
      } else {
        updatedQueryResult = {
          columns,
          rows: data.slice(1),
        };
      }

      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === activeTab
            ? {
                ...tab,
                queryResult: updatedQueryResult,
                executionTime: performance.now() - startTime,
              }
            : tab
        )
      );

      if (columnWidths.length === 0) {
        setColumnWidths(updatedQueryResult.columns.map(() => 150));
      }

      setSortConfig(null);
    } catch (error: any) {
      console.error("Error running query:", error);
      const errorResult: QueryResult = {
        columns: [{ name: "", type: ColumnType.UNKNOWN }],
        rows: [["Failed to execute query. Please try again."]],
      };

      setTabs((prevTabs) =>
        prevTabs.map((tab) =>
          tab.id === activeTab
            ? {
                ...tab,
                queryResult: errorResult,
                executionTime: performance.now() - startTime,
              }
            : tab
        )
      );

      setSortConfig(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRunSelected = () => {
    const selectedText = getSelectedText();
    if (selectedText.trim() !== "") {
      runQuery(selectedText);
    } else {
      const currentTab = tabs.find((tab) => tab.id === activeTab);
      if (currentTab) {
        const allQueries = currentTab.content
          .split(";")
          .map((query) => query.trim())
          .filter((query) => query.length > 0)
          .join("; ");

        if (allQueries) {
          runQuery(allQueries);
        } else {
          alert("Please enter a SQL query to execute.");
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && e.ctrlKey) {
      e.preventDefault();
      handleRunSelected();
    }
  };

  const handleSort = (columnIndex: number) => {
    let direction: "asc" | "desc" = "asc";

    if (
      sortConfig &&
      sortConfig.key === columnIndex &&
      sortConfig.direction === "asc"
    ) {
      direction = "desc";
    }

    setSortConfig({ key: columnIndex, direction });

    setTabs((prevTabs) =>
      prevTabs.map((tab) => {
        if (tab.id === activeTab && tab.queryResult) {
          const sortedRows = [...tab.queryResult.rows].sort((a, b) => {
            const aVal = a[columnIndex];
            const bVal = b[columnIndex];

            if (typeof aVal === "number" && typeof bVal === "number") {
              return direction === "asc" ? aVal - bVal : bVal - aVal;
            }
            return direction === "asc"
              ? String(aVal).localeCompare(String(bVal))
              : String(bVal).localeCompare(String(aVal));
          });
          return {
            ...tab,
            queryResult: { ...tab.queryResult, rows: sortedRows },
          };
        }
        return tab;
      })
    );
  };

  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, [activeTab, tabs]);

  const currentTab = tabs.find((tab) => tab.id === activeTab)!;

  const handleMouseDown = (e: MouseEvent, index: number) => {
    resizingCol.current = index;
    startX.current = e.clientX;
    startWidth.current = columnWidths[index];

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleMouseMove = (e: globalThis.MouseEvent) => {
    if (resizingCol.current === null) return;
    const deltaX = e.clientX - startX.current;
    const newWidth = Math.max(startWidth.current + deltaX, 50);

    setColumnWidths((prevWidths) => {
      const updatedWidths = [...prevWidths];
      updatedWidths[resizingCol.current!] = newWidth;
      return updatedWidths;
    });
  };

  const handleMouseUp = () => {
    resizingCol.current = null;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseup", handleMouseUp);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case ColumnType.NUMBER:
      case ColumnType.INT:
        return <GoNumber className="text-black w-5 h-5" />;
      case ColumnType.STRING:
        return <VscSymbolKey className="text-black w-5 h-5" />;
      case ColumnType.BOOLEAN:
        return <RxComponentBoolean className="text-black w-5 h-5" />;
      case ColumnType.CONTAINER:
        return <FaComputer className="text-black w-5 h-5" />;
      case ColumnType.METADATA:
        return <BsClipboardData className="text-black w-5 h-5" />;
      case ColumnType.RUN:
        return <GoTerminal className="text-black w-5 h-5" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex min-h-screen overflow-hidden">
      <div className="flex-shrink-0 bg-white border-r border-gray-200">
        <img src="/logo.png" alt="Logo" className="h-48" />
      </div>

      <div className="flex-grow p-2">
        <div className="flex items-center border-b border-gray-200">
          {tabs.map((tab) => (
            <div key={tab.id} className="flex items-center mr-2">
              <button
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center px-4 py-2 text-sm font-medium rounded-t text-gray-800 hover:bg-gray-100`}
              >
                {activeTab === tab.id && (
                  <CheckCircle2 className="w-4 h-4 mr-2 text-[#0c9abc]" />
                )}
                {renamingTabId === tab.id ? (
                  <input
                    type="text"
                    value={tab.name}
                    onChange={(e) => updateTabName(tab.id, e.target.value)}
                    onBlur={() => setRenamingTabId(null)}
                    className="text-sm border-b border-blue-600 outline-none"
                    autoFocus
                  />
                ) : (
                  <span onDoubleClick={() => setRenamingTabId(tab.id)}>
                    {tab.name}
                  </span>
                )}
              </button>
              <button
                onClick={() => removeTab(tab.id)}
                className="text-gray-500 hover:text-gray-700 ml-1"
                title="Remove Tab"
              >
                &times;
              </button>
            </div>
          ))}
          <button
            onClick={addTab}
            className="px-4 py-2 text-gray-500 hover:text-gray-700"
            title="Add New Tab"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        <div className="mt-4 mb-2 flex justify-start">
          <Button
            onClick={handleRunSelected}
            className="bg-[#0c9abc] text-white hover:bg-[#0c9abc] disabled:bg-gray-400 flex items-center"
            disabled={isLoading}
          >
            <CiPlay1 className="mr-2 w-4 h-4" />
            {isLoading ? "Running..." : "Run Selected"}
          </Button>
        </div>

        <div className="relative font-mono text-sm border rounded">
          <textarea
            ref={textareaRef}
            className="w-full h-40 py-2 pl-[57px] pr-2 bg-transparent resize-none outline-none text-transparent z-10 text-left whitespace-pre-wrap box-border"
            style={{
              caretColor: "black",
              lineHeight: "1.5",
              fontFamily: "monospace",
              boxSizing: "border-box",
              zIndex: 10,
            }}
            value={currentTab?.content || ""}
            onChange={(e) => updateTabContent(activeTab, e.target.value)}
            onKeyDown={handleKeyDown}
            onScroll={handleScroll}
            spellCheck={false}
            autoComplete="off"
            placeholder="Write your SQL queries here..."
          />
          <pre
            ref={preRef}
            className="absolute top-0 left-0 p-2 w-full h-full overflow-hidden z-0 text-left bg-transparent pointer-events-none"
            style={{
              lineHeight: "1.5",
              fontFamily: "monospace",
              boxSizing: "border-box",
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
            }}
          >
            {currentTab?.content.split("\n").map((line, i) => (
              <div key={i} style={{ display: "flex" }}>
                <span
                  className="select-none text-gray-400 mr-2"
                  style={{
                    width: "3em",
                    textAlign: "right",
                    userSelect: "none",
                  }}
                >
                  {i + 1}
                </span>
                <span
                  dangerouslySetInnerHTML={{ __html: highlightSQL(line) }}
                  style={{ flex: 1 }}
                />
              </div>
            ))}
          </pre>
        </div>

        {currentTab?.queryResult && (
          <div className="mt-4">
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-lg font-semibold">Results:</h2>
            </div>
            <div className="border rounded-lg">
              <div className="max-h-96 overflow-auto">
                <Table className="table-auto w-full">
                  <TableHeader>
                    <TableRow>
                      {currentTab.queryResult.columns.map((column, index) => (
                        <TableHead
                          key={index}
                          className={`relative cursor-pointer font-normal text-left ${
                            index !== currentTab.queryResult!.columns.length - 1
                              ? "border-r border-gray-300"
                              : ""
                          } text-black text-[15px]`}
                          style={{
                            width: columnWidths[index] || "auto",
                            minWidth: columnWidths[index] || 50,
                          }}
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center">
                              {getTypeIcon(column.type)}
                              {column.name && (
                                <span
                                  onClick={() => handleSort(index)}
                                  className="ml-2 cursor-pointer"
                                >
                                  {column.name}
                                </span>
                              )}
                            </div>

                            {column.name && (
                              <button
                                onClick={() => handleSort(index)}
                                className="ml-2 p-1 focus:outline-none"
                                aria-label={`Sort by ${column.name}`}
                              >
                                {sortConfig?.key === index ? (
                                  sortConfig.direction === "asc" ? (
                                    <ChevronUp className="w-3 h-3" />
                                  ) : (
                                    <ChevronDownIcon className="w-3 h-3" />
                                  )
                                ) : (
                                  <ChevronDownIcon className="w-3 h-3 rotate-180" />
                                )}
                              </button>
                            )}
                          </div>

                          <div
                            onMouseDown={(e) => handleMouseDown(e, index)}
                            className="absolute right-0 top-0 h-full w-2 cursor-col-resize"
                          />
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {currentTab.queryResult.columns.length === 1 &&
                    currentTab.queryResult.columns[0].name === "" &&
                    currentTab.queryResult.rows.length > 0 ? (
                      <TableRow>
                        <TableCell
                          className="text-left"
                          colSpan={currentTab.queryResult.columns.length}
                        >
                          <div className="flex items-center text-red-500">
                            <BsExclamationOctagon className="mr-2 w-5 h-5" />
                            {currentTab.queryResult.rows[0][0]}
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      currentTab.queryResult.rows.map((row, rowIndex) => (
                        <TableRow key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <TableCell
                              key={cellIndex}
                              className={`text-left ${
                                cellIndex !==
                                currentTab.queryResult!.columns.length - 1
                                  ? "border-r border-gray-200"
                                  : ""
                              }`}
                              style={{
                                width: columnWidths[cellIndex] || "auto",
                                minWidth: columnWidths[cellIndex] || 50,
                              }}
                            >
                              {cell}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>
            {currentTab.executionTime !== null && (
              <p className="mt-2 text-sm text-gray-500 flex items-center">
                <GoClock className="mr-2 w-4 h-4" />
                {currentTab.executionTime.toFixed(0)} ms |{" "}
                {currentTab.queryResult.rows.length} row
                {currentTab.queryResult.rows.length !== 1 ? "s" : ""} returned
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
