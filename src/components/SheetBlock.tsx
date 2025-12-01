import React from 'react';

interface SheetBlockProps {
  code: string;
}

// Versión simplificada de SheetBlock que no depende de DuckDB ni de WebAssembly.
// Muestra simplemente el contenido de la "hoja" en bruto mientras se decide
// si se vuelve a habilitar la integración con @duckdb/duckdb-wasm.
const SheetBlock: React.FC<SheetBlockProps> = ({ code }) => {
  return (
    <div className="p-4 rounded border border-slate-200 bg-slate-50 text-sm text-slate-600 my-4">
      <div className="font-semibold mb-2">Hoja de cálculo (vista simplificada)</div>
      <pre className="text-xs whitespace-pre-wrap overflow-auto max-h-80 bg-white rounded border border-slate-200 p-3">
        {code}
      </pre>
    </div>
  );
};

export default SheetBlock;
