/**
 * 주식 데이터 가져오기 및 변환 유틸리티
 */

import {
  getQuote,
  getStockCandles,
  getCompanyProfile,
  getMarketIndex,
} from '../api/finnhub-api';
import { getEODData, getCurrentPriceFromEOD } from '../api/tiingo-api';
import { getCurrentPrice } from '../api/twelve-data-api';
import type {
  StockInfoType,
  MarketConditionType,
  CandleDataType,
} from '../model/stock.d';

/**
 * 주식 기본 정보를 가져옵니다.
 * 최신 데이터 우선순위: Twelve Data (실시간) -> Tiingo EOD (최신) -> Finnhub (2일 전, fallback)
 * @param symbol 주식 심볼
 */
export async function fetchStockInfo(symbol: string): Promise<StockInfoType> {
  // 회사 프로필은 Finnhub에서만 가져올 수 있으므로 병렬로 가져오기
  const profilePromise = getCompanyProfile(symbol).catch(() => null);

  // 현재가를 여러 소스에서 시도 (최신 데이터 우선)
  const priceSources: Array<{
    price: number;
    timestamp: number;
    source: string;
  }> = [];

  // 1. Twelve Data (실시간)
  try {
    const twelveDataPrice = await getCurrentPrice(symbol);
    if (twelveDataPrice) {
      priceSources.push({
        price: twelveDataPrice.price,
        timestamp: twelveDataPrice.timestamp,
        source: 'Twelve Data',
      });
    }
  } catch {
    // Twelve Data 실패 시 무시하고 계속 진행
  }

  // 2. Tiingo EOD (최신 일일 데이터)
  try {
    const tiingoPrice = await getCurrentPriceFromEOD(symbol);
    if (tiingoPrice) {
      priceSources.push({
        price: tiingoPrice.price,
        timestamp: tiingoPrice.timestamp,
        source: 'Tiingo (EOD)',
      });
    }
  } catch {
    // Tiingo 실패 시 무시하고 계속 진행
  }

  // 3. Finnhub (2일 전 데이터, fallback)
  try {
    const quote = await getQuote(symbol);
    priceSources.push({
      price: quote.c,
      timestamp: quote.t,
      source: 'Finnhub',
    });
  } catch {
    // Finnhub도 실패하면 에러 처리
  }

  // 가장 최신 타임스탬프를 가진 데이터 선택
  if (priceSources.length === 0) {
    throw new Error(
      `주식 정보를 가져올 수 없습니다: ${symbol}. 모든 데이터 소스 실패.`
    );
  }

  // 타임스탬프가 가장 큰 것(가장 최신) 선택
  const latestPrice = priceSources.reduce((prev, current) =>
    current.timestamp > prev.timestamp ? current : prev
  );

  // 회사 프로필 가져오기
  const profile = await profilePromise;

  // 전일 대비 변화율 계산 (Finnhub quote가 있으면 사용, 없으면 0)
  let changePercent = 0;
  try {
    const quote = await getQuote(symbol).catch(() => null);
    if (quote && quote.pc > 0) {
      changePercent = ((latestPrice.price - quote.pc) / quote.pc) * 100;
    }
  } catch {
    // 변화율 계산 실패 시 0으로 유지
  }

  return {
    symbol: symbol.toUpperCase(),
    currentPrice: latestPrice.price,
    changePercent: Math.round(changePercent * 100) / 100,
    lastUpdated: latestPrice.timestamp,
    dataSource: latestPrice.source,
    companyProfile: profile
      ? {
          name: profile.name,
          exchange: profile.exchange,
          industry: profile.finnIndustry,
          website: profile.weburl,
        }
      : undefined,
  };
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
  candles: CandleDataType[];
  lastUpdated?: number; // Unix timestamp (초 단위)
  dataSource?: string; // 데이터 소스 정보
} | null> {
  // 1차 시도: Finnhub 캔들스틱 데이터
  try {
    const now = Math.floor(Date.now() / 1000);
    const from = now - days * 24 * 60 * 60;

    const candles = await getStockCandles(symbol, 'D', from, now);

    if (candles.s === 'ok' && candles.c && candles.c.length > 0) {
      // 실제 캔들 데이터로 변환 (시가, 고가, 저가, 종가 모두 포함)
      const candleData: CandleDataType[] = candles.c.map((close, index) => ({
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
        dataSource: 'Finnhub',
      };
    }
  } catch {
    // Finnhub 실패 시 Tiingo로 Fallback
  }

  // 2차 시도: Tiingo EOD 데이터
  try {
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

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
      const candleData: CandleDataType[] = eodData.map((d) => {
        // date 필드에서 날짜 부분만 추출 (YYYY-MM-DD)
        // 실제 데이터: "2025-10-27T00:00:00.000Z" -> "2025-10-27"
        const dateOnly = d.date.split('T')[0];
        // 장 마감 시간(16:00 UTC)으로 타임스탬프 생성
        const timestamp = dateOnly
          ? Math.floor(new Date(dateOnly + 'T16:00:00Z').getTime() / 1000)
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
      const lastDate = eodData[eodData.length - 1].date.split('T')[0];
      const lastTimestamp = Math.floor(
        new Date(lastDate + 'T16:00:00Z').getTime() / 1000
      );

      return {
        candles: candleData,
        lastUpdated: lastTimestamp,
        dataSource: 'Tiingo (EOD)',
      };
    }
  } catch {
    // Tiingo도 실패한 경우
    if (process.env.NODE_ENV === 'development') {
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
/**
 * S&P 500 지수를 가져옵니다 (Finnhub만 사용).
 * @returns S&P 500 지수 값과 변화율, 실패 시 null
 */
async function getSP500(): Promise<{
  value: number;
  changePercent: number;
} | null> {
  try {
    const finnhubData = await getMarketIndex('^GSPC');
    if (finnhubData && finnhubData.pc > 0) {
      return {
        value: finnhubData.c,
        changePercent:
          ((finnhubData.c - finnhubData.pc) / finnhubData.pc) * 100,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Finnhub에서 S&P 500 지수 가져오기 실패:', error);
    }
  }

  return null;
}

/**
 * NASDAQ 지수를 가져옵니다 (Finnhub만 사용).
 * @returns NASDAQ 지수 값과 변화율, 실패 시 null
 */
async function getNASDAQ(): Promise<{
  value: number;
  changePercent: number;
} | null> {
  try {
    const finnhubData = await getMarketIndex('^IXIC');
    if (finnhubData && finnhubData.pc > 0) {
      return {
        value: finnhubData.c,
        changePercent:
          ((finnhubData.c - finnhubData.pc) / finnhubData.pc) * 100,
      };
    }
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('Finnhub에서 NASDAQ 지수 가져오기 실패:', error);
    }
  }

  return null;
}

export async function fetchMarketCondition(): Promise<MarketConditionType> {
  try {
    // 시장 지수 가져오기 (여러 소스에서 시도)
    const [sp500, nasdaq] = await Promise.all([getSP500(), getNASDAQ()]);

    const marketIndices: MarketConditionType['marketIndices'] = {};

    if (sp500) {
      marketIndices.sp500 = sp500;
    }

    if (nasdaq) {
      marketIndices.nasdaq = nasdaq;
    }

    return {
      marketIndices:
        Object.keys(marketIndices).length > 0 ? marketIndices : undefined,
    };
  } catch (error) {
    console.error('시장 상황을 가져오는 중 오류 발생', error);
    // 기본값 반환 (빈 객체)
    return {};
  }
}
