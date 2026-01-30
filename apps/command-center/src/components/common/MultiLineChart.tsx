import { useMemo } from 'react';

interface SeriesPoint {
  x: number;
  y: number;
}

interface SeriesConfig {
  label: string;
  color: string;
  data: SeriesPoint[];
}

interface MultiLineChartProps {
  series: SeriesConfig[];
  height?: number;
}

export default function MultiLineChart({ series, height = 220 }: MultiLineChartProps) {
  const viewBoxWidth = 1000;
  const viewBoxHeight = 400;
  const padding = 40;

  const normalized = useMemo(() => {
    if (series.length === 0) return null;
    const allX = series.flatMap((item) => item.data.map((point) => point.x));
    if (allX.length === 0) return null;

    const minX = Math.min(...allX);
    const maxX = Math.max(...allX);
    const scaleX = (x: number) =>
      padding + ((x - minX) / (maxX - minX || 1)) * (viewBoxWidth - padding * 2);

    return series.map((item) => {
      if (item.data.length === 0) return { ...item, path: '' };
      const ys = item.data.map((point) => point.y);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      const scaleY = (y: number) =>
        viewBoxHeight - padding - ((y - minY) / (maxY - minY || 1)) * (viewBoxHeight - padding * 2);

      const path = item.data
        .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`)
        .join(' ');

      return { ...item, path };
    });
  }, [series]);

  if (!normalized) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No chart data
      </div>
    );
  }

  return (
    <div style={{ height }} className="w-full">
      <svg viewBox={`0 0 ${viewBoxWidth} ${viewBoxHeight}`} className="w-full h-full">
        <rect
          x={padding}
          y={padding / 2}
          width={viewBoxWidth - padding * 2}
          height={viewBoxHeight - padding * 1.5}
          fill="rgba(148, 163, 184, 0.04)"
          rx={12}
        />
        {normalized.map((item) => (
          <path key={item.label} d={item.path} fill="none" stroke={item.color} strokeWidth={3} />
        ))}
      </svg>
      <div className="mt-2 flex flex-wrap gap-3 text-xs text-text-muted">
        {normalized.map((item) => (
          <span key={item.label} className="flex items-center gap-2">
            <span className="inline-block w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
            {item.label} (normalized)
          </span>
        ))}
      </div>
    </div>
  );
}
