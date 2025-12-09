/**
 * LLM 기반 주식 분석
 * 다양한 LLM 서비스를 지원합니다 (Ollama, OpenAI, Gemini 등)
 */

import { InferenceClient } from '@huggingface/inference';
import type {
  StockInfoType,
  MarketConditionType,
  CandleDataType,
  TechnicalIndicatorsType,
  AIAnalysisType,
} from '../model/stock.d';

// LLM 서비스 타입 (향후 확장용)
// type LLMProviderType = 'ollama' | 'openai' | 'gemini' | 'huggingface';

/**
 * LLM 분석 결과 타입
 */
export interface LLMAnalysisResultType {
  /** AI 점수 (0-100) */
  score: number;
  /** 등급 (SSS, SS, S, A, B, C, D, F) */
  grade: string;
  /** AI 분석 요약 */
  summary: string;
  /** 주요 리스크 요인 */
  riskFactors: string[];
  /** 투자 전략 제안 */
  strategy: string;
  /** 시장 감정 분석 */
  sentiment: 'bullish' | 'bearish' | 'neutral';
  /** 신뢰도 (0-100) */
  confidence: number;
}

/**
 * LLM 분석을 수행합니다.
 * 비용 최소화를 위해 Hugging Face 우선, 없으면 다른 서비스 사용
 * @param data 분석할 주식 데이터
 * @returns LLM 분석 결과
 */
export async function analyzeWithLLM(data: {
  symbol: string;
  stockInfo: StockInfoType;
  marketCondition: MarketConditionType;
  candles: CandleDataType[];
  technicalIndicators?: TechnicalIndicatorsType;
  technicalAnalysis: AIAnalysisType;
}): Promise<LLMAnalysisResultType | null> {
  // 프롬프트 구성 (통일된 프롬프트)
  const prompts = buildAnalysisPrompt(data);

  // 1순위: Hugging Face (무료 티어: 시간당 1,000회, Pro: $9/월 무제한)
  try {
    const hfResult = await analyzeWithHuggingFace(prompts);
    console.log(`>> hfResult: ${JSON.stringify(hfResult)}`);
    if (hfResult) return hfResult;
  } catch (error) {
    console.warn('Hugging Face 분석 실패, 다른 서비스 시도:', error);
  }

  // 2순위: Google Gemini (무료 티어: 월 1,500회)
  try {
    const geminiResult = await analyzeWithGemini(prompts);
    if (geminiResult) return geminiResult;
  } catch (error) {
    console.warn('Gemini 분석 실패:', error);
  }

  // 3순위: Ollama (로컬, 개발 환경용)
  try {
    const ollamaResult = await analyzeWithOllama(prompts);
    if (ollamaResult) return ollamaResult;
  } catch (error) {
    console.warn('Ollama 분석 실패:', error);
  }

  // 4순위: OpenAI (유료, 가장 안정적)
  try {
    const openaiResult = await analyzeWithOpenAI(prompts);
    if (openaiResult) return openaiResult;
  } catch (error) {
    console.warn('OpenAI 분석 실패:', error);
  }

  return null;
}

/**
 * Hugging Face Inference API로 분석 - 가장 비용 효율적!
 * 공식 @huggingface/inference 라이브러리 사용
 * 무료 티어: 시간당 1,000회
 * Pro Plan: $9/월 무제한
 *
 * 참고: https://huggingface.co/docs/huggingface.js/index
 */
