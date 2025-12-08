# AI 통합 계획

## 현재 상황
- 기술적 지표 기반 계산 (RSI, MACD, SMA, 트렌드 분석 등)
- 규칙 기반 점수 계산
- 실제 AI/ML 모델 미사용

## AI 적용 방안

### 방안 1: LLM 기반 분석 (추천) ⭐
**장점:**
- 빠른 구현 (1-2일)
- 자연어 설명 제공 가능
- 다양한 관점 분석 가능
- 비용 효율적 (요청당 $0.01-0.1)

**구현 방법:**
1. **OpenAI GPT-4 / Claude API** 사용
2. 주식 데이터를 구조화된 프롬프트로 전달
3. AI가 분석 결과를 JSON 형식으로 반환
4. 현재 계산 로직과 AI 분석을 결합

**예시 구조:**
```typescript
// 하이브리드 접근
const technicalAnalysis = performAIAnalysis(stockData); // 현재 계산
const aiInsights = await getLLMAnalysis({
  symbol,
  currentPrice,
  technicalIndicators,
  priceHistory,
  marketCondition
});
```

**추가 가능한 기능:**
- 시장 뉴스 분석
- 감정 분석 (뉴스, 소셜 미디어)
- 리스크 요인 분석
- 투자 전략 제안

---

### 방안 2: 머신러닝 모델 (장기적)
**장점:**
- 높은 정확도 (학습 데이터 충분 시)
- 실시간 예측 가능
- 커스텀 모델 구축

**단점:**
- 학습 데이터 필요
- 모델 학습 시간 소요
- 인프라 구축 필요

**구현 방법:**
1. **시계열 예측 모델** (LSTM, Transformer)
   - 가격 예측
   - 변동성 예측
2. **분류 모델**
   - 매수/매도/보유 신호
   - 리스크 레벨 분류
3. **강화학습**
   - 최적 매매 타이밍

**필요한 것:**
- 과거 주가 데이터 (최소 1-2년)
- 모델 학습 파이프라인
- 모델 서빙 인프라 (TensorFlow Serving, ONNX Runtime 등)

---

### 방안 3: 하이브리드 접근 (최적) ⭐⭐
**구조:**
```
1. 기술적 지표 계산 (현재 로직 유지)
   ↓
2. LLM 분석 (추가 인사이트)
   ↓
3. 결과 통합 및 가중치 적용
```

**장점:**
- 기존 로직 활용
- AI 인사이트 추가
- 점진적 개선 가능

**구현 예시:**
```typescript
// 1. 기술적 분석
const technicalAnalysis = performAIAnalysis(stockData);

// 2. LLM 분석
const aiInsights = await analyzeWithLLM({
  symbol: stockInfo.symbol,
  technicalAnalysis,
  marketData: {
    vix: marketCondition.vix,
    currentPrice: stockInfo.currentPrice,
    priceHistory: candles
  }
});

// 3. 통합
const finalScore = combineAnalysis(technicalAnalysis, aiInsights);
```

---

## 추천 구현 순서

### Phase 1: LLM 통합 (1주)
1. OpenAI/Anthropic API 설정
2. 프롬프트 엔지니어링
3. AI 분석 함수 구현
4. 결과 통합 로직

### Phase 2: 고도화 (2-4주)
1. 뉴스 데이터 수집 및 분석
2. 감정 분석 추가
3. 리스크 요인 분석
4. 투자 전략 제안

### Phase 3: ML 모델 (장기)
1. 데이터 수집 및 전처리
2. 모델 학습
3. 모델 서빙
4. A/B 테스트

---

## 비용 최소화 방안 💰

### 옵션 1: Hugging Face Inference API - 가장 추천! ⭐⭐⭐
**장점:**
- 무료 티어: 시간당 1,000회 요청
- Pro Plan: $9/월 무제한 사용
- 서버 관리 불필요 (클라우드)
- 다양한 오픈소스 모델 사용 가능
- 안정적이고 빠름

**단점:**
- 무료 티어는 모델 로딩 시간이 있을 수 있음 (첫 요청 시)
- Pro Plan은 유료 ($9/월)

