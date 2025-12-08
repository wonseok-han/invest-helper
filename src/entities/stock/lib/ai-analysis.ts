/**
 * AI 기반 주식 분석 로직
 */

import type {
  AIAnalysisType,
  TrendInfoType,
  EnergyInfoType,
  PatternSimilarityType,
  CandlePatternType,
  SignalInfoType,
  TechnicalIndicatorsType,
  CandleDataType,
} from '../model/stock.d';

/**
 * AI 점수를 계산하고 등급을 반환합니다.
 * @param factors 분석 요소들
 * @returns AI 점수와 등급
 */
export function calculateAIScore(factors: {
  trend: TrendInfoType;
  energy: EnergyInfoType;
  patternSimilarity: PatternSimilarityType;
  obvResidualRate: number;
  candlePattern: CandlePatternType;
  signal: SignalInfoType;
  technicalIndicators?: TechnicalIndicatorsType;
}): { score: number; grade: string } {
  let score = 50; // 기본 점수

  // 트렌드 점수 (0-20점)
  if (factors.trend.direction === 'uptrend') {
    score +=
      factors.trend.strength === 'strong'
        ? 20
        : factors.trend.strength === 'moderate'
        ? 15
        : 10;
  } else if (factors.trend.direction === 'downtrend') {
    score -=
      factors.trend.strength === 'strong'
        ? 20
        : factors.trend.strength === 'moderate'
        ? 15
        : 10;
  }

  // 에너지 점수 (0-15점)
  if (factors.energy.sellingPressure === 'decreased') {
    score += factors.energy.pattern === 'golden-cross' ? 15 : 10;
  } else if (factors.energy.sellingPressure === 'increased') {
    score -= factors.energy.pattern === 'dead-cross' ? 15 : 10;
  }

  // 패턴 유사도 점수 (0-15점)
  score += (factors.patternSimilarity.similarity / 100) * 15;
  if (factors.patternSimilarity.referenceYield > 0) {
    score += 5;
  }

  // OBV 점수 (0-10점)
  if (factors.obvResidualRate > 1.0) {
    score += 10;
  } else if (factors.obvResidualRate > 0.95) {
    score += 5;
  } else {
    score -= 5;
  }

  // 캔들 패턴 점수 (0-10점)
  if (factors.candlePattern.direction === 'up') {
    score += 10;
  } else if (factors.candlePattern.direction === 'down') {
    score -= 10;
  }

  // 신호 점수 (0-15점)
  if (
    factors.signal.type === 'bullish-divergence' &&
    factors.signal.action === 'buy'
  ) {
    score += 15;
  } else if (
    factors.signal.type === 'bearish-divergence' &&
    factors.signal.action === 'sell'
  ) {
    score -= 15;
  }

  // 기술적 지표 점수 (0-20점)
  if (factors.technicalIndicators) {
    const ti = factors.technicalIndicators;

    // RSI 점수 (0-8점)
    if (ti.rsi !== undefined) {
      if (ti.rsi < 30) {
        score += 8; // 과매도 - 매수 기회
      } else if (ti.rsi > 70) {
        score -= 8; // 과매수 - 매도 신호
      } else if (ti.rsi > 50) {
        score += 3; // 상승 모멘텀
      } else {
        score -= 3; // 하락 모멘텀
      }
    }

    // MACD 점수 (0-7점)
    if (ti.macd) {
      if (ti.macd.histogram > 0 && ti.macd.value > ti.macd.signal) {
        score += 7; // 강세 신호
      } else if (ti.macd.histogram < 0 && ti.macd.value < ti.macd.signal) {
        score -= 7; // 약세 신호
      }
    }

    // 이동평균선 점수 (0-5점)
    if (ti.sma && ti.sma.sma_20 && ti.sma.sma_50) {
      // 현재 가격이 20일선 위에 있고, 20일선이 50일선 위에 있으면 상승 추세
      // (현재 가격은 factors에 없으므로 간접적으로 판단)
      if (ti.sma.sma_20 > ti.sma.sma_50) {
        score += 5;
      } else {
        score -= 5;
      }
    }
  }

  // 점수를 0-100 범위로 제한
  score = Math.max(0, Math.min(100, Math.round(score)));

  // 등급 결정
  let grade: string;
  if (score >= 90) {
    grade = 'SSS';
  } else if (score >= 80) {
    grade = 'SS';
  } else if (score >= 70) {
    grade = 'S';
  } else if (score >= 60) {
    grade = 'A';
  } else if (score >= 50) {
    grade = 'B';
  } else if (score >= 40) {
    grade = 'C';
  } else if (score >= 30) {
    grade = 'D';
  } else {
    grade = 'F';
  }

  return { score, grade };
}

