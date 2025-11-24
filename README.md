# AI 기반 주식 분석 앱

여러 주식 API를 조합하여 실시간 주식 데이터를 분석하고 AI 기반 투자 인사이트를 제공하는 웹 애플리케이션입니다.

## 사용하는 API

이 앱은 무료 플랜의 한계를 극복하기 위해 여러 API를 조합하여 사용합니다:

1. **Finnhub** (필수)
   - 실시간 주가 (Quote)
   - VIX 지수
   - 기업 프로필
   - 무료 플랜: 분당 60회 호출

2. **Tiingo** (선택적 - Fallback)
   - EOD (End of Day) 데이터
   - 캔들스틱 데이터 대체용
   - 무료 플랜: 월 500개 심볼, 시간당 500회

3. **Twelve Data** (선택적 - 기술적 지표)
   - RSI, MACD, 이동평균선 등 기술적 지표
   - 무료 플랜: 분당 8회, 하루 800회

## 환경 설정

### 1. API 키 발급

#### Finnhub (필수)
1. [Finnhub 웹사이트](https://finnhub.io/)에 접속하여 계정을 생성합니다.
2. 대시보드에서 API 키를 발급받습니다.

#### Tiingo (선택적 - 권장)
1. [Tiingo 웹사이트](https://www.tiingo.com/)에 접속하여 계정을 생성합니다.
2. 대시보드에서 API 키를 발급받습니다.
3. 캔들스틱 데이터 접근이 제한될 때 Fallback으로 사용됩니다.

#### Twelve Data (선택적)
1. [Twelve Data 웹사이트](https://twelvedata.com/)에 접속하여 계정을 생성합니다.
2. 대시보드에서 API 키를 발급받습니다.
3. 기술적 지표 분석을 강화합니다.

### 2. 환경 변수 설정

프로젝트 루트에 `.env.local` 파일을 생성하고 다음 내용을 추가합니다:

```bash
# 필수
FINNHUB_API_KEY=your_finnhub_api_key_here

# 선택적 (권장)
TIINGO_API_KEY=your_tiingo_api_key_here

# 선택적 (기술적 지표 강화)
TWELVE_DATA_API_KEY=your_twelve_data_api_key_here
```

**주의**: `.env.local` 파일은 Git에 커밋하지 마세요. 이미 `.gitignore`에 포함되어 있습니다.

### 3. 데이터 소스 우선순위

앱은 다음 순서로 데이터를 가져옵니다:

- **가격 히스토리**: Finnhub 캔들스틱 → Tiingo EOD (Fallback)
- **기술적 지표**: Twelve Data (선택적)
- **기본 정보**: Finnhub (필수)

API 키가 없는 경우 해당 기능은 건너뛰고 다른 데이터 소스를 사용합니다.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```