**구현 방법:**
1. Hugging Face 계정 생성: https://huggingface.co/
2. API 키 발급: https://huggingface.co/settings/tokens
3. 환경 변수 설정: `HUGGINGFACE_API_KEY=your-token`

**비용:**
- 무료: 시간당 1,000회
- Pro: $9/월 (무제한)

**추천 모델:**
- `microsoft/Phi-3-mini-4k-instruct` - 작고 빠름
- `meta-llama/Llama-3.2-1B-Instruct` - 좋은 성능
- `mistralai/Mistral-7B-Instruct-v0.2` - 더 좋은 성능

---

### 옵션 2: Google Gemini API - 무료 티어 ⭐⭐
**장점:**
- 무료 티어: 월 15회 요청 (GPT-4o-mini)
- 또는 Gemini 1.5 Flash: 월 1,500회 무료
- 빠른 응답 속도
- 좋은 성능

**비용:**
- 무료 티어: 월 1,500회까지 무료
- 초과 시: $0.000075/1K 토큰 (매우 저렴)

**구현:**
```typescript
// Google Gemini API 사용
const response = await fetch(
  `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
  { ... }
);
```

---

### 옵션 3: 로컬 LLM (Ollama) - 개발 환경용
**장점:**
- 완전 무료 (인터넷 비용만)
- 프라이버시 보호
- 오프라인 작동 가능

**단점:**
- 로컬 서버 필요 (프로덕션에서는 서버 비용 발생)
- GPU 권장 (CPU도 가능하지만 느림)
- 모델 다운로드 필요 (2-7GB)

**비용:**
- 개발 환경: $0
- 프로덕션: 서버 비용 (월 $20-100+)

---

### 옵션 4: 오픈소스 모델 직접 호스팅
**장점:**
- 완전 무료
- 완전한 제어

**단점:**
- 서버 인프라 필요
- 설정 복잡
- 서버 비용 발생

---

## 추천: Hugging Face Inference API ⭐⭐⭐

**가장 비용 효율적이고 실용적입니다!**

### 설정 방법:
1. **Hugging Face 계정 생성**
   - https://huggingface.co/ 회원가입

2. **API 토큰 발급**
   - https://huggingface.co/settings/tokens
   - "New token" 클릭
   - "Read" 권한으로 생성

3. **환경 변수 설정**
   ```bash
   # .env.local 파일에 추가
   HUGGINGFACE_API_KEY=your-token-here
   HF_MODEL=microsoft/Phi-3-mini-4k-instruct  # 선택사항
   ```

4. **Pro Plan 업그레이드 (선택)**
   - 무료 티어: 시간당 1,000회
   - Pro Plan ($9/월): 무제한 사용
   - https://huggingface.co/pricing

### 사용 예시:
```typescript
// 자동으로 Hugging Face를 우선 사용
const llmAnalysis = await analyzeWithLLM({
  symbol,
  stockInfo,
  marketCondition,
  candles,
  technicalIndicators,
  technicalAnalysis
});
```

---

## 비용 비교표

| 옵션 | 무료 티어 | 유료 플랜 | 추천도 |
|------|----------|----------|--------|
| **Hugging Face** | 시간당 1,000회 | **$9/월** (무제한) | ⭐⭐⭐ |
| **Gemini API** | 월 1,500회 | $0.000075/1K 토큰 | ⭐⭐ |
| **Ollama (로컬)** | 무제한 | 서버 비용 ($20-100+/월) | ⭐ (개발용) |
| OpenAI GPT-4o-mini | 없음 | $0.15/1M 토큰 | ⭐ |
| Claude 3.5 Sonnet | 없음 | $3/1M 토큰 | ⭐ |

**결론: Hugging Face가 가장 비용 효율적입니다!**
- 무료 티어로 시작 가능
- Pro Plan도 $9/월로 저렴
- 서버 관리 불필요

---

## 다음 단계 (Hugging Face 추천) ⭐
1. Hugging Face 계정 생성 및 API 토큰 발급
2. 환경 변수 설정 (`HUGGINGFACE_API_KEY`)
3. API 라우트에 LLM 분석 통합
4. UI에 AI 인사이트 표시
5. (선택) Pro Plan 업그레이드 ($9/월)