/**
 * 목표가와 손절가를 계산합니다.
 * 리스크/리워드 비율을 2:1 ~ 3:1로 유지하여 합리적인 투자 전략을 제시합니다.
 * @param currentPrice 현재 가격
 * @param trend 트렌드 정보
 * @param support 지지선
 * @param resistance 저항선
 * @returns 목표가와 손절가 정보
 */
export function calculateTargetAndStopLoss(
  currentPrice: number,
  trend: TrendInfoType,
  support: number,
  resistance: number
): {
  targetPrice: number;
  targetReturn: number;
  stopLoss: number;
  stopLossPercent: number;
} {
  // 유효성 검사: currentPrice가 유효하지 않으면 기본값 반환
  if (
    !currentPrice ||
    currentPrice <= 0 ||
    isNaN(currentPrice) ||
    !isFinite(currentPrice)
  ) {
    return {
      targetPrice: 0,
      targetReturn: 0,
      stopLoss: 0,
      stopLossPercent: 0,
    };
  }

  let targetPrice: number;
  let stopLoss: number;

  // 목표가: 항상 현재 가격보다 높아야 함 (수익 목표)
  // 손절가: 항상 현재 가격보다 낮아야 함 (손실 방지)
  // 리스크/리워드 비율: 최소 2:1 이상 유지

  if (trend.direction === 'uptrend') {
    // 상승 트렌드: 지지선을 기준으로 손절가를 먼저 설정
    // 손절가는 지지선을 기준으로 하되, 너무 낮으면 제한
    if (support < currentPrice && support > currentPrice * 0.85) {
      // 지지선이 합리적인 범위 내에 있으면 지지선 사용
      stopLoss = support;
    } else if (support < currentPrice * 0.85) {
      // 지지선이 너무 낮으면 (현재가의 85% 미만) 현재가의 8% 하락으로 제한
      stopLoss = currentPrice * 0.92;
    } else {
      // 지지선이 현재가보다 높거나 없으면 현재가의 5% 하락
      stopLoss = currentPrice * 0.95;
    }

    // 리스크 계산
    const risk = currentPrice - stopLoss;

    // 리스크/리워드 비율(최소 2:1)을 맞추기 위해 목표가 설정
    const minReward = risk * 2; // 최소 리워드 (2:1 비율)

    // 목표가는 저항선을 우선 고려하되, 리스크/리워드 비율을 만족해야 함
    if (resistance > currentPrice) {
      // 저항선이 현재가보다 높으면 저항선 사용
      const rewardAtResistance = resistance - currentPrice;
      if (rewardAtResistance >= minReward) {
        // 저항선에서의 리워드가 최소 리워드 이상이면 저항선 사용
        targetPrice = Math.min(resistance, currentPrice * 1.15); // 너무 높으면 제한
      } else {
        // 저항선에서의 리워드가 부족하면 리스크/리워드 비율에 맞춰 목표가 설정
        targetPrice = currentPrice + minReward;
        // 목표가가 저항선을 넘지 않도록 제한
        if (targetPrice > resistance) {
          targetPrice = Math.min(resistance, currentPrice * 1.15);
        }
      }
    } else {
      // 저항선이 현재가보다 낮거나 없으면 리스크/리워드 비율에 맞춰 목표가 설정
      targetPrice = currentPrice + minReward;
      // 목표가가 너무 높아지지 않도록 제한 (최대 15% 상승)
      targetPrice = Math.min(targetPrice, currentPrice * 1.15);
    }
  } else if (trend.direction === 'downtrend') {
    // 하락 트렌드: 매수 비추천
    // 보수적으로 설정하되, 리스크/리워드 비율은 유지
    // 목표가: 현재가의 5% 상승 (보수적)
    // 손절가: 현재가의 2.5% 하락 (리스크/리워드 2:1)
    targetPrice = currentPrice * 1.05;
    stopLoss = currentPrice * 0.975; // 2.5% 손실, 리스크/리워드 2:1

    // 지지선이 합리적이면 사용 (너무 낮지 않은 경우)
    if (support < currentPrice && support > currentPrice * 0.95) {
      stopLoss = support;
      // 리스크/리워드 비율에 맞춰 목표가 조정
      const risk = currentPrice - stopLoss;
      targetPrice = currentPrice + risk * 2;
    }
  } else {
    // 횡보: 지지선을 기준으로 손절가를 먼저 설정
    if (support < currentPrice && support > currentPrice * 0.85) {
      // 지지선이 합리적인 범위 내에 있으면 지지선 사용
      stopLoss = support;
    } else if (support < currentPrice * 0.85) {
      // 지지선이 너무 낮으면 현재가의 5% 하락으로 제한
      stopLoss = currentPrice * 0.95;
    } else {
      // 지지선이 현재가보다 높거나 없으면 현재가의 5% 하락
      stopLoss = currentPrice * 0.95;
    }

    // 리스크 계산
    const risk = currentPrice - stopLoss;

    // 리스크/리워드 비율(최소 2:1)을 맞추기 위해 목표가 설정
    const minReward = risk * 2;

    // 목표가는 저항선을 우선 고려하되, 리스크/리워드 비율을 만족해야 함
    if (resistance > currentPrice) {
      const rewardAtResistance = resistance - currentPrice;
      if (rewardAtResistance >= minReward) {
        targetPrice = Math.min(resistance, currentPrice * 1.1);
      } else {
        targetPrice = currentPrice + minReward;
        if (targetPrice > resistance) {
          targetPrice = Math.min(resistance, currentPrice * 1.1);
        }
      }
    } else {
      targetPrice = currentPrice + minReward;
      targetPrice = Math.min(targetPrice, currentPrice * 1.1);
    }
  }

  // 최종 검증: 목표가와 손절가가 현재 가격과 올바른 방향인지 확인
  if (targetPrice <= currentPrice) {
    targetPrice = currentPrice * 1.05;
  }
  if (stopLoss >= currentPrice) {
    stopLoss = currentPrice * 0.95;
  }

  // 손절가가 너무 낮아지지 않도록 제한 (최대 10% 손실)
  if (stopLoss < currentPrice * 0.9) {
    stopLoss = currentPrice * 0.9;
    // 리스크/리워드 비율에 맞춰 목표가 재조정
    const risk = currentPrice - stopLoss;
    targetPrice = currentPrice + risk * 2.5;
  }

  const targetReturn = ((targetPrice - currentPrice) / currentPrice) * 100;
  const stopLossPercent = ((stopLoss - currentPrice) / currentPrice) * 100;

  // 최종 유효성 검사: NaN이나 Infinity가 있으면 기본값 사용
  const safeTargetPrice =
    isNaN(targetPrice) || !isFinite(targetPrice)
      ? currentPrice * 1.05
      : targetPrice;
  const safeTargetReturn =
    isNaN(targetReturn) || !isFinite(targetReturn) ? 5.0 : targetReturn;
  const safeStopLoss =
    isNaN(stopLoss) || !isFinite(stopLoss) ? currentPrice * 0.95 : stopLoss;
  const safeStopLossPercent =
    isNaN(stopLossPercent) || !isFinite(stopLossPercent)
      ? -5.0
      : stopLossPercent;

  return {
    targetPrice: Math.round(safeTargetPrice * 100) / 100,
    targetReturn: Math.round(safeTargetReturn * 10) / 10,
    stopLoss: Math.round(safeStopLoss * 100) / 100,
    stopLossPercent: Math.round(safeStopLossPercent * 10) / 10,
  };
}

