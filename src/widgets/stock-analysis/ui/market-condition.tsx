/**
 * 시장 상황 표시 컴포넌트
 */

import type { MarketConditionType } from "@entities/stock/model/stock.d";

interface MarketConditionProps {
  market: MarketConditionType;
  dataSource?: {
    source: string;
    lastUpdated?: number;
  };
}

import { formatTimestamp } from "@shared/lib/format-timestamp";

/**
 * 시장 상황을 표시하는 컴포넌트
 */
export default function MarketCondition({
  market,
  dataSource,
}: MarketConditionProps) {
  const getVIXColor = () => {
    if (market.vix.level === "risk") {
      return "text-red-400";
    }
    if (market.vix.level === "high") {
      return "text-yellow-400";
    }
    return "text-green-400";
  };

  const getVIXLabel = () => {
    if (market.vix.level === "risk") {
      return "위험";
    }
    if (market.vix.level === "high") {
      return "높음";
    }
    if (market.vix.level === "medium") {
      return "보통";
    }
    return "낮음";
  };

  const getChangeColor = (change: number) => {
    if (change > 0) {
      return "text-green-400";
    }
    if (change < 0) {
      return "text-red-400";
    }
    return "text-gray-400";
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">VIX:</span>
          <span className={getVIXColor()}>
            {getVIXLabel()} ({market.vix.value})
          </span>
        </div>
      </div>

      {/* 주요 시장 지수 */}
      {market.marketIndices && (
        <div className="pt-2 border-t border-gray-700">
          <div className="text-xs text-gray-500 mb-2">주요 시장 지수</div>
          <div className="flex flex-wrap gap-4 text-sm">
            {market.marketIndices.sp500 && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">S&P 500:</span>
                <span className="text-white">
                  {market.marketIndices.sp500.value.toFixed(2)}
                </span>
                <span
                  className={getChangeColor(
                    market.marketIndices.sp500.changePercent
                  )}
                >
                  ({market.marketIndices.sp500.changePercent > 0 ? "+" : ""}
                  {market.marketIndices.sp500.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
            {market.marketIndices.nasdaq && (
              <div className="flex items-center gap-2">
                <span className="text-gray-400">NASDAQ:</span>
                <span className="text-white">
                  {market.marketIndices.nasdaq.value.toFixed(2)}
                </span>
                <span
                  className={getChangeColor(
                    market.marketIndices.nasdaq.changePercent
                  )}
                >
                  ({market.marketIndices.nasdaq.changePercent > 0 ? "+" : ""}
                  {market.marketIndices.nasdaq.changePercent.toFixed(2)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 데이터 소스 정보 */}
      {dataSource && (
        <div className="pt-2 border-t border-gray-700">
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
