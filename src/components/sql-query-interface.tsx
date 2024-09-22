/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Plus, CheckCircle2 } from 'lucide-react'
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const highlightSQL = (sql: string) => {
  // Escape HTML characters to prevent injection
  const escapedSql = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Define regex patterns with word boundaries for accurate matching
  const keywords = /\b(SELECT|FROM|CREATE|TABLE|INSERT|INTO|VALUES|UPDATE|DELETE|DROP|ALTER|INDEX|VIEW|LAUNCH|SHOW|NUMBER|STRING|CONTAINER)\b/gi
  const operators = /\b(\*|=|\+|-|\/|>|<|>=|<=|<>|!=|IS|NULL|AND|OR|LIKE|IN|BETWEEN|EXISTS|TABLES|WHERE)\b/gi

  // Apply syntax highlighting
  const highlighted = escapedSql
    .replace(keywords, '<span style="color: #4A90E2;">$1</span>')
    .replace(operators, '<span style="color: #D0021B;">$1</span>')

  return highlighted
}

interface Tab {
  id: string
  name: string
  content: string
  queryResult: QueryResult | null
  executionTime: number | null
}

interface QueryResult {
  columns: string[]
  rows: any[][]
}

export default function SqlQueryInterface() {
  const [tabs, setTabs] = useState<Tab[]>([
    { id: '1', name: 'New Query', content: '', queryResult: null, executionTime: null }
  ])
  const [activeTab, setActiveTab] = useState('1')
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(false) // Loading state

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)

  const addTab = () => {
    const newTab = {
      id: Date.now().toString(),
      name: `New Query`,
      content: '',
      queryResult: null,
      executionTime: null
    }
    setTabs([...tabs, newTab])
    setActiveTab(newTab.id)
  }

  const removeTab = (id: string) => {
    const newTabs = tabs.filter(tab => tab.id !== id)
    setTabs(newTabs)
    if (activeTab === id) {
      setActiveTab(newTabs.length > 0 ? newTabs[0].id : '')
    }
  }

  const updateTabContent = (id: string, content: string) => {
    setTabs(tabs.map(tab => (tab.id === id ? { ...tab, content } : tab)))
  }

  const updateTabName = (id: string, name: string) => {
    setTabs(tabs.map(tab => (tab.id === id ? { ...tab, name } : tab)))
  }

  /**
   * Retrieves the selected text within the textarea.
   * If no text is selected, returns an empty string.
   */
  const getSelectedText = () => {
    if (textareaRef.current) {
      const textarea = textareaRef.current
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      return textarea.value.substring(start, end)
    }
    return ''
  }

  /**
   * Executes the provided SQL query or queries.
   * @param queries - A string containing one or multiple SQL statements.
   */
  const runQuery = async (queries: string) => {
    const currentTab = tabs.find(tab => tab.id === activeTab)
    if (!currentTab) return // Early exit if currentTab is undefined

    if (queries.trim() === '') {
      alert('Please enter a SQL query to execute.')
      return
    }
    
    setIsLoading(true) // Start loading
    const startTime = performance.now()

    try {
      const response = await fetch('http://localhost:3000/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queries })
      })

      if (!response.ok) {
        throw new Error(`Server responded with status ${response.status}`)
      }

      const jsonRes = await response.json() as {result: any[][]}
      const data: any[][] = jsonRes.result

      if (!Array.isArray(data) || data.length === 0 || !Array.isArray(data[0])) {
        throw new Error('Invalid response format from server.')
      }

      const updatedQueryResult: QueryResult = {
        columns: data[0],
        rows: data.slice(1)
      }

      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTab ? { ...tab, queryResult: updatedQueryResult, executionTime: performance.now() - startTime } : tab
      ))
    } catch (error: any) {
      console.error('Error running query:', error)
      const errorResult: QueryResult = {
        columns: ['Error'],
        rows: [[error.message || 'Failed to execute query. Please try again.']]
      }

      setTabs(prevTabs => prevTabs.map(tab => 
        tab.id === activeTab ? { ...tab, queryResult: errorResult, executionTime: performance.now() - startTime } : tab
      ))
    } finally {
      setIsLoading(false) // End loading
    }
  }

  /**
   * Handles the "Run Selected" button click.
   * If text is selected, runs the selected statement.
   * If no text is selected, runs all statements separated by ";".
   */
  const handleRunSelected = () => {
    const selectedText = getSelectedText()
    if (selectedText.trim() !== '') {
      runQuery(selectedText)
    } else {
      // Split the content by ";" to handle multiple statements
      const currentTab = tabs.find(tab => tab.id === activeTab)
      if (currentTab) {
        const allQueries = currentTab.content
          .split(';')
          .map(query => query.trim())
          .filter(query => query.length > 0)
          .join('; ')

        if (allQueries) {
          runQuery(allQueries)
        } else {
          alert('Please enter a SQL query to execute.')
        }
      }
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault() // Prevent default behavior
      handleRunSelected()
    }
  }

  const sortColumn = (columnIndex: number) => {
    setTabs(prevTabs => prevTabs.map(tab => {
      if (tab.id === activeTab && tab.queryResult) {
        const sortedRows = [...tab.queryResult.rows].sort((a, b) => {
          const aVal = a[columnIndex]
          const bVal = b[columnIndex]
          
          // Handle different data types
          if (typeof aVal === 'number' && typeof bVal === 'number') {
            return aVal - bVal
          }
          return String(aVal).localeCompare(String(bVal))
        })
        return { ...tab, queryResult: { ...tab.queryResult, rows: sortedRows } }
      }
      return tab
    }))
  }

  // Scroll synchronization between textarea and pre
  const handleScroll = () => {
    if (preRef.current && textareaRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }

  useEffect(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop
      preRef.current.scrollLeft = textareaRef.current.scrollLeft
    }
  }, [activeTab, tabs])

  const currentTab = tabs.find(tab => tab.id === activeTab)

  return (
    <div className="container mx-auto p-4 bg-white">
      {/* Tab Navigation */}
      <div className="flex items-center border-b border-gray-200">
        {tabs.map(tab => (
          <div key={tab.id} className="flex items-center mr-2">
            <button
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-t ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {activeTab === tab.id && <CheckCircle2 className="w-4 h-4 mr-2 text-blue-600" />}
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
                <span onDoubleClick={() => setRenamingTabId(tab.id)}>{tab.name}</span>
              )}
              <span className="ml-2 text-gray-400">•</span>
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

      {/* Run Query Button */}
      <div className="mt-4 mb-2 flex justify-start">
        <Button
          onClick={handleRunSelected}
          className="bg-blue-600 text-white hover:bg-blue-700"
          disabled={isLoading} // Disable while loading
        >
          {isLoading ? 'Running...' : 'Run Selected (Ctrl+Enter)'}
          <ChevronDown className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* SQL Editor with Highlighting */}
      <div className="relative font-mono text-sm border rounded">
        <textarea
          ref={textareaRef}
          className="w-full h-40 py-2 pl-[57px] pr-2 bg-transparent resize-none outline-none text-transparent z-10 text-left whitespace-pre-wrap box-border"
          style={{
            caretColor: 'black',
            lineHeight: '1.5',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            zIndex: 10,
          }}
          value={currentTab?.content || ''}
          onChange={(e) => updateTabContent(activeTab, e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          spellCheck={false}
          autoComplete="off"
          placeholder="Write your SQL queries here..."
        />
        <pre
          ref={preRef}
          className="absolute top-0 left-0 p-2 w-full h-full overflow-auto z-0 text-left bg-transparent pointer-events-none"
          style={{
            lineHeight: '1.5',
            fontFamily: 'monospace',
            boxSizing: 'border-box',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {currentTab?.content.split('\n').map((line, i) => (
            <div key={i} style={{ display: 'flex' }}>
              <span
                className="select-none text-gray-400 mr-2"
                style={{ width: '3em', textAlign: 'right', userSelect: 'none' }}
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

      {/* Query Results */}
      {currentTab?.queryResult && (
        <div className="mt-4">
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-lg font-semibold">Raw Results</h2>
            <Button variant="outline" size="sm" disabled>
              <Plus className="h-4 w-4 mr-2" />
              Add Visualization
            </Button>
            {/* Placeholder for future visualization feature */}
          </div>
          <div className="overflow-x-auto border rounded-lg">
            <Table>
              <TableHeader>
                <TableRow className="bg-gray-100">
                  {currentTab.queryResult.columns.map((column, index) => (
                    <TableHead
                      key={index}
                      onClick={() => sortColumn(index)}
                      className="cursor-pointer font-semibold"
                    >
                      {column}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentTab.queryResult.rows.map((row, rowIndex) => (
                  <TableRow key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <TableCell key={cellIndex}>{cell}</TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {currentTab.executionTime !== null && (
            <p className="mt-2 text-sm text-gray-500">
              {currentTab.executionTime.toFixed(0)} ms | {currentTab.queryResult.rows.length} row{currentTab.queryResult.rows.length !== 1 ? 's' : ''} returned
            </p>
          )}
        </div>
      )}
    </div>
  )
}