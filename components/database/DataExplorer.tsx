"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/Spinner";
import { Plus, RefreshCw, Trash2, Edit2, Check, X, Filter, Search, ArrowUp, ArrowDown } from "lucide-react";

interface DataExplorerProps {
  connectionId: string;
  tableName: string;
  columns: { name: string; type: string; primary: boolean; nullable?: boolean }[];
}

export function DataExplorer({ connectionId, tableName, columns }: DataExplorerProps) {
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
  const [filterColumn, setFilterColumn] = useState<string>(columns[0]?.name || "");
  const [filterValue, setFilterValue] = useState<string>("");

  const primaryKey = columns.find(c => c.primary)?.name;

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const filters = filterColumn && filterValue ? [{ column: filterColumn, operator: "contains", value: filterValue }] : [];
      const res = await fetch(`/api/connections/${connectionId}/explorer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
            action: "read", 
            table: tableName, 
            limit: 100,
            sortColumn,
            sortOrder,
            filters
        })
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Failed to load data");
      setData(result.rows || []);
    } catch (err: any) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadData();
  }, [connectionId, tableName, sortColumn, sortOrder]);

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
      
      setEditingRowId(null);
      loadData();
    } catch (err: any) {
      setError(err.message);
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
      loadData();
    } catch (err: any) {
      setError(err.message);
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
      
      setIsAdding(false);
      setAddState({});
      loadData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const getRowId = (row: any, index: number) => {
    return primaryKey ? row[primaryKey] : `row-${index}`;
  };

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a] text-sm">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a1a1a] bg-[#0f0f0f]">
        <div className="flex items-center gap-2">
          <span className="text-[#f0f0f0] font-mono text-xs">{tableName}</span>
          <span className="text-[#666] text-xs">({data.length} records)</span>
        </div>
        
        {/* Actions & Filters */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 bg-[#141414] p-1 rounded border border-[#2a2a2a]">
            <Filter size={10} className="text-[#666] ml-1" />
            <select 
              className="bg-transparent text-xs text-[#8a8a8a] outline-none hover:text-white"
              value={filterColumn}
              onChange={(e) => setFilterColumn(e.target.value)}
            >
              {columns.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <div className="w-px h-3 bg-[#333] mx-1"></div>
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="Search..."
                className="bg-transparent text-xs text-white outline-none w-32 placeholder:text-[#555]"
                value={filterValue}
                onChange={(e) => setFilterValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && loadData()}
              />
            </div>
            <Button variant="primary" size="sm" className="h-6 px-2 text-[10px]" onClick={loadData}>Search</Button>
            {filterValue && (
                <button onClick={() => { setFilterValue(""); setTimeout(loadData, 0)}} className="text-[#666] hover:text-red-400 p-1">
                    <X size={10} />
                </button>
            )}
          </div>
          
          <div className="w-px h-4 bg-[#333]"></div>

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
      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <Spinner size={24} />
          </div>
        ) : (
          <table className="w-full text-[12px] border-collapse">
            <thead className="sticky top-0 z-10 bg-[#0f0f0f]">
              <tr className="border-b border-[#1a1a1a]">
                <th className="px-3 py-2 w-20 text-center border-r border-[#141414]">Actions</th>
                {columns.map(col => (
                  <th 
                    key={col.name} 
                    className="px-4 py-2 text-left text-[#8a8a8a] border-r border-[#141414] font-medium whitespace-nowrap cursor-pointer hover:bg-[#1a1a1a] transition-colors select-none"
                    onClick={() => {
                        if (sortColumn === col.name) {
                            if (sortOrder === 'asc') setSortOrder('desc');
                            else { setSortColumn(null); setSortOrder('asc'); }
                        } else {
                            setSortColumn(col.name);
                            setSortOrder('asc');
                        }
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      {col.primary && <span className="text-[9px] text-amber-500 bg-amber-500/10 px-1 rounded">PK</span>}
                      <span className={sortColumn === col.name ? "text-amber-400" : ""}>{col.name}</span>
                      {sortColumn === col.name && (
                        sortOrder === 'asc' ? <ArrowUp size={10} className="text-amber-500" /> : <ArrowDown size={10} className="text-amber-500" />
                      )}
                      <span className="text-[#444] font-mono text-[9px] ml-1">{col.type}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* Insert Row Form */}
              {isAdding && (
                <tr className="border-b border-[#1a1a1a] bg-[#111]">
                  <td className="px-3 py-2 text-center border-r border-[#1a1a1a]">
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
                    <td key={`add-${col.name}`} className="px-2 py-1 border-r border-[#1a1a1a]">
                      {col.primary && col.type.includes('increment') ? (
                        <span className="text-[#555] text-[10px] italic px-2">Auto</span>
                      ) : (
                        <input 
                          type="text" 
                          className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-1 text-xs text-white focus:border-amber-500 outline-none"
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
                  <tr key={rowId} className="border-b border-[#141414] hover:bg-[#111] transition-colors">
                    <td className="px-3 py-2 text-center border-r border-[#141414]">
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
                                setEditState({...row});
                                setEditingRowId(String(rowId));
                              }} className="p-1 text-[#8a8a8a] bg-[#1a1a1a] hover:bg-[#222] hover:text-white rounded border border-[#2a2a2a]" title="Edit">
                                <Edit2 size={12} />
                              </button>
                              <button onClick={() => handleDelete(row)} className="p-1 text-[#8a8a8a] bg-[#1a1a1a] hover:bg-red-950/30 hover:text-red-400 rounded border border-[#2a2a2a]" title="Delete">
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
                        <td key={col.name} className="px-4 py-2 font-mono text-[#f0f0f0] border-r border-[#141414] max-w-[250px] truncate">
                          {isEditing && col.name !== primaryKey ? (
                            <input 
                              type="text" 
                              className="w-full bg-[#1a1a1a] border border-[#333] rounded px-2 py-0.5 text-xs text-white focus:border-amber-500 outline-none"
                              value={editState[col.name] !== null ? editState[col.name] : ""}
                              onChange={e => setEditState({...editState, [col.name]: e.target.value})}
                            />
                          ) : (
                            val === null ? <span className="text-[#555] italic">null</span> : String(val)
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
              
              {data.length === 0 && !isAdding && (
                <tr>
                  <td colSpan={columns.length + 1} className="py-8 text-center text-[#666]">
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
