export function getConfiguredApiBaseUrl() {
  const configured = import.meta.env.VITE_AIRMENTOR_API_BASE_URL?.trim();
  return configured || 'http://127.0.0.1:4000';
}

const SEMESTER_PALETTE: Record<number, string> = {
  1: '#22d3ee', 2: '#34d399', 3: '#fbbf24', 4: '#fb923c', 5: '#f472b6', 6: '#a78bfa',
  7: '#ef4444', 8: '#3b82f6',
};
export function semesterColor(n: number) { return SEMESTER_PALETTE[n] ?? SEMESTER_PALETTE[1]; }

export const getGlass = (isLight: boolean) => isLight ? {
  background: 'rgba(255, 255, 255, 0.4)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.8)', boxShadow: '0 8px 32px rgba(0,0,0,0.05)'
} : {
  background: 'rgba(15, 23, 42, 0.4)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
};
