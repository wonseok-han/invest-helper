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
      'You are a professional stock analyst specializing in Korean stock market analysis. Analyze technical indicators and market data, then provide your analysis in Korean language. Respond ONLY with valid JSON, no markdown, no explanations.';

    const userPrompt = `다음 주식 데이터를 분석하고 한국어로 응답하세요. JSON 형식으로만 응답하세요.

주식 데이터:
${prompt}

다음 JSON 형식으로 실제 분석 결과를 작성하세요 (예시 텍스트를 복사하지 말고 실제 분석을 작성하세요):
{
  "score": <0-100 사이의 점수, 실제 계산한 점수>,
  "grade": "<SSS, SS, S, A, B, C, D, F 중 하나>",
  "summary": "<실제 분석 요약을 한국어로 작성, 최대 200자>",
  "riskFactors": ["<실제로 파악한 리스크 요인 1을 한국어로>", "<실제로 파악한 리스크 요인 2를 한국어로>"],
  "strategy": "<실제 투자 전략 제안을 한국어로 작성, 최대 150자>",
  "sentiment": "<bullish, bearish, neutral 중 하나>",
  "confidence": <0-100 사이의 신뢰도, 실제 신뢰도>
}

중요 사항:
- 모든 필드를 실제 분석 결과로 작성하세요
- "summary"는 실제 분석 내용을 한국어로 작성 (예시 텍스트 복사 금지)
- "riskFactors"는 실제로 파악한 리스크를 한국어로 작성 (예: "시장 변동성 증가", "거래량 감소" 등)
- "strategy"는 실제 투자 전략을 한국어로 작성 (예: "단기 매수 후 목표가 도달 시 매도" 등)
- 일본어나 영어가 아닌 한국어로만 작성하세요
- JSON 객체만 응답하세요, 마크다운이나 코드 블록 없이 순수 JSON만`;

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

  return `
다음 주식 데이터를 분석해주세요:

**주식 정보:**
- 심볼: ${data.symbol}
- 현재가: $${data.stockInfo.currentPrice}
- 변화율: ${data.stockInfo.changePercent}%

**시장 상황:**
- 시장 지수 정보 없음 (무료 플랜 제한)

**기술적 지표:**
- RSI: ${data.technicalIndicators?.rsi || 'N/A'}
- MACD: ${
    data.technicalIndicators?.macd
      ? JSON.stringify(data.technicalIndicators.macd)
      : 'N/A'
  }
- 이동평균선: ${
    data.technicalIndicators?.sma
      ? JSON.stringify(data.technicalIndicators.sma)
      : 'N/A'
  }

**최근 가격 추이:**
${recentPrices}

**기술적 분석 결과:**
- 트렌드: ${data.technicalAnalysis.trend.direction} (${
    data.technicalAnalysis.trend.strength
  })
- AI 점수: ${data.technicalAnalysis.score} (${data.technicalAnalysis.grade})
- 목표가: $${data.technicalAnalysis.targetPrice} (+${
    data.technicalAnalysis.targetReturn
  }%)
- 손절가: $${data.technicalAnalysis.stopLoss} (${
    data.technicalAnalysis.stopLossPercent
  }%)

다음 JSON 형식으로 응답해주세요:
{
  "score": 0-100 사이의 점수,
  "grade": "SSS" | "SS" | "S" | "A" | "B" | "C" | "D" | "F",
  "summary": "종합 분석 요약 (한국어, 200자 이내)",
  "riskFactors": ["리스크 요인 1", "리스크 요인 2"],
  "strategy": "투자 전략 제안 (한국어, 150자 이내)",
  "sentiment": "bullish" | "bearish" | "neutral",
  "confidence": 0-100 사이의 신뢰도
}
`;
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