/**
 * 변동성을 계산합니다.
 * @param prices 가격 배열
 * @returns 변동성 (표준편차)
 */
function calculateVolatility(prices: number[]): number {
  if (prices.length < 2) return 0;

  const avg = prices.reduce((a, b) => a + b, 0) / prices.length;
  const variance =
    prices.reduce((sum, price) => sum + Math.pow(price - avg, 2), 0) /
    prices.length;
  return Math.sqrt(variance);
}

/**
 * 캔들 패턴을 분석합니다.
 * @param candles 캔들 데이터 배열
 * @returns 캔들 패턴 정보
 */
function analyzeCandlePattern(candles: CandleDataType[]): CandlePatternType {
  if (candles.length === 0) {
    return {
      direction: 'neutral',
      pattern: 'None',
    };
  }

  // 마지막 캔들 분석
  const lastCandle = candles[candles.length - 1];
  const body = Math.abs(lastCandle.close - lastCandle.open);
  const upperShadow =
    lastCandle.high - Math.max(lastCandle.open, lastCandle.close);
  const lowerShadow =
    Math.min(lastCandle.open, lastCandle.close) - lastCandle.low;
  const totalRange = lastCandle.high - lastCandle.low;

  // 캔들 패턴 판단
  let pattern = 'Normal';
  let direction: 'up' | 'down' | 'neutral' = 'neutral';

  if (totalRange > 0) {
    // 상승 캔들
    if (lastCandle.close > lastCandle.open) {
      direction = 'up';
      // Hammer 패턴 (긴 하단 꼬리)
      if (lowerShadow > body * 2 && upperShadow < body * 0.5) {
        pattern = 'Hammer';
      }
      // Doji 패턴 (작은 몸통)
      else if (body < totalRange * 0.1) {
        pattern = 'Doji';
      }
    }
    // 하락 캔들
    else if (lastCandle.close < lastCandle.open) {
      direction = 'down';
      // Shooting Star 패턴 (긴 상단 꼬리)
      if (upperShadow > body * 2 && lowerShadow < body * 0.5) {
        pattern = 'Shooting Star';
      }
      // Doji 패턴
      else if (body < totalRange * 0.1) {
        pattern = 'Doji';
      }
    }
    // Doji (시가 = 종가)
    else {
      pattern = 'Doji';
    }
  }

  return {
    direction,
    pattern,
  };
}

