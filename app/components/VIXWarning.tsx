/**
 * VIX 경고 표시 컴포넌트
 */

interface VIXWarningProps {
  vixValue: number;
  vixLevel: 'low' | 'medium' | 'high' | 'risk';
}

/**
 * VIX 경고를 표시하는 컴포넌트
 */
export default function VIXWarning({ vixValue, vixLevel }: VIXWarningProps) {
  if (vixLevel !== 'risk' && vixLevel !== 'high') {
    return null;
  }

  return (
    <div className="text-center text-yellow-400 font-semibold">
      {`>>> ▲ VIX 경고 (${vixValue.toFixed(1)}): 변동성 주의 <<<`}
    </div>
  );
}

