/** 전체 주식 분석 결과 */
export interface StockAnalysisType {
  /** 주식 기본 정보 */
  stock: StockInfoType;
  /** 시장 상황 */
  market: MarketConditionType;
  /** AI 분석 결과 */
  analysis: AIAnalysisType;
  /** 캔들 데이터 (가격 히스토리) */
  candles?: CandleDataType[];
  /** 데이터 소스 정보 */
  dataSource?: {
    /** 주식 기본 정보 (현재가, 변화율 등) */
    stockInfo?: {
      source: string; // "Finnhub"
      lastUpdated?: number; // Unix timestamp
    };
    /** 가격 히스토리 (캔들 데이터) */
    priceHistory?: {
      source: string; // "Finnhub" | "Tiingo (EOD)"
      lastUpdated?: number; // Unix timestamp
    };
    /** 시장 상황 */
    marketCondition?: {
      source: string; // "Finnhub"
      lastUpdated?: number; // Unix timestamp
    };
    /** 기술적 지표 (RSI, MACD, SMA) */
    technicalIndicators?: {
      source: string; // "Twelve Data"
      lastUpdated?: number; // Unix timestamp
    };
    /** 목표가/손절가 계산에 사용된 데이터 소스 (가장 많이 사용된 소스) */
    targetStopLoss?: {
      source: string;
      lastUpdated?: number; // Unix timestamp
    };
  };
}
