/**
 * AI Score 표시 컴포넌트
 */

interface AIScoreProps {
  score: number;
  grade: string;
}

/**
 * AI 점수와 등급을 표시하는 컴포넌트
 */
export default function AIScore({ score, grade }: AIScoreProps) {
  const getScoreColor = () => {
    if (score >= 80) {
      return 'text-fuchsia-400';
    }
    if (score >= 60) {
      return 'text-blue-400';
    }
    if (score >= 40) {
      return 'text-yellow-400';
    }
    return 'text-red-400';
  };

  const getGradeColor = () => {
    if (grade === 'SSS' || grade === 'SS' || grade === 'S') {
      return 'text-fuchsia-400';
    }
    if (grade === 'A') {
      return 'text-blue-400';
    }
    if (grade === 'B') {
      return 'text-yellow-400';
    }
    return 'text-red-400';
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="text-sm text-gray-400">AI SCORE</div>
      <div className={`text-7xl font-bold ${getScoreColor()}`}>
        {score}
      </div>
      <div className={`text-2xl font-semibold ${getGradeColor()}`}>
        [{grade}]
      </div>
    </div>
  );
}

