/**
 * 상세 분석 정보 표시 컴포넌트
 */

import type { AIAnalysisType } from "@entities/stock/model/stock.d";

interface AnalysisDetailsProps {
  analysis: AIAnalysisType;
  dataSource?: {
    technicalIndicators?: {
      source: string;
      lastUpdated?: number;
    };
  };
}

import { formatTimestamp } from "@shared/lib/format-timestamp";

/**
 * 상세 분석 정보를 표시하는 컴포넌트
 */
export default function AnalysisDetails({
  analysis,
  dataSource,
}: AnalysisDetailsProps) {
  const getTrendText = () => {
    const direction =
      analysis.trend.direction === "uptrend"
        ? "상승"
        : analysis.trend.direction === "downtrend"
        ? "하락"
        : "횡보";
    const strength =
      analysis.trend.strength === "strong"
        ? "강함"
        : analysis.trend.strength === "moderate"
        ? "보통"
        : "약함";
    return `${direction} (${strength})`;
  };

  const getEnergyText = () => {
    const pressure =
      analysis.energy.sellingPressure === "decreased"
        ? "감소"
        : analysis.energy.sellingPressure === "increased"
        ? "증가"
        : "안정";
    const pattern =
      analysis.energy.pattern === "golden-cross"
        ? "Golden Cross"
        : analysis.energy.pattern === "dead-cross"
        ? "Dead Cross"
        : "없음";
    return `매도 압력 ${pressure} (${pattern})`;
  };

  const getOBVStrengthText = () => {
    if (analysis.obvStrength === "strong") {
      return "강함";
    }
    if (analysis.obvStrength === "moderate") {
      return "보통";
    }
    return "약함";
  };

  const getCandleDirection = () => {
    if (analysis.candlePattern.direction === "up") {
      return "▲";
    }
    if (analysis.candlePattern.direction === "down") {
      return "▼";
    }
    return "—";
  };

  return (
    <div className="space-y-4 text-sm">
      {/* 트렌드 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">트렌드:</span>
            <span className="text-white ml-2">{getTrendText()}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          주가의 전반적인 방향성을 나타냅니다. 상승/하락/횡보와 그 강도를
          분석합니다.
        </p>
      </div>

      {/* 에너지 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">에너지:</span>
            <span className="text-white ml-2">{getEnergyText()}</span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          매수/매도 압력을 나타냅니다. Golden Cross는 상승 신호, Dead Cross는
          하락 신호를 의미합니다.
        </p>
      </div>

      {/* 패턴 유사도 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">패턴 유사도:</span>
            <span className="text-white ml-2">
              {analysis.patternSimilarity.similarity}% (참조 수익률{" "}
              {analysis.patternSimilarity.referenceYield.toFixed(1)}%)
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          현재 가격 패턴이 과거 패턴과 얼마나 유사한지 나타냅니다. 참조 수익률은
          유사한 과거 패턴에서의 수익률입니다.
        </p>
      </div>

      {/* OBV 잔여율 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">OBV 잔여율:</span>
            <span className="text-white ml-2">
              {analysis.obvResidualRate.toFixed(2)}x ({getOBVStrengthText()})
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          거래량 기반 매수/매도 압력 지표입니다. 1.0보다 크면 매수 압력이
          강하고, 작으면 매도 압력이 강합니다.
        </p>
      </div>

      {/* 캔들 패턴 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">캔들 패턴:</span>
            <span className="text-white ml-2">
              {getCandleDirection()} {analysis.candlePattern.pattern}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          최근 캔들의 형태와 방향을 분석합니다. 상승 캔들은 매수 세력이 강함을,
          하락 캔들은 매도 세력이 강함을 나타냅니다.
        </p>
      </div>

      {/* 복합 패턴 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">복합 패턴:</span>
            <span className="text-white ml-2">
              {analysis.complexPattern || "None"}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          여러 기술적 지표를 종합하여 분석한 패턴입니다. 여러 신호가 일치할 때
          더 신뢰할 수 있습니다.
        </p>
      </div>

      {/* 신호 */}
      <div className="space-y-1">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <span className="text-gray-400">신호:</span>
            <span className="text-green-400 font-semibold ml-2">
              {analysis.signal.description}
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-500 pl-2">
          종합 분석 결과에 따른 매수/매도 신호입니다. Bullish Divergence는 매수
          기회, Bearish Divergence는 매도 신호를 의미합니다.
        </p>
      </div>

      {/* 데이터 소스 정보 */}
      {dataSource?.technicalIndicators && (
        <div className="pt-3 mt-3 border-t border-gray-700 space-y-2">
          <div className="text-xs text-gray-500">
            <div className="font-semibold mb-1">데이터 소스 정보</div>
            <div className="space-y-1">
              <div>
                기술적 지표: {dataSource.technicalIndicators.source}
                {dataSource.technicalIndicators.lastUpdated && (
                  <span className="ml-2 text-gray-600">
                    (
                    {formatTimestamp(
                      dataSource.technicalIndicators.lastUpdated
                    )}
                    )
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
