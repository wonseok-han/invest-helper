/**
 * Tiingo API 클라이언트
 * EOD (End of Day) 데이터 및 뉴스 제공
 */

/**
 * Tiingo EOD 데이터 타입
 */
export interface TiingoEODData {
  date: string;
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  adjClose: number;
  adjHigh: number;
  adjLow: number;
  adjOpen: number;
  adjVolume: number;
  divCash: number;
  splitFactor: number;
}

/**
 * Tiingo API 기본 URL
 */
const TIINGO_API_BASE = 'https://api.tiingo.com/tiingo';

/**
 * Tiingo API 키를 가져옵니다.
 */
function getApiKey(): string | null {
  return process.env.TIINGO_API_KEY || null;
}

/**
 * Tiingo API를 호출합니다.
 */
async function fetchTiingo<T>(
  endpoint: string,
  params?: Record<string, string>
): Promise<T> {
  const apiKey = getApiKey();

  if (!apiKey) {
    throw new Error('TIINGO_API_KEY 환경 변수가 설정되지 않았습니다.');
  }

  const queryParams = params ? new URLSearchParams(params).toString() : '';
  const url = `${TIINGO_API_BASE}${endpoint}${
    queryParams ? `?${queryParams}` : ''
  }`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Token ${apiKey}`,
    },
    next: { revalidate: 3600 }, // 1시간 캐시
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Tiingo API 오류: ${response.status} - ${errorText}`);
  }

  return response.json() as Promise<T>;
}

/**
 * 주식의 EOD (End of Day) 데이터를 가져옵니다.
 * @param symbol 주식 심볼
 * @param startDate 시작 날짜 (YYYY-MM-DD 형식)
 * @param endDate 종료 날짜 (YYYY-MM-DD 형식, 기본값: 오늘)
 */
export async function getEODData(
  symbol: string,
  startDate?: string,
  endDate?: string
): Promise<TiingoEODData[]> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const defaultStartDate =
      startDate ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split('T')[0];
    const defaultEndDate = endDate || today;

    return fetchTiingo<TiingoEODData[]>(
      `/daily/${symbol.toUpperCase()}/prices`,
      {
        startDate: defaultStartDate,
        endDate: defaultEndDate,
      }
    );
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Tiingo EOD 데이터를 가져올 수 없습니다: ${symbol}`, error);
    }
    throw error;
  }
}

/**
 * 최신 EOD 데이터에서 현재가를 가져옵니다.
 * @param symbol 주식 심볼
 * @returns 현재가와 타임스탬프, 실패 시 null
 */
export async function getCurrentPriceFromEOD(
  symbol: string
): Promise<{ price: number; timestamp: number } | null> {
  try {
    const today = new Date().toISOString().split('T')[0];
    const eodData = await getEODData(symbol, today, today);

    if (eodData && eodData.length > 0) {
      // 가장 최신 데이터 사용
      const latest = eodData[eodData.length - 1];
      const dateOnly = latest.date.split('T')[0];
      const timestamp = Math.floor(
        new Date(dateOnly + 'T16:00:00Z').getTime() / 1000
      );

      return {
        price: latest.adjClose || latest.close,
        timestamp,
      };
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(`Tiingo 현재가를 가져올 수 없습니다: ${symbol}`, error);
    }
    return null;
  }
}

/**
 * 시장 지수를 가져옵니다 (Tiingo).
 * @param symbol 지수 심볼 (예: SPY for S&P 500, QQQ for NASDAQ)
 * @returns 현재가, 변화율, 타임스탬프, 실패 시 null
 */
export async function getMarketIndexFromTiingo(
  symbol: string
): Promise<{ price: number; changePercent: number; timestamp: number } | null> {
  try {
    // 최신 EOD 데이터 가져오기
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const eodData = await getEODData(symbol, yesterday, today);

    if (eodData && eodData.length >= 2) {
      // 오늘과 어제 데이터 비교
      const todayData = eodData[eodData.length - 1];
      const yesterdayData = eodData[eodData.length - 2];

      const price = todayData.adjClose || todayData.close;
      const previousClose = yesterdayData.adjClose || yesterdayData.close;
      const changePercent =
        previousClose > 0 ? ((price - previousClose) / previousClose) * 100 : 0;

      const dateOnly = todayData.date.split('T')[0];
      const timestamp = Math.floor(
        new Date(dateOnly + 'T16:00:00Z').getTime() / 1000
      );

      return {
        price,
        changePercent,
        timestamp,
      };
    } else if (eodData && eodData.length === 1) {
      // 오늘 데이터만 있는 경우 (어제 대비 계산 불가)
      const todayData = eodData[0];
      const price = todayData.adjClose || todayData.close;
      const dateOnly = todayData.date.split('T')[0];
      const timestamp = Math.floor(
        new Date(dateOnly + 'T16:00:00Z').getTime() / 1000
      );

      return {
        price,
        changePercent: 0,
        timestamp,
      };
    }

    return null;
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.warn(
        `Tiingo에서 시장 지수를 가져올 수 없습니다: ${symbol}`,
        error
      );
    }
    return null;
  }
}
