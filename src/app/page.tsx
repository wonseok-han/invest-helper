"use client";

import { useState } from "react";
import type { StockAnalysisType } from "@entities/stock/model/stock.d";
import MarketCondition from "@widgets/stock-analysis/ui/market-condition";
import AIScore from "@widgets/stock-analysis/ui/ai-score";
import AnalysisDetails from "@widgets/stock-analysis/ui/analysis-details";
import TargetStopLoss from "@widgets/stock-analysis/ui/target-stop-loss";
import VIXWarning from "@widgets/stock-analysis/ui/vix-warning";
import CandleChart from "@widgets/stock-analysis/ui/candle-chart";

import { formatTimestamp } from "@shared/lib/format-timestamp";

/**
 * 메인 페이지 - AI 기반 주식 분석
 */
export default function Home() {
  const [symbol, setSymbol] = useState("BBAI");
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<StockAnalysisType | null>(null);
  const [error, setError] = useState<string | null>(null);

  /**
   * 주식 분석을 수행합니다.
   */
  const handleAnalyze = async () => {
    if (!symbol.trim()) {
      setError("주식 심볼을 입력해주세요.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/analyze-stock?symbol=${encodeURIComponent(symbol.trim())}`
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "분석 중 오류가 발생했습니다.");
      }

      const data: StockAnalysisType = await response.json();
      setAnalysis(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Enter 키를 눌렀을 때 분석을 수행합니다.
   */
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleAnalyze();
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* 헤더 */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold">AI 기반 주식 분석</h1>
          <p className="text-gray-400">실시간 주식 현황을 AI로 분석합니다</p>
        </div>

        {/* 검색 바 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder="주식 심볼 입력 (예: BBAI, AAPL)"
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors"
          >
            {loading ? "분석 중..." : "분석"}
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-4 bg-red-900/30 border border-red-500 rounded-lg text-red-400">
            {error}
          </div>
        )}

        {/* 분석 결과 */}
        {analysis && (
          <div className="space-y-6">
            {/* 시장 상황 */}
            <div className="p-4 bg-gray-900 rounded-lg">
              <MarketCondition
                market={analysis.market}
                dataSource={analysis.dataSource?.marketCondition}
              />
            </div>

            {/* 주식 정보 및 AI Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 주식 기본 정보 */}
              <div className="p-6 bg-gray-900 rounded-lg space-y-2">
                <div className="text-2xl font-bold">
                  {analysis.stock.symbol}
                </div>
                {analysis.stock.companyProfile && (
                  <div className="text-sm text-gray-400">
                    {analysis.stock.companyProfile.name}
                    {analysis.stock.companyProfile.exchange && (
                      <span className="ml-2">
                        ({analysis.stock.companyProfile.exchange})
                      </span>
                    )}
                  </div>
                )}
                <div className="text-3xl font-semibold">
                  ${analysis.stock.currentPrice.toFixed(2)}
                </div>
                <div
                  className={`text-sm ${
                    analysis.stock.changePercent >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {analysis.stock.changePercent >= 0 ? "+" : ""}
                  {analysis.stock.changePercent.toFixed(2)}%
                </div>
                {/* 데이터 기준 시간 및 소스 표시 */}
                {analysis.dataSource?.stockInfo && (
                  <div className="text-xs text-gray-500 pt-1 space-y-1">
                    {analysis.dataSource.stockInfo.lastUpdated && (
                      <div>
                        기준 시간:{" "}
                        {formatTimestamp(
                          analysis.dataSource.stockInfo.lastUpdated
                        )}
                      </div>
                    )}
                    <div className="text-gray-600">
                      데이터 소스: {analysis.dataSource.stockInfo.source}
                    </div>
                  </div>
                )}
                {analysis.stock.companyProfile?.industry && (
                  <div className="text-xs text-gray-500 pt-1">
                    {analysis.stock.companyProfile.industry}
                  </div>
                )}
              </div>

              {/* AI Score */}
              <div className="md:col-span-2 p-6 bg-gray-900 rounded-lg flex items-center justify-center">
                <AIScore
                  score={analysis.analysis.score}
                  grade={analysis.analysis.grade}
                />
              </div>
            </div>

            {/* 캔들 차트 */}
            {analysis.candles && analysis.candles.length > 0 && (
              <div className="p-6 bg-gray-900 rounded-lg">
                <CandleChart
                  candles={analysis.candles}
                  dataSource={analysis.dataSource?.priceHistory}
                />
              </div>
            )}

            {/* 상세 분석 정보 */}
            <div className="p-6 bg-gray-900 rounded-lg">
              <h2 className="text-xl font-semibold mb-4">상세 분석</h2>
              <AnalysisDetails
                analysis={analysis.analysis}
                dataSource={{
                  technicalIndicators: analysis.dataSource?.technicalIndicators,
                }}
              />
            </div>

            {/* 목표가 및 손절가 */}
            <div className="p-6 bg-gray-900 rounded-lg">
              <TargetStopLoss
                analysis={analysis.analysis}
                currentPrice={analysis.stock.currentPrice}
                dataSource={
                  analysis.dataSource?.targetStopLoss ||
                  analysis.dataSource?.priceHistory
                }
              />
            </div>

            {/* VIX 경고 */}
            {analysis.market.vix.level === "risk" ||
            analysis.market.vix.level === "high" ? (
              <div className="p-4 bg-yellow-900/20 border border-yellow-500 rounded-lg">
                <VIXWarning
                  vixValue={analysis.market.vix.value}
                  vixLevel={analysis.market.vix.level}
                />
              </div>
            ) : null}
          </div>
        )}

        {/* 초기 안내 메시지 */}
        {!analysis && !loading && !error && (
          <div className="text-center py-12 text-gray-400">
            <p>주식 심볼을 입력하고 분석 버튼을 클릭하세요.</p>
            <p className="text-sm mt-2">예: BBAI, AAPL, TSLA, MSFT 등</p>
          </div>
        )}
      </div>
    </div>
  );
}
