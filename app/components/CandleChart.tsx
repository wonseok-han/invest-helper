/**
 * 캔들 차트 컴포넌트
 * SVG를 사용하여 직접 캔들 차트를 렌더링합니다.
 */

"use client";

import { useState, useRef } from "react";
import type { CandleData } from "../types/stock";

interface CandleChartProps {
  candles: CandleData[];
  dataSource?: {
    source: string;
    lastUpdated?: number;
  };
}

/**
 * 날짜 포맷팅
 */
function formatDate(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp * 1000);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${month}/${day}`;
}

/**
 * 타임스탬프를 읽기 쉬운 형식으로 변환합니다.
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // 한국 시간으로 변환
  const koreaDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = koreaDate.toISOString().replace("T", " ").substring(0, 19);

  if (diffMins < 1) {
    return `방금 전 (${dateStr})`;
  } else if (diffMins < 60) {
    return `${diffMins}분 전 (${dateStr})`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전 (${dateStr})`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전 (${dateStr})`;
  } else {
    return dateStr;
  }
}

/**
 * 차트 데이터 변환
 */
function transformCandleData(candles: CandleData[]) {
  return candles.map((candle, index) => {
    const date = formatDate(candle.timestamp);
    return {
      ...candle,
      date,
      index,
      // recharts에서 사용할 데이터
      high: candle.high,
      low: candle.low,
      open: candle.open,
      close: candle.close,
    };
  });
}

/**
 * 캔들 차트를 표시하는 컴포넌트
 */
export default function CandleChart({ candles, dataSource }: CandleChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  if (!candles || candles.length === 0) {
    return null;
  }

  const chartData = transformCandleData(candles);

  // 가격 범위 계산
  const prices = candles.flatMap((c) => [c.high, c.low, c.open, c.close]);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // 차트 설정
  const chartHeight = 400;
  const chartWidth = 800;
  const padding = { top: 20, bottom: 60, left: 60, right: 20 };
  const chartAreaWidth = chartWidth - padding.left - padding.right;
  const chartAreaHeight = chartHeight - padding.top - padding.bottom;

  // 가격을 Y 좌표로 변환
  const priceToY = (price: number) => {
    const ratio = (price - minPrice) / priceRange;
    return padding.top + chartAreaHeight - ratio * chartAreaHeight;
  };

  // 인덱스를 X 좌표로 변환 (좌우 여백 추가)
  const indexToX = (index: number) => {
    // 첫 번째와 마지막 캔들에 여백을 주기 위해 사용 가능한 너비를 조정
    const horizontalPadding = 20; // 좌우 여백
    const availableWidth = chartAreaWidth - horizontalPadding * 2;
    const spacing = availableWidth / (chartData.length - 1 || 1);
    return padding.left + horizontalPadding + spacing * index;
  };

  // 마우스 이벤트 처리
  const handleMouseMove = (
    e: React.MouseEvent<SVGGElement | SVGSVGElement>,
    index: number
  ) => {
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      // 툴팁 크기 (대략적인 값)
      const tooltipWidth = 200;
      const tooltipHeight = 180;

      // 툴팁이 차트 영역을 벗어나지 않도록 조정
      let tooltipX = mouseX + 10;
      let tooltipY = mouseY - 10;

      // 오른쪽 경계 체크
      if (tooltipX + tooltipWidth > chartWidth - padding.right) {
        tooltipX = mouseX - tooltipWidth - 10; // 왼쪽으로 표시
      }

      // 왼쪽 경계 체크
      if (tooltipX < padding.left) {
        tooltipX = padding.left + 10;
      }

      // 위쪽 경계 체크
      if (tooltipY < padding.top) {
        tooltipY = padding.top + 10;
      }

      // 아래쪽 경계 체크
      if (tooltipY + tooltipHeight > chartHeight - padding.bottom) {
        tooltipY = chartHeight - padding.bottom - tooltipHeight - 10;
      }

      setTooltipPosition({
        x: tooltipX,
        y: tooltipY,
      });
    }
    setHoveredIndex(index);
  };

  const handleMouseLeave = () => {
    setHoveredIndex(null);
  };

  return (
    <div className="space-y-2">
      <div className="text-sm text-gray-400">가격 차트</div>
      <div className="w-full overflow-x-auto">
        <svg
          ref={svgRef}
          width={chartWidth}
          height={chartHeight}
          className="bg-gray-800 rounded"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 그리드 라인 */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartAreaHeight * (1 - ratio);
            const price = minPrice + priceRange * ratio;
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={padding.left + chartAreaWidth}
                  y2={y}
                  stroke="#374151"
                  strokeWidth={0.5}
                  strokeDasharray="3 3"
                  opacity={0.3}
                />
                <text
                  x={padding.left - 10}
                  y={y + 4}
                  fill="#9CA3AF"
                  fontSize="11"
                  textAnchor="end"
                >
                  ${price.toFixed(2)}
                </text>
              </g>
            );
          })}

          {/* 캔들 그리기 */}
          {chartData.map((candle, index) => {
            const x = indexToX(index);
            const isUp = candle.close >= candle.open;
            const color = isUp ? "#10B981" : "#EF4444";

            const highY = priceToY(candle.high);
            const lowY = priceToY(candle.low);
            const openY = priceToY(candle.open);
            const closeY = priceToY(candle.close);

            const candleWidth = 8;
            const bodyTop = Math.min(openY, closeY);
            const bodyBottom = Math.max(openY, closeY);
            const bodyHeight = Math.max(bodyBottom - bodyTop, 2);

            const isHovered = hoveredIndex === index;

            return (
              <g
                key={index}
                onMouseMove={(e) => handleMouseMove(e, index)}
                onMouseLeave={handleMouseLeave}
                style={{ cursor: "pointer" }}
              >
                {/* 호버 영역 (보이지 않지만 클릭 가능) */}
                <rect
                  x={x - candleWidth}
                  y={padding.top}
                  width={candleWidth * 2}
                  height={chartAreaHeight}
                  fill="transparent"
                />
                {/* 심지 */}
                <line
                  x1={x}
                  y1={highY}
                  x2={x}
                  y2={lowY}
                  stroke={color}
                  strokeWidth={isHovered ? 2 : 1.5}
                />
                {/* 캔들 몸통 */}
                <rect
                  x={x - candleWidth / 2}
                  y={bodyTop}
                  width={candleWidth}
                  height={bodyHeight}
                  fill={color}
                  stroke={color}
                  strokeWidth={isHovered ? 1 : 0.5}
                  opacity={isHovered ? 1 : 0.9}
                />
              </g>
            );
          })}

          {/* X축 날짜 라벨 */}
          {chartData.map((candle, index) => {
            const x = indexToX(index);
            // 일부 날짜만 표시 (너무 많으면 겹침)
            if (
              index % Math.ceil(chartData.length / 15) !== 0 &&
              index !== chartData.length - 1
            ) {
              return null;
            }
            return (
              <text
                key={index}
                x={x}
                y={chartHeight - padding.bottom + 20}
                fill="#9CA3AF"
                fontSize="10"
                textAnchor="middle"
                transform={`rotate(-45, ${x}, ${
                  chartHeight - padding.bottom + 20
                })`}
              >
                {candle.date}
              </text>
            );
          })}

          {/* Y축 라인 */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartAreaHeight}
            stroke="#4B5563"
            strokeWidth={1}
          />
          {/* X축 라인 */}
          <line
            x1={padding.left}
            y1={padding.top + chartAreaHeight}
            x2={padding.left + chartAreaWidth}
            y2={padding.top + chartAreaHeight}
            stroke="#4B5563"
            strokeWidth={1}
          />

          {/* 툴팁 */}
          {hoveredIndex !== null && chartData[hoveredIndex] && (
            <g>
              <foreignObject
                x={tooltipPosition.x}
                y={tooltipPosition.y}
                width="200"
                height="200"
                style={{ pointerEvents: "none" }}
              >
                <div className="bg-gray-800 border border-gray-700 rounded-lg p-3 shadow-lg">
                  <p className="text-white font-semibold mb-2">
                    {chartData[hoveredIndex].date ||
                      `캔들 #${chartData[hoveredIndex].index + 1}`}
                  </p>
                  <div className="space-y-1 text-sm">
                    <p className="text-gray-300">
                      <span className="text-gray-400">시가:</span>{" "}
                      <span className="text-white">
                        ${chartData[hoveredIndex].open.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-400">고가:</span>{" "}
                      <span className="text-green-400">
                        ${chartData[hoveredIndex].high.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-400">저가:</span>{" "}
                      <span className="text-red-400">
                        ${chartData[hoveredIndex].low.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-400">종가:</span>{" "}
                      <span
                        className={
                          chartData[hoveredIndex].close >=
                          chartData[hoveredIndex].open
                            ? "text-green-400"
                            : "text-red-400"
                        }
                      >
                        ${chartData[hoveredIndex].close.toFixed(2)}
                      </span>
                    </p>
                    <p className="text-gray-300">
                      <span className="text-gray-400">거래량:</span>{" "}
                      <span className="text-white">
                        {chartData[hoveredIndex].volume.toLocaleString()}
                      </span>
                    </p>
                  </div>
                </div>
              </foreignObject>
            </g>
          )}
        </svg>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>최저가: ${minPrice.toFixed(2)}</span>
        <span>최고가: ${maxPrice.toFixed(2)}</span>
        <span>캔들 수: {candles.length}개</span>
      </div>
      {/* 데이터 소스 정보 */}
      {dataSource && (
        <div className="pt-2 mt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 space-y-1">
            {dataSource.lastUpdated && (
              <div>기준 시간: {formatTimestamp(dataSource.lastUpdated)}</div>
            )}
            <div>데이터 소스: {dataSource.source}</div>
          </div>
        </div>
      )}
    </div>
  );
}
