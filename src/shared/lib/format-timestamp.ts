/**
 * 타임스탬프를 읽기 쉬운 형식으로 변환합니다.
 * @param timestamp Unix timestamp (초 단위)
 * @returns 포맷팅된 시간 문자열
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  // 한국 시간으로 변환
  const koreaDate = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  const dateStr = koreaDate.toISOString().replace("T", " ").substring(0, 19);

  if (diffMins < 1) {
    return `방금 전 (${dateStr})`;
  } else if (diffMins < 60) {
    return `${diffMins}분 전 (${dateStr})`;
  } else if (diffHours < 24) {
    return `${diffHours}시간 전 (${dateStr})`;
  } else if (diffDays < 7) {
    return `${diffDays}일 전 (${dateStr})`;
  } else {
    return dateStr;
  }
}