async function analyzeWithHuggingFace(
  prompts: LLMPromptType
): Promise<LLMAnalysisResultType | null> {
  try {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey) {
      return null;
    }

    // Hugging Face Inference Client 초기화
    const client = new InferenceClient(apiKey);

    // 모델 선택: Inference API에서 사용 가능한 모델만 사용
    // 추천 모델 (Inference API에서 사용 가능):
    // - meta-llama/Llama-3.1-8B-Instruct (기본값, 더 좋은 성능, 한국어 지원 우수)
    // - meta-llama/Llama-3.2-1B-Instruct (작고 빠름, 비용 효율적)
    // - Qwen/Qwen2.5-0.5B-Instruct (초경량)
    // - mistralai/Mistral-7B-Instruct-v0.2 (좋은 성능)
    // 주의: microsoft/Phi-3-mini-4k-instruct는 Inference API에서 사용 불가능
    const model = process.env.HF_MODEL || 'meta-llama/Llama-3.1-8B-Instruct';

    // Chat 모델인지 확인 (Llama, Qwen, Mistral 등은 chat completion 지원)
    const isChatModel =
      model.includes('llama') ||
      model.includes('Qwen') ||
      model.includes('Mistral') ||
      model.includes('Phi');

    // 통일된 프롬프트 사용
    const systemPrompt = prompts.systemPrompt;
    const userPrompt = prompts.userPrompt;

    let generatedText: string;

    if (isChatModel) {
      // Chat Completion API 사용 (권장)
      try {
        const response = await client.chatCompletion({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
          ],
          max_tokens: 500,
          temperature: 0.5, // 다양성 증가 (0.3 -> 0.5)
          // JSON 형식 강제 (지원되는 모델만)
          // response_format: { type: 'json_object' }, // 일부 모델만 지원
        });

        generatedText = response.choices[0]?.message?.content || '';
      } catch (chatError) {
        // Chat completion 실패 시 text generation으로 fallback
        console.warn(
          'Chat completion 실패, text generation으로 시도:',
          chatError
        );
        try {
          const response = await client.textGeneration({
            model,
            inputs: prompts.fullPrompt,
            parameters: {
              temperature: 0.5, // 다양성 증가 (0.3 -> 0.5)
              max_new_tokens: 500,
              return_full_text: false,
            },
          });

          generatedText = response.generated_text || '';
        } catch (textGenError) {
          // 모델이 Inference API에서 사용 불가능한 경우
          console.error('Text generation도 실패:', textGenError);
          throw new Error(
            `모델 "${model}"이 Inference API에서 사용 불가능합니다. 다른 모델을 시도하거나 Inference Provider 설정을 확인하세요. 추천: meta-llama/Llama-3.2-1B-Instruct`
          );
        }
      }
    } else {
      // Text Generation API 사용
      try {
        const response = await client.textGeneration({
          model,
          inputs: prompts.fullPrompt,
          parameters: {
            temperature: 0.5, // 다양성 증가 (0.3 -> 0.5)
            max_new_tokens: 500,
            return_full_text: false,
          },
        });

        generatedText = response.generated_text || '';
      } catch (textGenError) {
        console.error('Text generation 실패:', textGenError);
        throw new Error(
          `모델 "${model}"이 Inference API에서 사용 불가능합니다. 다른 모델을 시도하거나 Inference Provider 설정을 확인하세요. 추천: meta-llama/Llama-3.2-1B-Instruct`
        );
      }
    }

    // JSON 부분 추출 (더 강력한 파싱)
    // 1. 코드 블록 제거 (```json ... ```)
    const cleanedText = generatedText
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim();

    // 2. 첫 번째 완전한 JSON 객체 찾기 (중괄호 매칭)
    let jsonString: string | null = null;
    let braceCount = 0;
    let startIndex = -1;

    for (let i = 0; i < cleanedText.length; i++) {
      if (cleanedText[i] === '{') {
        if (startIndex === -1) {
          startIndex = i;
        }
        braceCount++;
      } else if (cleanedText[i] === '}') {
        braceCount--;
        if (braceCount === 0 && startIndex !== -1) {
          // 완전한 JSON 객체 찾음
          jsonString = cleanedText.substring(startIndex, i + 1);
          break;
        }
      }
    }

    // 3. 정규식으로도 시도 (fallback)
    if (!jsonString) {
      const jsonMatch = cleanedText.match(/\{[\s\S]*?\}/);
      if (jsonMatch) {
        jsonString = jsonMatch[0];
      }
    }

    if (!jsonString) {
      console.warn(
        'JSON 형식 응답을 찾을 수 없습니다:',
        generatedText.substring(0, 300)
      );
      return null;
    }

    let content: {
      score?: number;
      grade?: string;
      summary?: string;
      riskFactors?: string[];
      strategy?: string;
      sentiment?: 'bullish' | 'bearish' | 'neutral';
      confidence?: number;
    };

    try {
      // JSON 파싱 시도
      content = JSON.parse(jsonString);

      // 필수 필드 검증
      if (
        typeof content.score !== 'number' ||
        !content.grade ||
        !content.summary
      ) {
        console.warn('JSON 필수 필드가 누락되었습니다:', content);
        return null;
      }
    } catch (parseError) {
      console.error('JSON 파싱 오류:', parseError);
      console.error('시도한 JSON 문자열:', jsonString?.substring(0, 500));
      console.error('전체 응답:', generatedText.substring(0, 500));
      return null;
    }

    return {
      score: content.score || 50,
      grade: content.grade || 'C',
      summary: content.summary || '',
      riskFactors: content.riskFactors || [],
      strategy: content.strategy || '',
      sentiment: content.sentiment || 'neutral',
      confidence: content.confidence || 50,
    };
  } catch (error) {
    // 503 에러 (모델 로딩 중) 처리
    if (
      error instanceof Error &&
      (error.message.includes('503') || error.message.includes('loading'))
    ) {
      console.warn('모델이 로딩 중입니다. 잠시 후 다시 시도해주세요.');
    } else {
      console.error('Hugging Face 분석 오류:', error);
    }
    return null;
  }
}

