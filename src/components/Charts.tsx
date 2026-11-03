import { useEffect, useState } from 'react';
import {
  CartesianGrid, Line, LineChart, PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

/** 讀取目前主題的 CSS 變數，主題切換時重新渲染 */
function useThemeColors() {
  const read = () => {
    const s = getComputedStyle(document.documentElement);
    const v = (n: string) => s.getPropertyValue(n).trim();
    return { accent: v('--accent'), border: v('--border'), muted: v('--muted'), text: v('--text'), surface: v('--surface') };
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

const tooltipStyle = (c: ReturnType<typeof useThemeColors>) => ({
  contentStyle: { background: c.surface, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12, color: c.text },
  labelStyle: { color: c.text, fontWeight: 600 },
  itemStyle: { color: c.text },
});

export interface RadarPoint {
  label: string;
  /** 0–100；null 表示證據不足 */
  score: number | null;
}

/** 技能雷達圖：單一系列，不需要圖例；證據不足的項目以 0 繪製並在標籤註明 */
export function SkillRadar({ data }: { data: RadarPoint[] }) {
  const c = useThemeColors();
  // 未測項目不在軸標籤上加字，避免手機寬度被裁切；分數表格與提示框會標示「證據不足」
  const rows = data.map((d) => ({ axis: d.label, score: d.score ?? 0, raw: d.score }));
  return (
    <div className="h-64 w-full sm:h-72">
      <ResponsiveContainer>
        <RadarChart data={rows} outerRadius="66%" margin={{ top: 8, right: 28, bottom: 8, left: 28 }}>
          <PolarGrid stroke={c.border} />
          <PolarAngleAxis dataKey="axis" tick={{ fill: c.muted, fontSize: 11 }} />
          <PolarRadiusAxis domain={[0, 100]} tickCount={6} tick={false} axisLine={false} />
          <Radar dataKey="score" name="能力分數" stroke={c.accent} strokeWidth={2} fill={c.accent} fillOpacity={0.18} dot={{ r: 4, fill: c.accent, stroke: c.surface, strokeWidth: 2 }} isAnimationActive={false} />
          <Tooltip {...tooltipStyle(c)} formatter={(_v, _n, p) => [(p.payload as { raw: number | null }).raw === null ? '證據不足' : `${(p.payload as { raw: number }).raw} / 100`, '能力分數']} />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}

export interface TrendPoint {
  label: string;
  score: number;
}

/** 測驗成績趨勢：單一系列折線，十字準線 + 提示框 */
export function ScoreTrend({ data }: { data: TrendPoint[] }) {
  const c = useThemeColors();
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
          <CartesianGrid stroke={c.border} strokeDasharray="0" vertical={false} />
          <XAxis dataKey="label" tick={{ fill: c.muted, fontSize: 12 }} axisLine={{ stroke: c.border }} tickLine={false} />
          <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} tick={{ fill: c.muted, fontSize: 12 }} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipStyle(c)} cursor={{ stroke: c.muted, strokeWidth: 1 }} formatter={(v) => [`${v} 分`, '測驗分數']} />
          <Line type="monotone" dataKey="score" stroke={c.accent} strokeWidth={2} dot={{ r: 4, fill: c.accent, stroke: c.surface, strokeWidth: 2 }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
