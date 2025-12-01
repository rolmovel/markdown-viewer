import React, { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

// Inicialización básica de Mermaid. Evitamos configurar theme/themeVariables
// personalizados porque ciertas combinaciones están provocando un error interno
// en la librería (d3/mermaid) en el bundle de producción.
mermaid.initialize({
  startOnLoad: false,
  securityLevel: 'loose',
});

interface MermaidProps {
  chart: string;
}

const Mermaid: React.FC<MermaidProps> = ({ chart }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const renderChart = async () => {
      if (!containerRef.current) return;
      
      try {
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, chart);
        setSvg(svg);
        setError(null);
      } catch (err) {
        console.error('Mermaid render error:', err);
        // Mermaid a veces deja basura en el DOM si falla
        setError('Error al renderizar diagrama');
      }
    };

    if (chart) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="p-4 bg-red-50 text-red-600 rounded border border-red-200 text-sm">
        <p className="font-semibold">Error en diagrama Mermaid:</p>
        <pre className="mt-1 whitespace-pre-wrap">{error}</pre>
        <pre className="mt-2 text-xs opacity-75">{chart}</pre>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className="mermaid py-4 flex justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};

export default Mermaid;