/**
 * Ollama (로컬 LLM)로 분석 - 개발 환경용
 */
async function analyzeWithOllama(
  prompts: LLMPromptType
): Promise<LLMAnalysisResultType | null> {
  try {
    const ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    const model = process.env.OLLAMA_MODEL || 'llama3.2:1b';

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt: prompts.fullPrompt,
        stream: false,
        options: {
          temperature: 0.5, // 다양성 증가
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const content = JSON.parse(result.response);

    return {
      score: content.score || 50,
      grade: content.grade || 'C',
      summary: content.summary || '',
      riskFactors: content.riskFactors || [],
      strategy: content.strategy || '',
      sentiment: content.sentiment || 'neutral',
      confidence: content.confidence || 50,
    };
  } catch {
    return null;
  }
}

/**
 * Google Gemini API로 분석 - 무료 티어 있음
 */
async function analyzeWithGemini(
  prompts: LLMPromptType
): Promise<LLMAnalysisResultType | null> {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return null;
    }

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompts.fullPrompt,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.5, // 다양성 증가
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const content = JSON.parse(result.candidates[0].content.parts[0].text);

    return {
      score: content.score || 50,
      grade: content.grade || 'C',
      summary: content.summary || '',
      riskFactors: content.riskFactors || [],
      strategy: content.strategy || '',
      sentiment: content.sentiment || 'neutral',
      confidence: content.confidence || 50,
    };
  } catch {
    return null;
  }
}

/**
 * OpenAI API로 분석 - 유료
 */
async function analyzeWithOpenAI(
  prompts: LLMPromptType
): Promise<LLMAnalysisResultType | null> {
  try {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return null;
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: prompts.systemPrompt,
          },
          {
            role: 'user',
            content: prompts.userPrompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5, // 다양성 증가
      }),
    });

    if (!response.ok) {
      return null;
    }

    const result = await response.json();
    const content = JSON.parse(result.choices[0].message.content);

    return {
      score: content.score || 50,
      grade: content.grade || 'C',
      summary: content.summary || '',
      riskFactors: content.riskFactors || [],
      strategy: content.strategy || '',
      sentiment: content.sentiment || 'neutral',
      confidence: content.confidence || 50,
    };
  } catch {
    return null;
  }
}

/**
 * LLM 프롬프트 구성 결과 타입
 */
interface LLMPromptType {
  /** 시스템 프롬프트 (Chat 모델용) */
  systemPrompt: string;
  /** 사용자 프롬프트 (완전한 분석 지시사항 포함) */
  userPrompt: string;
  /** 단일 프롬프트 (Text Generation 모델용) */
  fullPrompt: string;
}

/**
 * 분석 프롬프트를 구성합니다.
 * 모든 LLM 서비스에서 사용할 수 있도록 통일된 프롬프트를 생성합니다.
 */
