/**
 * Finnhub Stock API 클라이언트
 */

/**
 * Finnhub API 응답 타입
 */
interface FinnhubQuote {
  /** 현재 가격 */
  c: number;
  /** 최고가 */
  h: number;
  /** 최저가 */
  l: number;
  /** 시가 */
  o: number;
  /** 전일 종가 */
  pc: number;
  /** 타임스탬프 */
  t: number;
}

interface FinnhubCandle {
  /** 종가 배열 */
  c: number[];
  /** 최고가 배열 */
  h: number[];
  /** 최저가 배열 */
  l: number[];
  /** 시가 배열 */
  o: number[];
  /** 거래량 배열 */
  v: number[];
  /** 상태 */
  s: string;
  /** 타임스탬프 배열 */
  t: number[];
}

interface FinnhubCompanyProfile {
  /** 티커 심볼 */
  ticker: string;
  /** 회사명 */
  name: string;
  /** 거래소 */
  exchange: string;
  /** 산업 */
  finnIndustry: string;
  /** 웹사이트 */
  weburl: string;
  /** 로고 */
  logo: string;
}

/**
 * Finnhub API 기본 URL
 */
const FINNHUB_API_BASE = 'https://finnhub.io/api/v1';

/**
 * Finnhub API 키를 가져옵니다.
 */
function getApiKey(): string {
  const apiKey = process.env.FINNHUB_API_KEY;
  if (!apiKey) {
    throw new Error('FINNHUB_API_KEY 환경 변수가 설정되지 않았습니다.');
  }
  return apiKey;
}

/**
 * Finnhub API를 호출합니다.
 */
async function fetchFinnhub<T>(
  endpoint: string,
  params: Record<string, string>
): Promise<T> {
  const apiKey = getApiKey();
  const queryParams = new URLSearchParams({
    ...params,
    token: apiKey,
  });

  const url = `${FINNHUB_API_BASE}${endpoint}?${queryParams.toString()}`;

  const response = await fetch(url, {
    next: { revalidate: 60 }, // 60초 캐시
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Finnhub API 오류: ${response.status}`;

    try {
      const errorData = JSON.parse(errorText);
      if (errorData.error) {
        errorMessage += ` - ${errorData.error}`;
      } else {
        errorMessage += ` - ${errorText}`;
      }
    } catch {
      errorMessage += ` - ${errorText}`;
    }

    throw new Error(errorMessage);
  }

  const data = await response.json();

  // Finnhub API는 에러 시 { error: "..." } 형태로 반환
  if (data.error) {
    throw new Error(`Finnhub API 오류: ${data.error}`);
  }

  return data as T;
}

/**
 * 주식의 현재 시세를 가져옵니다.
 * @param symbol 주식 심볼 (예: AAPL, TSLA)
 */
export async function getQuote(symbol: string): Promise<FinnhubQuote> {
  return fetchFinnhub<FinnhubQuote>('/quote', {
    symbol: symbol.toUpperCase(),
  });
}

/**
 * 주식의 캔들스틱 데이터를 가져옵니다.
 * @param symbol 주식 심볼
 * @param resolution 시간 단위 (1, 5, 15, 30, 60, D, W, M)
 * @param from 시작 타임스탬프 (Unix timestamp)
 * @param to 종료 타임스탬프 (Unix timestamp)
 */
export async function getStockCandles(
  symbol: string,
  resolution: string = 'D',
  from?: number,
  to?: number
): Promise<FinnhubCandle> {
  // 기본값: 최근 30일
  const now = Math.floor(Date.now() / 1000);
  const defaultFrom = now - 30 * 24 * 60 * 60; // 30일 전

  return fetchFinnhub<FinnhubCandle>('/stock/candle', {
    symbol: symbol.toUpperCase(),
    resolution,
    from: (from || defaultFrom).toString(),
    to: (to || now).toString(),
  });
}

/**
 * 기업 프로필을 가져옵니다.
 * @param symbol 주식 심볼
 */
export async function getCompanyProfile(
  symbol: string
): Promise<FinnhubCompanyProfile | null> {
  try {
    return await fetchFinnhub<FinnhubCompanyProfile>('/stock/profile2', {
      symbol: symbol.toUpperCase(),
    });
  } catch (error) {
    // 프로필이 없는 경우 null 반환
    console.warn(`기업 프로필을 가져올 수 없습니다: ${symbol}`, error);
    return null;
  }
}

/**
 * 시장 지수를 가져옵니다.
 * @param symbol 지수 심볼 (예: ^GSPC for S&P 500)
 */
export async function getMarketIndex(
  symbol: string
): Promise<FinnhubQuote | null> {
  try {
    return await getQuote(symbol);
  } catch {
    // 무료 플랜에서는 시장 지수 접근이 제한됨
    // 개발 환경에서만 에러 로그 출력
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Finnhub에서 시장 지수를 가져올 수 없습니다: ${symbol} (무료 플랜 제한)`
      );
    }
    return null;
  }
}
