/**
 * 주식 분석 관련 타입 정의
 */

/** 시장 상황 정보 */
export interface MarketCondition {
  /** VIX 지수 */
  vix: {
    value: number;
    level: "low" | "medium" | "high" | "risk";
  };
  /** 주요 시장 지수 (S&P 500, NASDAQ 등) */
  marketIndices?: {
    sp500?: {
      value: number;
      changePercent: number;
    };
    nasdaq?: {
      value: number;
      changePercent: number;
    };
  };
}

/** 캔들 데이터 */
export interface CandleData {
  /** 시가 */
  open: number;
  /** 고가 */
  high: number;
  /** 저가 */
  low: number;
  /** 종가 */
  close: number;
  /** 거래량 */
  volume: number;
  /** 타임스탬프 (Unix timestamp, 초 단위) */
  timestamp?: number;
}

/** 주식 기본 정보 */
export interface StockInfo {
  /** 티커 심볼 */
  symbol: string;
  /** 현재 가격 */
  currentPrice: number;
  /** 전일 대비 변화율 */
  changePercent: number;
  /** 데이터 기준 시간 (Unix timestamp, 초 단위) */
  lastUpdated?: number;
  /** 데이터 소스 (어떤 API에서 가져왔는지) */
  dataSource?: string;
  /** 기업 프로필 정보 */
  companyProfile?: {
    name: string;
    exchange: string;
    industry?: string;
    website?: string;
  };
}

/** 트렌드 정보 */
export interface TrendInfo {
  /** 트렌드 방향 */
  direction: "uptrend" | "downtrend" | "sideways";
  /** 트렌드 강도 */
  strength: "weak" | "moderate" | "strong";
}

/** 에너지 정보 */
export interface EnergyInfo {
  /** 매도 압력 상태 */
  sellingPressure: "increased" | "decreased" | "stable";
  /** 패턴 유형 */
  pattern: "golden-cross" | "dead-cross" | "none";
}

/** 패턴 유사도 정보 */
export interface PatternSimilarity {
  /** 유사도 퍼센트 */
  similarity: number;
  /** 참조 수익률 */
  referenceYield: number;
}

/** 캔들 패턴 정보 */
export interface CandlePattern {
  /** 방향 */
  direction: "up" | "down" | "neutral";
  /** 패턴 이름 */
  pattern: string;
}

/** 신호 정보 */
export interface SignalInfo {
  /** 신호 유형 */
  type: "bullish-divergence" | "bearish-divergence" | "none";
  /** 액션 */
  action: "buy" | "sell" | "hold";
  /** 설명 */
  description: string;
}

/** 기술적 지표 */
export interface TechnicalIndicators {
  /** RSI (Relative Strength Index) - 0-100 */
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
}

/** AI 분석 결과 */
export interface AIAnalysis {
  /** AI 점수 (0-100) */
  score: number;
  /** 등급 (SSS, SS, S, A, B, C, D, F) */
  grade: string;
  /** 트렌드 정보 */
  trend: TrendInfo;
  /** 에너지 정보 */
  energy: EnergyInfo;
  /** 패턴 유사도 */
  patternSimilarity: PatternSimilarity;
  /** OBV 잔여율 */
  obvResidualRate: number;
  /** OBV 강도 */
  obvStrength: "weak" | "moderate" | "strong";
  /** 캔들 패턴 */
  candlePattern: CandlePattern;
  /** 복합 패턴 */
  complexPattern: string | null;
  /** 신호 */
  signal: SignalInfo;
  /** 기술적 지표 */
  technicalIndicators?: TechnicalIndicators;
  /** 목표가 */
  targetPrice: number;
  /** 목표가 대비 수익률 */
  targetReturn: number;
  /** 손절가 */
  stopLoss: number;
  /** 손절가 대비 손실률 */
  stopLossPercent: number;
  /** 지지선 */
  support: number;
  /** 저항선 */
  resistance: number;
}

/** 전체 주식 분석 결과 */
export interface StockAnalysis {
  /** 주식 기본 정보 */
  stock: StockInfo;
  /** 시장 상황 */
  market: MarketCondition;
  /** AI 분석 결과 */
  analysis: AIAnalysis;
  /** 캔들 데이터 (가격 히스토리) */
  candles?: CandleData[];
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
    /** 시장 상황 (VIX 등) */
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
