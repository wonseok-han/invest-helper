'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';

import MarketCondition from '@widgets/stock-analysis/ui/market-condition';
import AIScore from '@widgets/stock-analysis/ui/ai-score';
import AnalysisDetails from '@widgets/stock-analysis/ui/analysis-details';
import TargetStopLoss from '@widgets/stock-analysis/ui/target-stop-loss';
import CandleChart from '@widgets/stock-analysis/ui/candle-chart';

import { formatTimestamp } from '@shared/lib/format-timestamp';
import { getStockAnalysis } from '@/entities/analysis/api/analysis-api';

/**
 * 메인 페이지 - AI 기반 주식 분석
 */
export default function Home() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const urlSymbol = searchParams.get('symbol')?.toUpperCase() || '';
  const [inputSymbol, setInputSymbol] = useState(() => urlSymbol || '');

  // 쿼리에 사용할 심볼 (URL에 있는 경우만)
  const querySymbol = urlSymbol;

  /**
   * URL searchParams 업데이트
   */
  const updateSearchParams = (newSymbol: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newSymbol.trim()) {
      params.set('symbol', newSymbol.trim().toUpperCase());
    } else {
      params.delete('symbol');
    }
    router.push(`?${params.toString()}`, { scroll: false });
  };

  // TanStack Query로 데이터 페칭
  const {
    data: analysis,
    isLoading: loading,
    isFetching,
    error: queryError,
    refetch,
  } = useQuery({
    queryKey: ['stock-analysis', querySymbol],
    queryFn: () => getStockAnalysis(querySymbol),
    enabled: !!querySymbol.trim(), // 심볼이 있을 때만 실행
    staleTime: 5 * 60 * 1000, // 5분간 캐시 유지 (이 시간 내에는 재조회 안 함)
    gcTime: 10 * 60 * 1000, // 10분간 메모리 유지
  });

  const error = queryError
    ? queryError instanceof Error
      ? queryError.message
      : '알 수 없는 오류가 발생했습니다.'
    : null;

  /**
   * 분석 버튼 클릭 핸들러
   */
  const handleAnalyze = () => {
    const trimmedSymbol = inputSymbol.trim().toUpperCase();
    if (!trimmedSymbol) {
      return;
    }

    // URL 업데이트 (쿼리가 자동으로 실행됨 - queryKey가 변경되면 자동 리페치)
    updateSearchParams(trimmedSymbol);
  };

  /**
   * Enter 키를 눌렀을 때 분석을 수행합니다.
   */
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleAnalyze();
    }
  };

  /**
   * 강제로 새로운 데이터를 가져옵니다 (캐시 무시)
   */
  const handleRefresh = async () => {
    if (!querySymbol.trim()) return;

    await refetch();
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
            value={inputSymbol}
            onChange={(e) => {
              setInputSymbol(e.target.value.toUpperCase());
            }}
            onKeyDown={handleKeyDown}
            placeholder="주식 심볼 입력 (예: BBAI, AAPL)"
            className="flex-1 px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500"
          />
          <button
            onClick={handleAnalyze}
            disabled={loading}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors cursor-pointer"
          >
            {loading ? '분석 중...' : '분석'}
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
            {/* 새로고침 버튼 */}
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-400">
                {isFetching
                  ? '데이터를 가져오는 중...'
                  : '최신 데이터로 업데이트'}
              </div>
              <button
                onClick={handleRefresh}
                disabled={isFetching || loading}
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 disabled:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-50 border border-gray-700 rounded-lg text-sm font-medium transition-colors cursor-pointer"
                title="새로운 데이터 가져오기"
              >
                <svg
                  className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                {isFetching ? '새로고침 중...' : '새로고침'}
              </button>
            </div>

            {/* 시장 상황 */}
            {analysis.market.marketIndices && (
              <div className="p-4 bg-gray-900 rounded-lg">
                <MarketCondition
                  market={analysis.market}
                  dataSource={analysis.dataSource?.marketCondition}
                />
              </div>
            )}

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
                      ? 'text-green-400'
                      : 'text-red-400'
                  }`}
                >
                  {analysis.stock.changePercent >= 0 ? '+' : ''}
                  {analysis.stock.changePercent.toFixed(2)}%
                </div>
                {/* 데이터 기준 시간 및 소스 표시 */}
                {analysis.dataSource?.stockInfo && (
                  <div className="text-xs text-gray-500 pt-1 space-y-1">
                    {analysis.dataSource.stockInfo.lastUpdated && (
                      <div>
                        기준 시간:{' '}
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
