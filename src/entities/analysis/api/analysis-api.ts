import { StockAnalysisType } from '../model/analysis';

/**
 * 주식 분석 데이터를 가져옵니다.
 * @param symbol 주식 심볼
 * @returns 주식 분석 데이터
 */
export async function getStockAnalysis(
  symbol: string
): Promise<StockAnalysisType> {
  const response = await fetch(
    `/api/analyze-stock?symbol=${encodeURIComponent(symbol)}`
  );

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.error || '분석 중 오류가 발생했습니다.');
  }

  return response.json();
}
