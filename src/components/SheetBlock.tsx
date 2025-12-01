import React, { useEffect, useState } from 'react';
import * as duckdb from '@duckdb/duckdb-wasm';

interface SheetBlockProps {
  code: string;
}

const SheetBlock: React.FC<SheetBlockProps> = ({ code }) => {
  const [rows, setRows] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        setLoading(true);
        setError(null);

        const bundles = duckdb.getJsDelivrBundles();
        const bundle = await duckdb.selectBundle(bundles);
        const worker = new Worker(bundle.mainWorker, { type: 'module' });
        const logger = new duckdb.ConsoleLogger();
        const db = new duckdb.AsyncDuckDB(logger, worker);
        await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

        const conn = await db.connect();

        const lines = code
          .trim()
          .split(/\r?\n/)
          .filter((l) => l.trim().length > 0);

        if (lines.length === 0) {
          setRows([]);
          setLoading(false);
          return;
        }

        const header = lines[0].split(',').map((h) => h.trim());
        const dataLines = lines.slice(1);

        await conn.query(`CREATE TABLE sheet(${header.map((h) => `${h} VARCHAR`).join(',')});`);

        for (const line of dataLines) {
          const values = line.split(',').map((v) => v.trim().replace(/'/g, "''"));
          const valuesSql = values.map((v) => `'${v}'`).join(',');
          await conn.query(`INSERT INTO sheet VALUES (${valuesSql});`);
        }

        const result = await conn.query("SELECT * FROM sheet;");
        const resultRows = result.toArray().map((row: any) => ({ ...row }));

        if (!cancelled) {
          setRows(resultRows);
        }

        await conn.close();
        await db.terminate();
      } catch (e: any) {
        if (!cancelled) {
          console.error('DuckDB sheet error', e);
          setError(e?.message ?? 'Error ejecutando DuckDB');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();

    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <div className="p-4 rounded border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Cargando hoja de clculo (DuckDB)...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 rounded border border-red-200 bg-red-50 text-sm text-red-600">
        <div className="font-semibold mb-1">Error en hoja de clculo (DuckDB):</div>
        <div className="mb-2">{error}</div>
        <pre className="text-xs whitespace-pre-wrap opacity-80">{code}</pre>
      </div>
    );
  }

  if (!rows || rows.length === 0) {
    return (
      <div className="p-4 rounded border border-slate-200 bg-slate-50 text-sm text-slate-500">
        Hoja de clculo vac o sin datos.
      </div>
    );
  }

  const columns = Object.keys(rows[0]);

  return (
    <div className="my-4 border border-slate-200 rounded-lg overflow-hidden bg-white shadow-sm">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 bg-slate-50 border-b border-slate-200">
        Hoja de clculo (DuckDB)
      </div>
      <div className="overflow-auto max-h-80">
        <table className="min-w-full text-xs">
          <thead className="bg-slate-100 border-b border-slate-200">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-semibold text-slate-600">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 text-slate-700">
                    {String((row as any)[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SheetBlock;
