"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, RefreshCw, Trash2, Edit2, Check, X, Filter, Search, ArrowUp, ArrowDown, ChevronDown, ChevronRight } from "lucide-react";

interface DataExplorerProps {
  connectionId: string;
  tableName: string;
  columns: { name: string; type: string; primary: boolean; nullable?: boolean }[];
  onLogActivity?: (action: string, sql: string, duration: number, status: "success" | "error", errorMsg?: string) => void;
}

export function DataExplorer({ connectionId, tableName, columns, onLogActivity }: DataExplorerProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // For Editing
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editState, setEditState] = useState<any>({});
  
  // For Inserting
  const [isAdding, setIsAdding] = useState(false);
  const [addState, setAddState] = useState<any>({});

  // For Filtering & Sorting
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [activeFilters, setActiveFilters] = useState<{column: string, operator: string, value: string}[]>([]);

  // Column Resizing
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const resizingRef = useRef<{ col: string; startX: number; startWidth: number } | null>(null);

  const primaryKey = columns.find(c => c.primary)?.name;

  const [openColumnMenu, setOpenColumnMenu] = useState<string | null>(null);
  
  const handleResizeStart = (e: React.MouseEvent, colName: string) => {
    e.stopPropagation();
    const startX = e.pageX;
    const th = (e.target as HTMLElement).closest('th');
    const startWidth = th?.offsetWidth || 150;
    resizingRef.current = { col: colName, startX, startWidth };
    
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'col-resize';
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!resizingRef.current) return;
    const { col, startX, startWidth } = resizingRef.current;
    const delta = e.pageX - startX;
    setColumnWidths(prev => ({
      ...prev,
      [col]: Math.max(50, startWidth + delta)
    }));
  };

  const handleResizeEnd = () => {
    resizingRef.current = null;
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
    document.body.style.cursor = 'default';
  };

  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, []);
  
  const removeFilter = (index: number) => {
    setActiveFilters(prev => prev.filter((_, i) => i !== index));
  };

  const loadData = async () => {
    setLoading(true);
    setError(null);
    setOpenColumnMenu(null);
    try {
      const res = await fetch(`/api/connections/${connectionId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            action: "read", 
            table: tableName, 
            limit: 100,
            sortColumn,
            sortOrder,
            filters: activeFilters
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load data");
      setData(result.rows || []);
      
      if (onLogActivity && result.executedQuery) {
        onLogActivity("read", result.executedQuery, result.duration || 0, "success");
      }
    } catch (err: any) {
      setError(err.message);
      if (onLogActivity) {
        onLogActivity("read", `-- Failed to read from ${tableName}`, 0, "error", err.message);
      }
    }
    setLoading(false);
  };

  // Re-run loadData when table or sort/filters change
  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectionId, tableName, sortColumn, sortOrder, activeFilters]);

  const handleSaveEdit = async (row: any) => {
    if (!primaryKey) {
      setError("Cannot edit table without a primary key");
      return;
    }
    
    // Compute changes
    const changes: any = {};
    for (const key in editState) {
      if (editState[key] !== row[key]) {
        changes[key] = editState[key];
      }
    }
    
    if (Object.keys(changes).length === 0) {
      setEditingRowId(null);
      return;
    }

    try {
      const res = await fetch(`/api/connections/${connectionId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update",
          table: tableName,
          data: changes,
          where: { [primaryKey]: row[primaryKey] }
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      if (onLogActivity && result.executedQuery) {
        onLogActivity("update", result.executedQuery, result.duration || 0, "success");
      }
      
      setEditingRowId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
      if (onLogActivity) {
        onLogActivity("update", `-- Failed to update row in ${tableName}`, 0, "error", err.message);
      }
    }
  };

  const handleDelete = async (row: any) => {
    if (!primaryKey) {
      setError("Cannot delete from table without a primary key");
      return;
    }
    if (!confirm("Are you sure you want to delete this row?")) return;
    
    try {
      const res = await fetch(`/api/connections/${connectionId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          table: tableName,
          where: { [primaryKey]: row[primaryKey] }
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      if (onLogActivity && result.executedQuery) {
        onLogActivity("delete", result.executedQuery, result.duration || 0, "success");
      }
      
      loadData();
    } catch (err: any) {
      setError(err.message);
      if (onLogActivity) {
        onLogActivity("delete", `-- Failed to delete row from ${tableName}`, 0, "error", err.message);
      }
    }
  };

  const handleInsert = async () => {
    try {
      const res = await fetch(`/api/connections/${connectionId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "insert",
          table: tableName,
          data: addState
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error);
      
      if (onLogActivity && result.executedQuery) {
        onLogActivity("insert", result.executedQuery, result.duration || 0, "success");
      }
      
      setIsAdding(false);
      setAddState({});
      loadData();
    } catch (err: any) {
      setError(err.message);
      if (onLogActivity) {
        onLogActivity("insert", `-- Failed to insert row into ${tableName}`, 0, "error", err.message);
      }
    }
  };

  const getRowId = (row: any, index: number) => {
    return primaryKey ? row[primaryKey] : `row-${index}`;
  };

  const getOperatorLabel = (op: string) => {
    switch (op) {
      case 'eq': return '=';
      case 'neq': return '!=';
      case 'gt': return '>';
      case 'lt': return '<';
      case 'contains': return 'LIKE';
      case 'isnull': return 'IS NULL';
      case 'notnull': return 'IS NOT NULL';
      default: return op;
    }
  };

  return (
    <div className="flex flex-col h-full bg-base text-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-subtle bg-surface">
        <div className="flex items-center gap-2">
          <span className="text-primary font-mono text-xs">{tableName}</span>
          <span className="text-faint text-xs">({data.length} records)</span>
        </div>
        
        {/* Render Active Filters */}
        <div className="flex-1 flex items-center gap-2 px-4 overflow-x-auto">
          {activeFilters.map((f, i) => (
             <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded-md text-[11px] whitespace-nowrap font-mono">
               <Filter size={10} />
               <span>{f.column} {getOperatorLabel(f.operator)} {f.operator !== 'isnull' && f.operator !== 'notnull' ? `'${f.value}'` : ''}</span>
               <button onClick={() => removeFilter(i)} className="hover:text-amber-200 ml-1"><X size={10}/></button>
             </div>
          ))}
          {activeFilters.length > 0 && (
             <button onClick={() => setActiveFilters([])} className="text-faint hover:text-red-400 text-[10px] ml-1 transition-colors">
               Clear All
             </button>
          )}
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <Button variant="ghost" size="sm" icon={<RefreshCw size={12} />} onClick={loadData}>
            Refresh
          </Button>
          <Button variant="primary" size="sm" icon={<Plus size={12} />} onClick={() => setIsAdding(true)}>
            Add Record
          </Button>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-red-500/10 text-red-400 text-xs border-b border-red-500/20 break-all">
          {error}
        </div>
      )}

      {/* Data Grid */}
      <div className="flex-1 overflow-auto relative">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size={24} />
          </div>
        ) : (
          <table className="w-full text-[12px] border-collapse relative">
            <thead className="sticky top-0 z-20 bg-surface">
              <tr className="border-b border-subtle">
                <th className="px-3 py-2 w-20 text-center border-r border-subtle bg-surface">Actions</th>
                {columns.map(col => (
                  <th 
                    key={col.name} 
                    className="px-4 py-2 text-left text-muted border-r border-subtle font-medium whitespace-nowrap bg-surface relative group select-none"
                    style={{ width: columnWidths[col.name] || 'auto', minWidth: columnWidths[col.name] || '120px' }}
                  >
                    <div 
                      className="flex items-center gap-1.5 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => setOpenColumnMenu(openColumnMenu === col.name ? null : col.name)}
                    >
                      {col.primary && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">PK</span>}
                      <span className={sortColumn === col.name ? "text-amber-400" : "truncate"}>{col.name}</span>
                      {sortColumn === col.name && (
                        sortOrder === 'asc' ? <ArrowUp size={10} className="text-amber-500 ml-auto" /> : <ArrowDown size={10} className="text-amber-500 ml-auto" />
                      )}
                      {openColumnMenu === col.name ? <ChevronDown size={10} className="text-muted ml-auto" /> : <ChevronRight size={10} className="text-faint opacity-0 group-hover:opacity-100 ml-auto transition-opacity" />}
                    </div>

                    {/* Resize Handle */}
                    <div 
                      onMouseDown={(e) => handleResizeStart(e, col.name)}
                      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize group-hover:bg-white/5 active:bg-amber-500/50 transition-colors z-10"
                    />
                    
                    {/* Column Dropdown Menu */}
                    {openColumnMenu === col.name && (
                      <div className="absolute top-full left-0 mt-1 w-64 bg-elevated border border-subtle rounded-lg shadow-2xl z-50 overflow-hidden font-sans">
                        <div className="absolute top-1.5 right-1.5 z-10">
                          <button 
                            onClick={(e) => { e.stopPropagation(); setOpenColumnMenu(null); }} 
                            className="p-1 text-muted hover:text-primary rounded-full hover:bg-overlay transition-colors"
                          >
                            <X size={14} />
                          </button>
                        </div>
                        
                        {/* Sorting */}
                        <div className="p-1 border-b border-subtle pt-2">
                          <button 
                            className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:bg-overlay hover:text-primary rounded flex items-center gap-2 transition-colors pr-8"
                            onClick={() => { setSortColumn(col.name); setSortOrder('asc'); setOpenColumnMenu(null); }}
                          >
                            <ArrowUp size={12} className="text-amber-500" /> Sort Ascending
                          </button>
                          <button 
                            className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:bg-overlay hover:text-primary rounded flex items-center gap-2 transition-colors pr-8"
                            onClick={() => { setSortColumn(col.name); setSortOrder('desc'); setOpenColumnMenu(null); }}
                          >
                            <ArrowDown size={12} className="text-amber-500" /> Sort Descending
                          </button>
                        </div>
                        
                        {/* Filtering */}
                        <div className="p-4 bg-base">
                          <div className="text-[11px] font-medium text-muted mb-3 flex items-center gap-1">
                            <Filter size={10} /> Filter by value
                          </div>
                          
                          <form onSubmit={(e) => {
                            e.preventDefault();
                            const formData = new FormData(e.currentTarget);
                            const op = formData.get("operator") as string;
                            const val = formData.get("value") as string;
                            if (!op || (!val && op !== 'isnull' && op !== 'notnull')) return;
                            
                            setActiveFilters(prev => [...prev, { column: col.name, operator: op, value: val }]);
                            setOpenColumnMenu(null);
                          }}>
                            
                            <div className="space-y-2 mb-4">
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] text-faint font-medium uppercase ml-0.5">Operator</span>
                                <select 
                                  name="operator" 
                                  className="w-full bg-base border border-subtle rounded-md px-3 py-2 text-xs text-secondary outline-none focus:border-amber-500/50 transition-all cursor-pointer hover:text-primary"
                                >
                                  <option value="eq">Equals</option>
                                  <option value="neq">Not Equals</option>
                                  <option value="gt">Greater Than</option>
                                  <option value="lt">Less Than</option>
                                  <option value="contains">Contains (LIKE)</option>
                                  <option value="isnull">Is null</option>
                                  <option value="notnull">Is not null</option>
                                </select>
                              </div>
                              
                              <div className="flex flex-col gap-1.5">
                                <span className="text-[10px] text-faint font-medium uppercase ml-0.5">Value</span>
                                <input 
                                  type="text" 
                                  name="value"
                                  placeholder="Value..."
                                  className="w-full bg-base border border-subtle rounded-md px-3 py-2 text-xs text-primary placeholder:text-faint outline-none focus:border-amber-500/50 transition-all"
                                  autoFocus
                                />
                              </div>
                            </div>
                            
                            <div className="flex justify-end gap-2 border-t border-subtle pt-3">
                              <Button type="button" variant="ghost" size="sm" onClick={() => setOpenColumnMenu(null)} className="h-8 text-[11px] px-3">
                                Cancel
                              </Button>
                              <Button type="submit" variant="primary" size="sm" className="h-8 text-[11px] px-4 font-medium">
                                Apply
                              </Button>
                            </div>
                          </form>
                        </div>
                      </div>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Insert Row Form */}
              {isAdding && (
                <tr className="border-b border-subtle bg-surface">
                  <td className="px-3 py-2 text-center border-r border-subtle">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={handleInsert} className="p-1 text-green-400 hover:bg-green-400/10 rounded" title="Save">
                        <Check size={12} />
                      </button>
                      <button onClick={() => setIsAdding(false)} className="p-1 text-red-400 hover:bg-red-400/10 rounded" title="Cancel">
                        <X size={12} />
                      </button>
                    </div>
                  </td>
                  {columns.map(col => (
                    <td 
                      key={`add-${col.name}`} 
                      className="px-2 py-1 border-r border-subtle"
                      style={{ width: columnWidths[col.name] || 'auto', minWidth: columnWidths[col.name] || '120px' }}
                    >
                      {col.primary && col.type.includes('increment') ? (
                        <span className="text-faint text-[10px] italic px-2">Auto</span>
                      ) : (
                        <input 
                          type="text" 
                          className="w-full bg-elevated border border-subtle rounded px-2 py-1 text-xs text-primary focus:border-amber-500 outline-none"
                          placeholder={col.nullable ? "null" : ""}
                          value={addState[col.name] || ""}
                          onChange={e => setAddState({...addState, [col.name]: e.target.value})}
                        />
                      )}
                    </td>
                  ))}
                </tr>
              )}

              {/* Data Rows */}
              {data.map((row, i) => {
                const rowId = getRowId(row, i);
                const isEditing = editingRowId === String(rowId);

                return (
                  <tr key={rowId} className="border-b border-subtle hover:bg-surface transition-colors">
                    <td className="px-3 py-2 text-center border-r border-subtle">
                      {isEditing ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => handleSaveEdit(row)} className="p-1 text-green-400 hover:bg-green-400/10 rounded" title="Save">
                            <Check size={12} />
                          </button>
                          <button onClick={() => setEditingRowId(null)} className="p-1 text-red-400 hover:bg-red-400/10 rounded" title="Cancel">
                            <X size={12} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center gap-1 opacity-50 hover:opacity-100 transition-opacity">
                          {primaryKey && (
                            <>
                                <button onClick={() => {
                                  const safeRow = { ...row };
                                  for (const key in safeRow) {
                                    if (typeof safeRow[key] === 'object' && safeRow[key] !== null) {
                                      safeRow[key] = JSON.stringify(safeRow[key]);
                                    }
                                  }
                                  setEditState(safeRow);
                                  setEditingRowId(String(rowId));
                                }} className="p-1 text-muted bg-elevated hover:bg-overlay hover:text-primary rounded" title="Edit">
                                  <Edit2 size={12} />
                                </button>
                              <button onClick={() => handleDelete(row)} className="p-1 text-muted bg-elevated hover:bg-red-950/30 hover:text-red-400 rounded" title="Delete">
                                <Trash2 size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                    
                    {columns.map(col => {
                      const val = row[col.name];
                      return (
                        <td 
                          key={col.name} 
                          className="px-4 py-2 font-mono text-primary border-r border-subtle truncate"
                          style={{ width: columnWidths[col.name] || 'auto', minWidth: columnWidths[col.name] || '120px', maxWidth: columnWidths[col.name] || '250px' }}
                        >
                          {isEditing && col.name !== primaryKey ? (
                            <input 
                              type="text" 
                              className="w-full bg-elevated border border-subtle rounded px-2 py-0.5 text-xs text-primary focus:border-amber-500 outline-none"
                              value={editState[col.name] !== null ? editState[col.name] : ""}
                              onChange={e => setEditState({...editState, [col.name]: e.target.value})}
                            />
                          ) : (
                            val === null ? <span className="text-faint italic">null</span> : 
                            (typeof val === 'object' ? JSON.stringify(val) : String(val))
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {data.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-8 text-center text-faint">
                    No records found in this table.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
