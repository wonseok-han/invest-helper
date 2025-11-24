/**
 * 주식 데이터 가져오기 및 변환 유틸리티
 */

import {
  getQuote,
  getStockCandles,
  getVIX,
  getCompanyProfile,
} from "./finnhub";
import { getEODData } from "./tiingo";
import type { StockInfo, MarketCondition, CandleData } from "../types/stock";

/**
 * 주식 기본 정보를 가져옵니다.
 * @param symbol 주식 심볼
 */
export async function fetchStockInfo(symbol: string): Promise<StockInfo> {
  try {
    const [quote, profile] = await Promise.all([
      getQuote(symbol),
      getCompanyProfile(symbol).catch(() => null), // 프로필은 실패해도 계속 진행
    ]);

    // 전일 대비 변화율 계산
    const changePercent =
      quote.pc > 0 ? ((quote.c - quote.pc) / quote.pc) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      currentPrice: quote.c,
      changePercent: Math.round(changePercent * 100) / 100,
      lastUpdated: quote.t, // Finnhub 타임스탬프 (Unix timestamp, 초 단위)
      companyProfile: profile
        ? {
            name: profile.name,
            exchange: profile.exchange,
            industry: profile.finnIndustry,
            website: profile.weburl,
          }
        : undefined,
    };
  } catch (error) {
    console.error(`주식 정보를 가져오는 중 오류 발생: ${symbol}`, error);
    throw new Error(
      `주식 정보를 가져올 수 없습니다: ${symbol}. 유효한 주식 심볼인지 확인해주세요.`
    );
  }
}

/**
 * 주식 가격 히스토리를 가져옵니다.
 * Fallback 전략: Finnhub -> Tiingo
 * @param symbol 주식 심볼
 * @param days 가져올 일수 (기본값: 30일)
 */
export async function fetchPriceHistory(
  symbol: string,
  days: number = 30
): Promise<{
  candles: CandleData[];
  lastUpdated?: number; // Unix timestamp (초 단위)
  dataSource?: string; // 데이터 소스 정보
} | null> {
  // 1차 시도: Finnhub 캔들스틱 데이터
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;

    const candles = await getStockCandles(symbol, "D", from, now);

    if (candles.s === "ok" && candles.c && candles.c.length > 0) {
      // 실제 캔들 데이터로 변환 (시가, 고가, 저가, 종가 모두 포함)
      const candleData: CandleData[] = candles.c.map((close, index) => ({
        open: candles.o[index] || close,
        high: candles.h[index] || close,
        low: candles.l[index] || close,
        close: close,
        volume: candles.v[index] || 0,
        timestamp: candles.t[index],
      }));

      // 마지막 타임스탬프 사용
      const lastTimestamp =
        candles.t && candles.t.length > 0
          ? candles.t[candles.t.length - 1]
          : now;

      return {
        candles: candleData,
        lastUpdated: lastTimestamp,
        dataSource: "Finnhub",
      };
    }
  } catch {
    // Finnhub 실패 시 Tiingo로 Fallback
  }

  // 2차 시도: Tiingo EOD 데이터
  try {
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    const eodData = await getEODData(symbol, startDate, endDate);
    console.log(`>> eodData: ${JSON.stringify(eodData)}`);

    if (eodData && eodData.length > 0) {
      // 날짜순으로 정렬 (오래된 것부터)
      // date 필드는 ISO 8601 형식 ("2025-10-27T00:00:00.000Z")
      eodData.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      // 실제 캔들 데이터로 변환
      // Tiingo EOD 데이터의 date는 ISO 8601 형식이므로 날짜 부분만 추출하여 장 마감 시간(16:00 UTC)으로 변환
      const candleData: CandleData[] = eodData.map((d) => {
        // date 필드에서 날짜 부분만 추출 (YYYY-MM-DD)
        // 실제 데이터: "2025-10-27T00:00:00.000Z" -> "2025-10-27"
        const dateOnly = d.date.split("T")[0];
        // 장 마감 시간(16:00 UTC)으로 타임스탬프 생성
        const timestamp = dateOnly
          ? Math.floor(new Date(dateOnly + "T16:00:00Z").getTime() / 1000)
          : undefined;

        // 조정된 가격(adjusted price) 사용 권장
        // 주식 분할, 배당 등을 반영하여 더 정확한 기술적 분석 가능
        // adjClose, adjHigh, adjLow, adjOpen을 사용하면 과거 데이터와의 일관성 유지
        return {
          open: d.adjOpen || d.open, // 조정된 시가 우선 사용, 없으면 일반 시가
          high: d.adjHigh || d.high, // 조정된 고가 우선 사용
          low: d.adjLow || d.low, // 조정된 저가 우선 사용
          close: d.adjClose || d.close, // 조정된 종가 우선 사용
          volume: d.adjVolume || d.volume, // 조정된 거래량 우선 사용
          timestamp,
        };
      });

      // 마지막 날짜를 타임스탬프로 변환 (EOD 데이터는 장 마감 후 업데이트)
      const lastDate = eodData[eodData.length - 1].date.split("T")[0];
      const lastTimestamp = Math.floor(
        new Date(lastDate + "T16:00:00Z").getTime() / 1000
      );

      return {
        candles: candleData,
        lastUpdated: lastTimestamp,
        dataSource: "Tiingo (EOD)",
      };
    }
  } catch {
    // Tiingo도 실패한 경우
    if (process.env.NODE_ENV === "development") {
      console.warn(
        `가격 히스토리를 가져올 수 없습니다: ${symbol}. 모든 데이터 소스 실패.`
      );
    }
  }

  return null;
}

/**
 * 시장 상황을 가져옵니다.
 */
export async function fetchMarketCondition(): Promise<MarketCondition> {
  try {
    // VIX 지수 가져오기
    const vixValue = await getVIX();

    // VIX 레벨 결정
    let vixLevel: "low" | "medium" | "high" | "risk";
    if (vixValue > 25) {
      vixLevel = "risk";
    } else if (vixValue > 20) {
      vixLevel = "high";
    } else if (vixValue > 15) {
      vixLevel = "medium";
    } else {
      vixLevel = "low";
    }

    // 무료 플랜에서는 시장 지수 접근이 제한되므로 제거
    // 유료 플랜을 사용하는 경우 아래 주석을 해제하세요
    /*
    const [sp500, nasdaq] = await Promise.all([
      getMarketIndex("^GSPC").catch(() => null), // S&P 500
      getMarketIndex("^IXIC").catch(() => null), // NASDAQ
    ]);

    const marketIndices: MarketCondition["marketIndices"] = {};

    if (sp500 && sp500.pc > 0) {
      marketIndices.sp500 = {
        value: sp500.c,
        changePercent: ((sp500.c - sp500.pc) / sp500.pc) * 100,
      };
    }

    if (nasdaq && nasdaq.pc > 0) {
      marketIndices.nasdaq = {
        value: nasdaq.c,
        changePercent: ((nasdaq.c - nasdaq.pc) / nasdaq.pc) * 100,
      };
    }
    */

    return {
      vix: {
        value: Math.round(vixValue * 10) / 10,
        level: vixLevel,
      },
      // marketIndices: Object.keys(marketIndices).length > 0 ? marketIndices : undefined,
    };
  } catch (error) {
    console.error("시장 상황을 가져오는 중 오류 발생", error);
    // 기본값 반환
    return {
      vix: {
        value: 20,
        level: "medium",
      },
    };
  }
}
