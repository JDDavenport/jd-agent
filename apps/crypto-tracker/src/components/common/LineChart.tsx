import { useMemo } from 'react';

interface LineChartPoint {
  x: number;
  y: number;
}

interface LineChartProps {
  data: LineChartPoint[];
  height?: number;
  stroke?: string;
  fill?: string;
  valueFormatter?: (value: number) => string;
}

export default function LineChart({
  data,
  height = 200,
  stroke = '#38BDF8',
  fill = 'rgba(56, 189, 248, 0.12)',
  valueFormatter,
}: LineChartProps) {
  const viewBoxWidth = 1000;
  const viewBoxHeight = 400;
  const padding = 40;

  const points = useMemo(() => {
    if (data.length === 0) return null;

    const xs = data.map((point) => point.x);
    const ys = data.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const scaleX = (x: number) =>
      padding + ((x - minX) / (maxX - minX || 1)) * (viewBoxWidth - padding * 2);
    const scaleY = (y: number) =>
      viewBoxHeight - padding - ((y - minY) / (maxY - minY || 1)) * (viewBoxHeight - padding * 2);

    const path = data
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(point.x)} ${scaleY(point.y)}`)
      .join(' ');

    const area = `${path} L ${scaleX(maxX)} ${viewBoxHeight - padding} L ${scaleX(minX)} ${
      viewBoxHeight - padding
    } Z`;

    return {
      path,
      area,
      minY,
      maxY,
      scaleY,
    };
  }, [data]);

  if (!points) {
    return (
      <div className="h-48 flex items-center justify-center text-text-muted text-sm">
        No chart data
      </div>
    );
  }

  const topLabel = valueFormatter ? valueFormatter(points.maxY) : points.maxY.toFixed(2);
  const bottomLabel = valueFormatter ? valueFormatter(points.minY) : points.minY.toFixed(2);

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
        <path d={points.area} fill={fill} stroke="none" />
        <path d={points.path} fill="none" stroke={stroke} strokeWidth={3} />
        <text
          x={padding}
          y={padding}
          fill="rgba(148, 163, 184, 0.8)"
          fontSize="28"
          fontFamily="sans-serif"
        >
          {topLabel}
        </text>
        <text
          x={padding}
          y={viewBoxHeight - padding / 2}
          fill="rgba(148, 163, 184, 0.8)"
          fontSize="28"
          fontFamily="sans-serif"
        >
          {bottomLabel}
        </text>
      </svg>
    </div>
  );
}