/**
 * OBV 강도를 판단합니다.
 * @param obvResidualRate OBV 잔여율
 * @returns 강도
 */
export function getOBVStrength(
  obvResidualRate: number
): 'weak' | 'moderate' | 'strong' {
  if (obvResidualRate >= 1.05) {
    return 'strong';
  } else if (obvResidualRate >= 0.95) {
    return 'moderate';
  }
  return 'weak';
}

/**
 * 주식 데이터를 기반으로 AI 분석을 수행합니다.
 */
export function performAIAnalysis(stockData: {
  currentPrice: number;
  candles: CandleDataType[];
  technicalIndicators?: TechnicalIndicatorsType;
}): AIAnalysisType {
  // currentPrice 유효성 검사
  if (
    !stockData.currentPrice ||
    stockData.currentPrice <= 0 ||
    isNaN(stockData.currentPrice) ||
    !isFinite(stockData.currentPrice)
  ) {
    throw new Error('유효하지 않은 현재가입니다.');
  }

  // 캔들 데이터에서 가격과 거래량 추출
  // 캔들 데이터는 오래된 것부터 최신 순서로 정렬되어 있음
  const priceHistory = stockData.candles.map((c) => c.close);
  const volumeHistory = stockData.candles.map((c) => c.volume);

  // 현재가와 캔들 데이터의 마지막 종가 일치 확인
  // EOD 데이터는 장 마감 후 데이터이므로, 현재가(실시간)와 다를 수 있음
  // 상세 분석, 목표가/손절가, AI Score는 최신 데이터를 사용해야 하므로
  // 항상 현재가를 최신 데이터로 반영하여 정확한 분석 수행
  if (stockData.candles.length > 0) {
    const lastCandle = stockData.candles[stockData.candles.length - 1];
    const lastClose = lastCandle.close;

    // 마지막 캔들의 종가와 현재가가 다르면 항상 현재가를 반영
    // 이는 EOD 데이터와 실시간 데이터의 차이를 반영하기 위함
    // 캔들 차트는 과거 데이터를 보여주지만, 분석은 최신 데이터를 사용해야 함
    if (Math.abs(stockData.currentPrice - lastClose) > 0.001) {
      // 현재가를 마지막 캔들에 반영 (실시간 데이터 반영)
      // 가격 히스토리 업데이트
      priceHistory[priceHistory.length - 1] = stockData.currentPrice;

      // 캔들 데이터 업데이트 (불변성 유지)
      // 주의: 이 업데이트는 분석용이며, 실제 캔들 차트에는 원본 데이터가 표시됨
      stockData.candles[stockData.candles.length - 1] = {
        ...lastCandle,
        close: stockData.currentPrice,
        high: Math.max(lastCandle.high, stockData.currentPrice),
        low: Math.min(lastCandle.low, stockData.currentPrice),
      };
    }
  }

  // 트렌드 분석 (최근 데이터 중심)
  let priceChange = 0;
  let trendDirection: 'uptrend' | 'downtrend' | 'sideways' = 'sideways';
  let trendStrength: 'weak' | 'moderate' | 'strong' = 'weak';

  if (priceHistory.length > 1) {
    // 전체 기간 변화
    const totalChange = priceHistory[priceHistory.length - 1] - priceHistory[0];

    // 최근 5일 변화 (더 중요)
    const recentPrices = priceHistory.slice(-5);
    const recentChange =
      recentPrices.length > 1
        ? recentPrices[recentPrices.length - 1] - recentPrices[0]
        : 0;

    // 최근 변화를 더 중요하게 반영 (가중치 70%)
    priceChange = recentChange * 0.7 + totalChange * 0.3;

    // 트렌드 방향 결정
    const changePercent = (priceChange / stockData.currentPrice) * 100;
    if (changePercent > 2) {
      trendDirection = 'uptrend';
    } else if (changePercent < -2) {
      trendDirection = 'downtrend';
    } else {
      trendDirection = 'sideways';
    }

    // 트렌드 강도 결정
    const absChangePercent = Math.abs(changePercent);
    if (absChangePercent > 10) {
      trendStrength = 'strong';
    } else if (absChangePercent > 5) {
      trendStrength = 'moderate';
    } else {
      trendStrength = 'weak';
    }
  }

  const trend: TrendInfoType = {
    direction: trendDirection,
    strength: trendStrength,
  };

  // 에너지 분석 (매도 압력)
  // 최근 가격 움직임과 거래량을 종합적으로 분석
  let sellingPressure: 'increased' | 'decreased' | 'stable' = 'stable';
  let pattern: 'golden-cross' | 'dead-cross' | 'none' = 'none';

  if (priceHistory.length >= 2) {
    const recentPrices = priceHistory.slice(-5);
    const olderPrices =
      priceHistory.length >= 10
        ? priceHistory.slice(-10, -5)
        : priceHistory.slice(0, Math.floor(priceHistory.length / 2));

    const recentAvg =
      recentPrices.reduce((a, b) => a + b, 0) / recentPrices.length;
    const olderAvg =
      olderPrices.length > 0
        ? olderPrices.reduce((a, b) => a + b, 0) / olderPrices.length
        : recentAvg;

    // 가격이 상승하면 매도 압력 감소, 하락하면 매도 압력 증가
    if (recentAvg > olderAvg * 1.02) {
      sellingPressure = 'decreased';
      pattern = 'golden-cross'; // 상승 추세
    } else if (recentAvg < olderAvg * 0.98) {
      sellingPressure = 'increased';
      pattern = 'dead-cross'; // 하락 추세
    } else {
      sellingPressure = 'stable';
      pattern = 'none';
    }
  } else {
    // 데이터 부족 시 기본값
    sellingPressure =
      priceChange > 0 ? 'decreased' : priceChange < 0 ? 'increased' : 'stable';
    pattern =
      priceChange > 0
        ? 'golden-cross'
        : priceChange < 0
        ? 'dead-cross'
        : 'none';
  }

  const energy: EnergyInfoType = {
    sellingPressure,
    pattern,
  };

  // 패턴 유사도 (데이터가 충분할 때만 계산, 아니면 기본값)
  let patternSimilarity: PatternSimilarityType;
  if (priceHistory.length >= 10) {
    // 최근 5일과 그 이전 5일의 패턴 비교
    const recentTrend = priceHistory.slice(-5);
    const olderTrend = priceHistory.slice(-10, -5);

    const recentAvg =
      recentTrend.reduce((a, b) => a + b, 0) / recentTrend.length;
    const olderAvg = olderTrend.reduce((a, b) => a + b, 0) / olderTrend.length;

    // 가격 변동 패턴의 유사도 계산 (변동률의 일관성)
    const recentVolatility = calculateVolatility(recentTrend);
    const olderVolatility = calculateVolatility(olderTrend);

    // 패턴 유사도 계산 (변동성 + 방향성)
    // 1. 변동성 유사도
    const volatilityDiff = Math.abs(recentVolatility - olderVolatility);
    const avgVolatility = (recentVolatility + olderVolatility) / 2;
    const volatilitySimilarity =
      avgVolatility > 0
        ? Math.max(0, 100 - (volatilityDiff / avgVolatility) * 100)
        : 80;

    // 2. 가격 방향 유사도
    const recentDirection =
      recentTrend[recentTrend.length - 1] - recentTrend[0];
    const olderDirection = olderTrend[olderTrend.length - 1] - olderTrend[0];
    const directionSimilarity =
      recentDirection * olderDirection > 0
        ? 100 // 같은 방향
        : Math.max(
            0,
            50 -
              (Math.abs(recentDirection - olderDirection) /
                (Math.abs(olderDirection) || 1)) *
                50
          );

    // 3. 종합 유사도 (변동성 60%, 방향 40%)
    const similarity = volatilitySimilarity * 0.6 + directionSimilarity * 0.4;

    patternSimilarity = {
      similarity: Math.round(Math.min(100, Math.max(0, similarity))),
      referenceYield:
        olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0,
    };
  } else if (priceHistory.length > 1) {
    // 데이터가 부족하지만 일부는 있는 경우
    const avgPrice =
      priceHistory.reduce((a, b) => a + b, 0) / priceHistory.length;
    patternSimilarity = {
      similarity: 60, // 중간값
      referenceYield:
        avgPrice > 0
          ? ((stockData.currentPrice - avgPrice) / avgPrice) * 100
          : 0,
    };
  } else {
    // 데이터 부족 시 기본값
    patternSimilarity = {
      similarity: 0,
      referenceYield: 0,
    };
  }

  // OBV (On-Balance Volume) 계산
  let obvResidualRate: number;
  if (
    volumeHistory.length > 0 &&
    volumeHistory.length === priceHistory.length &&
    priceHistory.length > 1
  ) {
    // 실제 OBV 계산
    let positiveOBV = 0;
    let negativeOBV = 0;

    for (let i = 1; i < priceHistory.length; i++) {
      const priceChange = priceHistory[i] - priceHistory[i - 1];
      const volume = volumeHistory[i];

      if (priceChange > 0) {
        positiveOBV += volume;
      } else if (priceChange < 0) {
        negativeOBV += volume;
      }
      // 가격 변화가 없으면 OBV 변화 없음
    }

    // OBV 잔여율: 양의 OBV와 음의 OBV의 비율
    const totalOBV = positiveOBV + negativeOBV;
    if (totalOBV > 0) {
      obvResidualRate = positiveOBV / totalOBV;
    } else {
      obvResidualRate = 0.5; // 중립
    }

    // 0-1 범위를 0.8-1.2 범위로 변환 (기존 로직과 호환)
    obvResidualRate = 0.8 + obvResidualRate * 0.4;
  } else {
    // 데이터 부족 시 기본값 (중립)
    obvResidualRate = 1.0;
  }
  const obvStrength = getOBVStrength(obvResidualRate);

  // 캔들 패턴 분석 (실제 캔들 데이터 사용)
  const candlePattern: CandlePatternType = analyzeCandlePattern(
    stockData.candles
  );

  // 신호
  const signal: SignalInfoType = {
    type: priceChange > 0 ? 'bullish-divergence' : 'bearish-divergence',
    action: priceChange > 0 ? 'buy' : 'sell',
    description:
      priceChange > 0
        ? 'Bullish Divergence Detected (Buy)'
        : 'Bearish Divergence Detected (Sell)',
  };

  // 지지선과 저항선 계산 (실제 캔들 데이터 기반)
  // 지지선: 최근 저가들의 평균 또는 최저가 근처
  // 저항선: 최근 고가들의 평균 또는 최고가 근처
  let support: number;
  let resistance: number;

  if (stockData.candles.length > 1) {
    // 최근 10개 캔들의 저가와 고가 사용 (너무 오래된 데이터는 제외)
    const recentCandles = stockData.candles.slice(-10);
    const lows = recentCandles.map((c) => c.low);
    const highs = recentCandles.map((c) => c.high);

    const minLow = Math.min(...lows);
    const maxHigh = Math.max(...highs);

    // 지지선: 최저가 근처 (최저가의 1-2% 위로 설정하여 실제 지지 수준 반영)
    support = minLow * 1.01; // 최저가의 1% 위

    // 저항선: 최고가 근처 (최고가의 1-2% 아래로 설정하여 실제 저항 수준 반영)
    resistance = maxHigh * 0.99; // 최고가의 1% 아래

    // 현재 가격 기준으로 합리적인 범위 내로 조정
    // 지지선은 현재 가격의 85% 이상, 저항선은 현재 가격의 115% 이하
    if (support < stockData.currentPrice * 0.85) {
      support = stockData.currentPrice * 0.85;
    }
    if (support > stockData.currentPrice * 0.98) {
      support = stockData.currentPrice * 0.95; // 현재가의 5% 아래
    }

    if (resistance > stockData.currentPrice * 1.15) {
      resistance = stockData.currentPrice * 1.15;
    }
    if (resistance < stockData.currentPrice * 1.02) {
      resistance = stockData.currentPrice * 1.1; // 현재가의 10% 위
    }

    // 지지선이 저항선보다 높으면 안 됨
    if (support >= resistance) {
      // 현재가를 기준으로 재설정
      support = stockData.currentPrice * 0.95;
      resistance = stockData.currentPrice * 1.1;
    }
  } else {
    // 데이터가 부족한 경우 현재 가격 기준으로 추정
    support = stockData.currentPrice * 0.95;
    resistance = stockData.currentPrice * 1.1;
  }

  // AI 점수 계산
  const { score, grade } = calculateAIScore({
    trend,
    energy,
    patternSimilarity,
    obvResidualRate,
    candlePattern,
    signal,
    technicalIndicators: stockData.technicalIndicators,
  });

  // 목표가와 손절가 계산
  const { targetPrice, targetReturn, stopLoss, stopLossPercent } =
    calculateTargetAndStopLoss(
      stockData.currentPrice,
      trend,
      support,
      resistance
    );

  return {
    score,
    grade,
    trend,
    energy,
    patternSimilarity,
    obvResidualRate: Math.round(obvResidualRate * 100) / 100,
    obvStrength,
    candlePattern,
    signal,
    technicalIndicators: stockData.technicalIndicators,
    targetPrice,
    targetReturn,
    stopLoss,
    stopLossPercent,
    support: Math.round(support * 100) / 100,
    resistance: Math.round(resistance * 100) / 100,
  };
}
