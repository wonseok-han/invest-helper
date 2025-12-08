/**
 * Twelve Data API 클라이언트
 * 기술적 지표 (MACD, RSI 등) 제공
 */

/**
 * Twelve Data 기술적 지표 타입
 */
export interface TechnicalIndicators {
  /** RSI (Relative Strength Index) */
  rsi?: number;
  /** MACD (Moving Average Convergence Divergence) */
  macd?: {
    value: number;
    signal: number;
    histogram: number;
  };
  /** 이동평균선 */
  sma?: {
    sma_20?: number;
    sma_50?: number;
    sma_200?: number;
  };
  /** 볼린저 밴드 */
  bb?: {
    upper: number;
    middle: number;
    lower: number;
  };
}

/**
 * Twelve Data API 기본 URL
 */
const TWELVE_DATA_API_BASE = "https://api.twelvedata.com";

/**
 * Twelve Data API 키를 가져옵니다.
 */
function getApiKey(): string | null {
  return process.env.TWELVE_DATA_API_KEY || null;
}

/**
 * Twelve Data API를 호출합니다.
 */
async function fetchTwelveData<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error("TWELVE_DATA_API_KEY 환경 변수가 설정되지 않았습니다.");
  }

  const queryParams = new URLSearchParams({
    ...params,
    apikey: apiKey,
  });

  const url = `${TWELVE_DATA_API_BASE}${endpoint}?${queryParams.toString()}`;

  const response = await fetch(url, {
    next: { revalidate: 300 }, // 5분 캐시
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twelve Data API 오류: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  // Twelve Data는 에러 시 { status: "error", message: "..." } 형태로 반환
  if (data.status === "error") {
    throw new Error(
      `Twelve Data API 오류: ${data.message || "알 수 없는 오류"}`
    );
  }

  return data as T;
}

/**
 * RSI (Relative Strength Index)를 가져옵니다.
 * @param symbol 주식 심볼
 * @param interval 시간 간격 (1min, 5min, 15min, 30min, 45min, 1h, 2h, 4h, 1day, 1week, 1month)
 */
export async function getRSI(
  symbol: string,
  interval: string = "1day"
): Promise<number | null> {
  try {
    const data = await fetchTwelveData<{ values: Array<{ rsi: string }> }>(
      "/rsi",
      {
        symbol: symbol.toUpperCase(),
        interval,
        time_period: "14",
        series_type: "close",
      }
    );

    if (data.values && data.values.length > 0) {
      const rsi = parseFloat(data.values[0].rsi);
      return isNaN(rsi) ? null : rsi;
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`RSI를 가져올 수 없습니다: ${symbol}`, error);
    }
    return null;
  }
}

/**
 * MACD를 가져옵니다.
 * @param symbol 주식 심볼
 * @param interval 시간 간격
 */
export async function getMACD(
  symbol: string,
  interval: string = "1day"
): Promise<{ value: number; signal: number; histogram: number } | null> {
  try {
    const data = await fetchTwelveData<{
      values: Array<{
        macd: string;
        macd_signal: string;
        macd_hist: string;
      }>;
    }>("/macd", {
      symbol: symbol.toUpperCase(),
      interval,
      series_type: "close",
    });

    if (data.values && data.values.length > 0) {
      const value = parseFloat(data.values[0].macd);
      const signal = parseFloat(data.values[0].macd_signal);
      const histogram = parseFloat(data.values[0].macd_hist);

      if (!isNaN(value) && !isNaN(signal) && !isNaN(histogram)) {
        return { value, signal, histogram };
      }
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`MACD를 가져올 수 없습니다: ${symbol}`, error);
    }
    return null;
  }
}

/**
 * 이동평균선을 가져옵니다.
 * @param symbol 주식 심볼
 * @param interval 시간 간격
 */
export async function getSMA(
  symbol: string,
  interval: string = "1day"
): Promise<{ sma_20?: number; sma_50?: number; sma_200?: number } | null> {
  try {
    const [sma20, sma50, sma200] = await Promise.all([
      fetchTwelveData<{ values: Array<{ sma: string }> }>("/sma", {
        symbol: symbol.toUpperCase(),
        interval,
        time_period: "20",
        series_type: "close",
      }).catch(() => null),
      fetchTwelveData<{ values: Array<{ sma: string }> }>("/sma", {
        symbol: symbol.toUpperCase(),
        interval,
        time_period: "50",
        series_type: "close",
      }).catch(() => null),
      fetchTwelveData<{ values: Array<{ sma: string }> }>("/sma", {
        symbol: symbol.toUpperCase(),
        interval,
        time_period: "200",
        series_type: "close",
      }).catch(() => null),
    ]);

    const result: { sma_20?: number; sma_50?: number; sma_200?: number } = {};

    if (sma20?.values && sma20.values.length > 0) {
      const value = parseFloat(sma20.values[0].sma);
      if (!isNaN(value)) result.sma_20 = value;
    }

    if (sma50?.values && sma50.values.length > 0) {
      const value = parseFloat(sma50.values[0].sma);
      if (!isNaN(value)) result.sma_50 = value;
    }

    if (sma200?.values && sma200.values.length > 0) {
      const value = parseFloat(sma200.values[0].sma);
      if (!isNaN(value)) result.sma_200 = value;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`SMA를 가져올 수 없습니다: ${symbol}`, error);
    }
    return null;
  }
}

/**
 * 모든 기술적 지표를 가져옵니다.
 * @param symbol 주식 심볼
 */
export async function getTechnicalIndicators(
  symbol: string
): Promise<TechnicalIndicators> {
  const [rsi, macd, sma] = await Promise.all([
    getRSI(symbol).catch(() => null),
    getMACD(symbol).catch(() => null),
    getSMA(symbol).catch(() => null),
  ]);

  return {
    rsi: rsi || undefined,
    macd: macd || undefined,
    sma: sma || undefined,
  };
}

/**
 * 실시간 현재가를 가져옵니다.
 * @param symbol 주식 심볼
 * @returns 현재가와 타임스탬프, 실패 시 null
 */
export async function getCurrentPrice(
  symbol: string
): Promise<{ price: number; timestamp: number } | null> {
  try {
    const data = await fetchTwelveData<{
      price: string;
      timestamp?: number;
    }>("/price", {
      symbol: symbol.toUpperCase(),
    });

    if (data.price) {
      const price = parseFloat(data.price);
      if (!isNaN(price)) {
        return {
          price,
          timestamp: data.timestamp || Math.floor(Date.now() / 1000),
        };
      }
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`현재가를 가져올 수 없습니다: ${symbol}`, error);
    }
    return null;
  }
}
