/**
 * 목표가 및 손절가 표시 컴포넌트
 */

import type { AIAnalysis } from "../types/stock";

interface TargetStopLossProps {
  analysis: AIAnalysis;
  currentPrice: number;
  dataSource?: {
    source: string;
    lastUpdated?: number;
  };
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
 * 목표가와 손절가를 표시하는 컴포넌트
 *
 * 설명:
 * - TARGET (목표가): 매수 시 목표로 하는 매도 가격 (현재 가격 대비 수익률 표시)
 * - STOP LOSS (손절가): 손실을 막기 위해 매도할 가격 (현재 가격 대비 손실률 표시)
 * - 저항선: 가격이 올라가기 어려운 구간 (목표가의 기준이 됨)
 * - 지지선: 가격이 떨어지기 어려운 구간 (손절가의 기준이 됨)
 */
export default function TargetStopLoss({
  analysis,
  currentPrice,
  dataSource,
}: TargetStopLossProps) {
  // 안전한 값 추출 (null/undefined 체크 및 기본값 설정)
  const targetPrice =
    analysis?.targetPrice != null && !isNaN(analysis.targetPrice)
      ? analysis.targetPrice
      : currentPrice * 1.05;
  const targetReturn =
    analysis?.targetReturn != null && !isNaN(analysis.targetReturn)
      ? analysis.targetReturn
      : 5.0;
  const stopLoss =
    analysis?.stopLoss != null && !isNaN(analysis.stopLoss)
      ? analysis.stopLoss
      : currentPrice * 0.95;
  const stopLossPercent =
    analysis?.stopLossPercent != null && !isNaN(analysis.stopLossPercent)
      ? analysis.stopLossPercent
      : -5.0;
  const support =
    analysis?.support != null && !isNaN(analysis.support)
      ? analysis.support
      : currentPrice * 0.95;
  const resistance =
    analysis?.resistance != null && !isNaN(analysis.resistance)
      ? analysis.resistance
      : currentPrice * 1.1;

  return (
    <div className="space-y-6">
      {/* 현재 가격 표시 */}
      <div className="pb-4 border-b border-gray-700">
        <div className="text-sm text-gray-400 mb-1">현재 가격</div>
        <div className="text-2xl font-bold">
          $
          {currentPrice != null && !isNaN(currentPrice)
            ? currentPrice.toFixed(2)
            : "0.00"}
        </div>
      </div>

      {/* 목표가 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-400 text-sm">TARGET (목표가)</span>
            <span className="text-xs text-gray-500 mt-1">
              매수 시 목표로 하는 매도 가격
            </span>
          </div>
          <div className="text-right">
            <div className="text-green-400 font-semibold text-lg">
              ${targetPrice.toFixed(2)}
            </div>
            <div
              className={`text-sm ${
                targetReturn >= 0 ? "text-green-400" : "text-red-400"
              }`}
            >
              {targetReturn > 0 ? "+" : ""}
              {targetReturn.toFixed(1)}%
              <span className="text-gray-500 text-xs ml-1">(현재가 대비)</span>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 pl-2 pt-1 border-t border-gray-800">
          <span className="text-gray-400">기준 저항선:</span> $
          {resistance.toFixed(2)}
          <span className="text-gray-600 ml-2">
            (가격이 올라가기 어려운 구간)
          </span>
        </div>
      </div>

      {/* 손절가 */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex flex-col">
            <span className="text-gray-400 text-sm">STOP LOSS (손절가)</span>
            <span className="text-xs text-gray-500 mt-1">
              손실을 막기 위해 매도할 가격
            </span>
          </div>
          <div className="text-right">
            <div className="text-red-400 font-semibold text-lg">
              ${stopLoss.toFixed(2)}
            </div>
            <div className="text-red-400 text-sm">
              {stopLossPercent.toFixed(1)}%
              <span className="text-gray-500 text-xs ml-1">
                (현재가 대비 손실)
              </span>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500 pl-2 pt-1 border-t border-gray-800">
          <span className="text-gray-400">기준 지지선:</span> $
          {support.toFixed(2)}
          <span className="text-gray-600 ml-2">
            (가격이 떨어지기 어려운 구간)
          </span>
        </div>
      </div>

      {/* 데이터 소스 정보 */}
      {dataSource && (
        <div className="pt-4 mt-4 border-t border-gray-700">
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