function buildAnalysisPrompt(data: {
  symbol: string;
  stockInfo: StockInfoType;
  marketCondition: MarketConditionType;
  candles: CandleDataType[];
  technicalIndicators?: TechnicalIndicatorsType;
  technicalAnalysis: AIAnalysisType;
}): LLMPromptType {
  const recentPrices = data.candles
    .slice(-10)
    .map((c) => c.close)
    .join(', ');

  // 원시 데이터만 제공, 해석은 LLM이 스스로 하도록

  // 시스템 프롬프트 (Chat 모델용)
  const systemPrompt =
    'You are a professional stock analyst. Analyze the provided stock data and respond EXCLUSIVELY in Korean language. CRITICAL: You MUST write ONLY in Korean. Do NOT use Chinese (中文, 的, 是, etc.), Japanese (日本語, です, ます, etc.), English words, or any other languages. Use simple and easy-to-understand Korean words only. Write naturally as if explaining to an informed investor. Respond ONLY with valid JSON, no markdown, no explanations.';

  // 주식 데이터 부분
  const stockDataSection = `**Stock Information:**
- Symbol: ${data.symbol}
- Current Price: $${data.stockInfo.currentPrice.toFixed(2)}
- Change Percent: ${data.stockInfo.changePercent.toFixed(2)}%

**Market Condition:**
${
  data.marketCondition.marketIndices
    ? `- S&P 500: ${
        data.marketCondition.marketIndices.sp500?.value?.toFixed(2) || 'N/A'
      } (${
        data.marketCondition.marketIndices.sp500?.changePercent?.toFixed(2) || 0
      }%)
- NASDAQ: ${
        data.marketCondition.marketIndices.nasdaq?.value?.toFixed(2) || 'N/A'
      } (${
        data.marketCondition.marketIndices.nasdaq?.changePercent?.toFixed(2) ||
        0
      }%)`
    : '- Market indices: Not available'
}

**Technical Indicators:**
- RSI: ${
    data.technicalIndicators?.rsi?.toFixed(2) || 'N/A'
  } (Calculated based on 14-day daily closing prices. Standard thresholds: < 30 = Oversold, > 70 = Overbought)
- MACD: ${
    data.technicalIndicators?.macd
      ? `Value: ${data.technicalIndicators.macd.value.toFixed(
          4
        )}, Signal: ${data.technicalIndicators.macd.signal.toFixed(
          4
        )}, Histogram: ${data.technicalIndicators.macd.histogram.toFixed(4)}`
      : 'N/A'
  }
- Moving Averages (SMA): ${
    data.technicalIndicators?.sma
      ? `20일: ${
          data.technicalIndicators.sma.sma_20?.toFixed(2) || 'N/A'
        }, 50일: ${
          data.technicalIndicators.sma.sma_50?.toFixed(2) || 'N/A'
        }, 200일: ${data.technicalIndicators.sma.sma_200?.toFixed(2) || 'N/A'}`
      : 'N/A'
  }

**Recent Price Trend (last 10 days closing prices):**
${recentPrices}

**Technical Analysis Summary:**
- Trend Direction: ${data.technicalAnalysis.trend.direction} (${
    data.technicalAnalysis.trend.strength
  })
- Overall AI Score: ${data.technicalAnalysis.score}/100 (Grade: ${
    data.technicalAnalysis.grade
  })
- Target Price: $${data.technicalAnalysis.targetPrice.toFixed(
    2
  )} (Expected return: +${data.technicalAnalysis.targetReturn.toFixed(2)}%)
- Stop Loss: $${data.technicalAnalysis.stopLoss.toFixed(
    2
  )} (Risk: ${data.technicalAnalysis.stopLossPercent.toFixed(2)}%)`;

  // RSI 상태 판단 (명확한 기준)
  let rsiStatus = '';
  if (data.technicalIndicators?.rsi !== undefined) {
    const rsi = data.technicalIndicators.rsi;
    if (rsi < 30) {
      rsiStatus = `OVERSOLD (과매도) - RSI is ${rsi.toFixed(
        2
      )}, which is below 30. This is a rare condition indicating the stock may be oversold.`;
    } else if (rsi > 70) {
      rsiStatus = `OVERBOUGHT (과매수) - RSI is ${rsi.toFixed(
        2
      )}, which is above 70. This is a rare condition indicating the stock may be overbought.`;
    } else if (rsi >= 50) {
      rsiStatus = `NEUTRAL TO BULLISH - RSI is ${rsi.toFixed(
        2
      )}, which is in the normal range (30-70). The stock is showing bullish momentum but NOT oversold.`;
    } else {
      rsiStatus = `NEUTRAL TO BEARISH - RSI is ${rsi.toFixed(
        2
      )}, which is in the normal range (30-70). The stock is showing bearish momentum but NOT oversold.`;
    }
  } else {
    rsiStatus = 'RSI data is not available.';
  }

  // 분석 지시사항 부분
  const analysisInstructions = `**CRITICAL RSI INTERPRETATION (READ CAREFULLY):**
Current RSI Status: ${rsiStatus}

**RSI Calculation Method:**
- RSI is calculated based on 14-day daily closing prices (일별 데이터 기준, 최근 14일간의 종가 데이터 사용)
- This means the RSI value reflects the stock's momentum over the past 14 trading days
- RSI < 30: OVERSOLD (과매도) - This is a RARE condition indicating the stock has been declining significantly over the past 14 days. Only use this term when RSI is actually below 30.
- RSI 30-50: NEUTRAL TO BEARISH - This is NOT oversold. The stock is in normal range, showing some bearish momentum but not extreme.
- RSI 50-70: NEUTRAL TO BULLISH - This is NOT oversold or overbought. The stock is in normal range, showing some bullish momentum but not extreme.
- RSI > 70: OVERBOUGHT (과매수) - This is a RARE condition indicating the stock has been rising significantly over the past 14 days. Only use this term when RSI is actually above 70.

**IMPORTANT:**
- RSI is based on 14-day daily data, so it reflects medium-term momentum, not short-term fluctuations
- DO NOT say "과매도" (oversold) unless RSI is actually below 30
- DO NOT say "과매수" (overbought) unless RSI is actually above 70
- Most stocks have RSI between 30-70, which is NORMAL range (대부분의 주식은 30-70 사이의 정상 범위)
- If RSI is between 30-50, describe it as "약한 하락 모멘텀" or "중립적" or "정상 범위", NOT as "과매도"
- If RSI is between 50-70, describe it as "약한 상승 모멘텀" or "중립적" or "정상 범위", NOT as "과매수"

**Analysis Guidelines (BALANCED APPROACH):**
- Consider ALL indicators equally - do not over-rely on any single indicator
- RSI: Primary momentum indicator - use it to assess overbought/oversold conditions
- MACD: Trend confirmation indicator - positive histogram with MACD above signal suggests bullish momentum, negative histogram with MACD below signal suggests bearish momentum
- Moving Averages: Support/Resistance reference only - they are lagging indicators and should not be the primary basis for analysis. Use them as supplementary information, not the main driver.
- Price Trend: Most important - analyze the actual price movement and recent price action
- Market Conditions: Context matters - consider overall market sentiment (S&P 500, NASDAQ)
- Provide nuanced analysis that considers all factors together, not just one indicator
- DO NOT over-emphasize moving averages (especially 200-day MA) - they are historical averages, not predictive indicators
- Focus on current momentum (RSI, MACD) and price action rather than historical averages
- Write naturally in Korean, as if explaining to an informed investor
- DO NOT confuse oversold (과매도) with overbought (과매수)

**Response Format:**
Respond in the following JSON format:
{
  "score": <A number between 0-100, your calculated score based on all factors. Be CONSERVATIVE - only give high scores (80+) when indicators are strongly positive. Most stocks should score 40-70. Only exceptional stocks with multiple strong positive signals should score above 80.>,
  "grade": "<One of: SSS, SS, S, A, B, C, D, F>. Be VERY CONSERVATIVE with grades: SSS (98+), SS (90+), S (85+), A (75+), B (65+), C (55+), D (45+), F (<45). Most stocks should be B, C, or D grade. Only give SSS or SS to truly exceptional stocks with overwhelmingly positive indicators across all metrics.>",
  "summary": "<Comprehensive analysis summary in Korean, 200-300 characters. Provide nuanced insights that consider both opportunities and risks. Write naturally as if explaining to an informed investor.>",
  "riskFactors": ["<Actual risk factor 1 in Korean - be specific, not generic>", "<Actual risk factor 2 in Korean - be specific, not generic>"],
  "strategy": "<Investment strategy suggestion in Korean, 200-300 characters. Be specific to this stock's situation. Consider entry timing, position sizing, and exit strategy. IMPORTANT: When mentioning price levels, use prices that are DIFFERENT from the current price. Use meaningful price levels like support/resistance levels, not the exact current price.>",
  "sentiment": "<One of: bullish, bearish, neutral>",
  "confidence": <A number between 0-100, your confidence level in this analysis>
}

**CONTENT REQUIREMENTS:**
- "summary" should be comprehensive and nuanced, not just listing facts
- "riskFactors" should be actual risks specific to this stock's current situation. Think about:
  * What could go wrong with this investment?
  * What market conditions could negatively impact this stock?
  * What technical indicators suggest potential downside?
  * What fundamental factors pose risks?
  - DO NOT use generic phrases or copy example text
  - Each risk factor should be unique and specific to this stock's analysis
  - Use correct financial terminology:
    * "반등" (rebound) = 하락 후 상승 (price rises after falling) - this is POSITIVE, not a risk
    * "조정" (correction) = 상승 후 하락 (price falls after rising) - this is a risk when price is high
    * "하락" (decline/fall) = 가격이 떨어짐 - this is a risk
    * DO NOT say "상승한 후 반등" - this is contradictory. Use "상승한 후 조정" or "하락 후 반등" instead
    * DO NOT say "반등의 위험" - this is contradictory. "반등" is positive. Use "조정의 위험" or "하락의 위험" instead
    * When price is high and may fall, say "조정의 위험" or "하락의 위험", NOT "반등의 위험"
    * When price is low and may rise, say "반등 가능성" or "상승 가능성", NOT "반등의 위험"
- "strategy" should be specific and actionable, considering the stock's unique situation
- When mentioning price levels in strategy:
  * DO NOT use the exact current price as a threshold
  * Use meaningful price levels that are DIFFERENT from current price
  * Consider support/resistance levels, target prices, or stop-loss levels
  * Make sure the price levels make logical sense
- Use logical and consistent language - avoid contradictory statements
- Create unique, thoughtful analysis for each stock

**RESPONSE FORMAT:**
- Respond with JSON object only, no markdown or code blocks, pure JSON only`;

  // 사용자 프롬프트 (Chat 모델용)
  const userPrompt = `Analyze the following stock data as a professional analyst. Provide comprehensive, nuanced insights EXCLUSIVELY in Korean language.

CRITICAL LANGUAGE REQUIREMENT:
- You MUST write ONLY in Korean (한국어)
- Do NOT use Chinese characters (中文, 的, 是, 可以, etc.)
- Do NOT use Japanese characters (日本語, です, ます, が, etc.)
- Do NOT use English words except for technical terms that have no Korean equivalent
- All text fields (summary, riskFactors, strategy) must be 100% Korean
- If you use any non-Korean characters, the response will be rejected

Stock Data:
${stockDataSection}

${analysisInstructions}`;

  // 전체 프롬프트 (Text Generation 모델용)
  const fullPrompt = `${systemPrompt}

${userPrompt}`;

  return {
    systemPrompt,
    userPrompt,
    fullPrompt,
  };
}

