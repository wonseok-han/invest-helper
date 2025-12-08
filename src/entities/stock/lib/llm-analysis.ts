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
  // 프롬프트 구성
  const prompt = buildAnalysisPrompt(data);

  // 1순위: Hugging Face (무료 티어: 시간당 1,000회, Pro: $9/월 무제한)
  try {
    const hfResult = await analyzeWithHuggingFace(prompt);
    console.log(`>> hfResult: ${JSON.stringify(hfResult)}`);
    if (hfResult) return hfResult;
  } catch (error) {
    console.warn('Hugging Face 분석 실패, 다른 서비스 시도:', error);
  }

  // 2순위: Google Gemini (무료 티어: 월 1,500회)
  try {
    const geminiResult = await analyzeWithGemini(prompt);
    if (geminiResult) return geminiResult;
  } catch (error) {
    console.warn('Gemini 분석 실패:', error);
  }

  // 3순위: Ollama (로컬, 개발 환경용)
  try {
    const ollamaResult = await analyzeWithOllama(prompt);
    if (ollamaResult) return ollamaResult;
  } catch (error) {
    console.warn('Ollama 분석 실패:', error);
  }

  // 4순위: OpenAI (유료, 가장 안정적)
  try {
    const openaiResult = await analyzeWithOpenAI(prompt);
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
  prompt: string
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

    const systemPrompt =
      'You are a professional stock analyst. Analyze the provided stock data and respond in Korean language. Use simple and easy-to-understand Korean words. Avoid mixing other languages, technical jargon, or English words. Write naturally as if explaining to a non-expert. Respond ONLY with valid JSON, no markdown, no explanations.';

    const userPrompt = `Analyze the following stock data and provide your analysis in Korean language. Use simple and clear Korean words that are easy to understand.

Stock Data:
${prompt}

Respond in the following JSON format with actual analysis results (do not copy example text, write real analysis):
{
  "score": <A number between 0-100, your calculated score>,
  "grade": "<One of: SSS, SS, S, A, B, C, D, F>",
  "summary": "<Comprehensive analysis summary in Korean, max 200 characters. Use simple and clear Korean words. Explain the analysis in an easy-to-understand way.>",
  "riskFactors": ["<Risk factor 1 in Korean, use simple words>", "<Risk factor 2 in Korean, use simple words>"],
  "strategy": "<Investment strategy suggestion in Korean, max 150 characters. Use simple and clear Korean words.>",
  "sentiment": "<One of: bullish, bearish, neutral>",
  "confidence": <A number between 0-100, your confidence level>
}

IMPORTANT REQUIREMENTS:
- All text fields (summary, riskFactors, strategy) must be in Korean ONLY
- Use everyday Korean words that are easy to understand
- Avoid mixing English, Vietnamese, or any other languages
- Write naturally and clearly as if explaining to someone who is not a financial expert
- Do not use technical jargon or complex financial terms
- Example: Instead of "RSI의 지속적인 상승을 통해 강한 uptrend 트렌드를 xác지합니다", write "RSI가 계속 올라가고 있어서 주가가 오를 가능성이 높습니다"
- Write actual investment strategy in Korean (e.g., "단기 매수 후 목표가 도달 시 매도")
- Write ONLY in Korean, not in Japanese or English
- Respond with JSON object only, no markdown or code blocks, pure JSON only`;

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
          temperature: 0.3,
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
            inputs: `${systemPrompt}\n\n${userPrompt}`,
            parameters: {
              temperature: 0.3,
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
          inputs: `${systemPrompt}\n\n${userPrompt}`,
          parameters: {
            temperature: 0.3,
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
  prompt: string
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
        prompt: `당신은 전문 주식 분석가입니다. 다음 데이터를 분석하고 JSON 형식으로 응답하세요.\n\n${prompt}\n\n반드시 다음 JSON 형식으로만 응답하세요:\n{"score": 0-100, "grade": "SSS|SS|S|A|B|C|D|F", "summary": "요약", "riskFactors": ["리스크1", "리스크2"], "strategy": "전략", "sentiment": "bullish|bearish|neutral", "confidence": 0-100}`,
        stream: false,
        options: {
          temperature: 0.3,
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
  prompt: string
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
                  text: `당신은 전문 주식 분석가입니다. 다음 데이터를 분석하고 JSON 형식으로 응답하세요.\n\n${prompt}\n\n반드시 다음 JSON 형식으로만 응답하세요:\n{"score": 0-100, "grade": "SSS|SS|S|A|B|C|D|F", "summary": "요약", "riskFactors": ["리스크1", "리스크2"], "strategy": "전략", "sentiment": "bullish|bearish|neutral", "confidence": 0-100}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
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
  prompt: string
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
            content:
              '당신은 전문 주식 분석가입니다. 주어진 기술적 지표와 시장 데이터를 기반으로 주식에 대한 종합적인 분석을 제공하세요. JSON 형식으로 응답하세요.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
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
 * 분석 프롬프트를 구성합니다.
 */
function buildAnalysisPrompt(data: {
  symbol: string;
  stockInfo: StockInfoType;
  marketCondition: MarketConditionType;
  candles: CandleDataType[];
  technicalIndicators?: TechnicalIndicatorsType;
  technicalAnalysis: AIAnalysisType;
}): string {
  const recentPrices = data.candles
    .slice(-10)
    .map((c) => c.close)
    .join(', ');

  return `You are a professional stock analyst. Analyze the following stock data and provide your analysis.

**Stock Information:**
- Symbol: ${data.symbol}
- Current Price: $${data.stockInfo.currentPrice}
- Change Percent: ${data.stockInfo.changePercent}%

**Market Condition:**
- Market indices: Not available (free plan limitation)

**Technical Indicators:**
- RSI: ${data.technicalIndicators?.rsi || 'N/A'}
- MACD: ${
    data.technicalIndicators?.macd
      ? JSON.stringify(data.technicalIndicators.macd)
      : 'N/A'
  }
- Moving Averages (SMA): ${
    data.technicalIndicators?.sma
      ? JSON.stringify(data.technicalIndicators.sma)
      : 'N/A'
  }

**Recent Price Trend:**
${recentPrices}

**Technical Analysis Results:**
- Trend: ${data.technicalAnalysis.trend.direction} (${
    data.technicalAnalysis.trend.strength
  })
- AI Score: ${data.technicalAnalysis.score} (${data.technicalAnalysis.grade})
- Target Price: $${data.technicalAnalysis.targetPrice} (+${
    data.technicalAnalysis.targetReturn
  }%)
- Stop Loss: $${data.technicalAnalysis.stopLoss} (${
    data.technicalAnalysis.stopLossPercent
  }%)

**IMPORTANT: Respond in Korean language. Use simple and easy-to-understand Korean words. Avoid mixing other languages or technical jargon. Write naturally as if explaining to a non-expert.**

Respond in the following JSON format:
{
  "score": A number between 0-100,
  "grade": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "summary": "Comprehensive analysis summary in Korean (max 200 characters, use simple and clear Korean)",
  "riskFactors": ["Risk factor 1 in Korean", "Risk factor 2 in Korean"],
  "strategy": "Investment strategy suggestion in Korean (max 150 characters, use simple and clear Korean)",
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": A number between 0-100
}

Remember: All text fields (summary, riskFactors, strategy) must be in Korean only. Use everyday Korean words that are easy to understand.`;
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

  // 기술적 분석 점수와 LLM 점수를 가중 평균
  // 기술적 분석 70% + LLM 분석 30%
  const combinedScore = Math.round(
    technicalAnalysis.score * 0.7 + llmAnalysis.score * 0.3
  );

  // 등급 재계산
  let grade: string;
  if (combinedScore >= 90) {
    grade = 'SSS';
  } else if (combinedScore >= 80) {
    grade = 'SS';
  } else if (combinedScore >= 70) {
    grade = 'S';
  } else if (combinedScore >= 60) {
    grade = 'A';
  } else if (combinedScore >= 50) {
    grade = 'B';
  } else if (combinedScore >= 40) {
    grade = 'C';
  } else if (combinedScore >= 30) {
    grade = 'D';
  } else {
    grade = 'F';
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
