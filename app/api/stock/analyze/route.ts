/**
 * 주식 분석 API 라우트
 */

import { NextResponse } from "next/server";
import type { StockAnalysis } from "@/app/types/stock";
import { performAIAnalysis } from "@/app/lib/ai-analysis";
import {
  fetchStockInfo,
  fetchPriceHistory,
  fetchMarketCondition,
} from "@/app/lib/stock-data";
import { getTechnicalIndicators } from "@/app/lib/twelve-data";

/**
 * GET /api/stock/analyze?symbol=XXX
 * 주식 심볼을 받아서 분석 결과를 반환합니다.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const symbol = searchParams.get("symbol");

    if (!symbol) {
      return NextResponse.json(
        { error: "주식 심볼이 필요합니다." },
        { status: 400 }
      );
    }

    // 여러 API를 조합하여 데이터 가져오기
    // 1. 주식 기본 정보 (Finnhub)
    const stockInfo = await fetchStockInfo(symbol);

    // 2. 병렬로 데이터 수집
    const [marketCondition, priceData, technicalIndicators] = await Promise.all(
      [
        fetchMarketCondition(),
        fetchPriceHistory(symbol, 30), // Finnhub -> Tiingo Fallback
        getTechnicalIndicators(symbol).catch(() => null), // Twelve Data (선택적)
      ]
    );

    console.log(`>> priceData: ${JSON.stringify(priceData)}`);
    console.log(
      `>> technicalIndicators: ${JSON.stringify(technicalIndicators)}`
    );
    console.log(`>> marketCondition: ${JSON.stringify(marketCondition)}`);
    console.log(`>> stockInfo: ${JSON.stringify(stockInfo)}`);

    // 가격 히스토리가 없으면 현재 가격만으로 제한된 분석 수행
    if (!priceData) {
      // currentPrice 유효성 검사
      if (
        !stockInfo.currentPrice ||
        stockInfo.currentPrice <= 0 ||
        isNaN(stockInfo.currentPrice)
      ) {
        return NextResponse.json(
          { error: "유효하지 않은 현재가입니다." },
          { status: 400 }
        );
      }

      // 현재 가격만으로 기본 분석 수행 (캔들 데이터 생성)
      const analysis = performAIAnalysis({
        currentPrice: stockInfo.currentPrice,
        candles: [
          {
            open: stockInfo.currentPrice,
            high: stockInfo.currentPrice,
            low: stockInfo.currentPrice,
            close: stockInfo.currentPrice,
            volume: 0,
            timestamp: stockInfo.lastUpdated,
          },
        ],
        technicalIndicators: technicalIndicators || undefined,
      });

      // 가격 히스토리가 없는 경우, 현재가만 사용하므로 stockInfo 소스 사용
      const targetStopLossDataSource = {
        source: stockInfo.dataSource || "Unknown",
        lastUpdated: stockInfo.lastUpdated,
      };

      const result: StockAnalysis = {
        stock: stockInfo,
        market: marketCondition,
        analysis,
        candles: [
          {
            open: stockInfo.currentPrice,
            high: stockInfo.currentPrice,
            low: stockInfo.currentPrice,
            close: stockInfo.currentPrice,
            volume: 0,
            timestamp: stockInfo.lastUpdated,
          },
        ],
        dataSource: {
          stockInfo: {
            source: stockInfo.dataSource || "Unknown",
            lastUpdated: stockInfo.lastUpdated,
          },
          priceHistory: {
            source: "Finnhub (현재가만)",
            lastUpdated: stockInfo.lastUpdated,
          },
          marketCondition: {
            source: "Finnhub",
            lastUpdated: Math.floor(Date.now() / 1000), // 현재 시간 (VIX는 실시간)
          },
          technicalIndicators: technicalIndicators
            ? {
                source: "Twelve Data",
                lastUpdated: Math.floor(Date.now() / 1000), // 현재 시간
              }
            : undefined,
          targetStopLoss: targetStopLossDataSource,
        },
      };

      return NextResponse.json(result);
    }

    // currentPrice 유효성 검사
    if (
      !stockInfo.currentPrice ||
      stockInfo.currentPrice <= 0 ||
      isNaN(stockInfo.currentPrice)
    ) {
      return NextResponse.json(
        { error: "유효하지 않은 현재가입니다." },
        { status: 400 }
      );
    }

    // AI 분석 수행 (실제 캔들 데이터 사용)
    const analysis = performAIAnalysis({
      currentPrice: stockInfo.currentPrice,
      candles: priceData.candles,
      technicalIndicators: technicalIndicators || undefined,
    });

    // 목표가/손절가 계산에 사용된 데이터 소스 결정
    // 계산에 사용되는 데이터:
    // 1. currentPrice (stockInfo) - 모든 계산의 기준점
    // 2. candles (priceHistory) - trend, support, resistance 계산에 필수
    // 3. technicalIndicators (Twelve Data) - AI 점수에만 영향 (선택적)
    //
    // candles가 가장 많이 사용되므로 priceHistory 소스를 우선시
    // 하지만 currentPrice도 중요하므로, 두 소스 중 더 최신 데이터를 사용
    const targetStopLossDataSource = (() => {
      const priceHistorySource = priceData.dataSource || "Unknown";
      const stockInfoSource = stockInfo.dataSource || "Unknown";
      const priceHistoryTimestamp = priceData.lastUpdated || 0;
      const stockInfoTimestamp = stockInfo.lastUpdated || 0;

      // 두 소스 중 더 최신 데이터를 사용
      if (priceHistoryTimestamp >= stockInfoTimestamp) {
        return {
          source: priceHistorySource,
          lastUpdated: priceHistoryTimestamp,
        };
      }
      return {
        source: stockInfoSource,
        lastUpdated: stockInfoTimestamp,
      };
    })();

    const result: StockAnalysis = {
      stock: stockInfo,
      market: marketCondition,
      analysis,
      candles: priceData.candles,
      dataSource: {
        stockInfo: {
          source: stockInfo.dataSource || "Unknown",
          lastUpdated: stockInfo.lastUpdated,
        },
        priceHistory: {
          source: priceData.dataSource || "Unknown",
          lastUpdated: priceData.lastUpdated,
        },
        marketCondition: {
          source: "Finnhub",
          lastUpdated: Math.floor(Date.now() / 1000), // 현재 시간 (VIX는 실시간)
        },
        technicalIndicators: technicalIndicators
          ? {
              source: "Twelve Data",
              lastUpdated: Math.floor(Date.now() / 1000), // 현재 시간
            }
          : undefined,
        // 목표가/손절가 계산에 사용된 데이터 소스
        targetStopLoss: targetStopLossDataSource,
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("주식 분석 오류:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "주식 분석 중 오류가 발생했습니다.";

    // 403 오류인 경우 특별한 메시지 제공
    if (errorMessage.includes("403") || errorMessage.includes("access")) {
      return NextResponse.json(
        {
          error:
            "API 접근 권한이 없습니다. 무료 플랜에서는 일부 데이터에 접근할 수 없을 수 있습니다. 시뮬레이션 데이터로 분석을 계속합니다.",
        },
        { status: 403 }
      );
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