/**
 * 기술적 분석과 LLM 분석을 통합합니다.
 */
export function combineAnalysis(
  technicalAnalysis: AIAnalysisType,
  llmAnalysis: LLMAnalysisResultType | null
): AIAnalysisType {
  if (!llmAnalysis) {
    return technicalAnalysis;
  }

  // 기술적 분석 점수와 LLM 점수를 가중 평균 (보수적 접근)
  // 기술적 분석 70% + LLM 분석 30% (기술적 분석에 더 높은 가중치)
  // LLM 점수에 보수적 조정 적용 (10점 감점)
  const adjustedLLMScore = Math.max(0, llmAnalysis.score - 10);
  const combinedScore = Math.round(
    technicalAnalysis.score * 0.7 + adjustedLLMScore * 0.3
  );

  // 등급 재계산 (매우 엄격한 보수적 기준)
  let grade: string;
  if (combinedScore >= 98) {
    grade = 'SSS'; // 거의 불가능한 수준 - 모든 지표가 압도적으로 긍정적
  } else if (combinedScore >= 90) {
    grade = 'SS'; // 매우 우수 - 대부분의 지표가 강하게 긍정적
  } else if (combinedScore >= 85) {
    grade = 'S'; // 우수 - 여러 지표가 긍정적
  } else if (combinedScore >= 75) {
    grade = 'A'; // 양호 - 전반적으로 긍정적
  } else if (combinedScore >= 65) {
    grade = 'B'; // 보통 - 중립적이거나 약간 긍정적
  } else if (combinedScore >= 55) {
    grade = 'C'; // 보통 이하 - 약간 부정적
  } else if (combinedScore >= 45) {
    grade = 'D'; // 부정적 - 여러 지표가 부정적
  } else {
    grade = 'F'; // 매우 부정적
  }

  return {
    ...technicalAnalysis,
    score: combinedScore,
    grade,
    // LLM 분석 결과 추가
    llmAnalysis: {
      summary: llmAnalysis.summary,
      riskFactors: llmAnalysis.riskFactors,
      strategy: llmAnalysis.strategy,
      sentiment: llmAnalysis.sentiment,
      confidence: llmAnalysis.confidence,
    },
  };
}
