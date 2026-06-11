// M11/M11B: Admin Predictive Analytics Panel
// Fleet-level: pass probability distribution, subject risk heatmap,
// projected exam scores, study hour load, and risk factor summary.

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import {
  computePassProbability,
  computeSubjectRisks,
  computeFailureRisk,
  type RiskLevel,
} from "../../../lib/predictiveIntelligence";
import { computeStudyHourPrediction } from "../../../lib/forecastEngine";
import { deriveMasteryFields, type MasterySnapshotRow } from "../../../lib/masterySnapshot";
import { computeExamReadiness } from "../../../lib/examReadiness";

interface FleetStats {
  totalUsersWithSnapshots: number;
  avgPassProbability: number;
  highRiskUserCount: number;
  mediumRiskUserCount: number;
  lowRiskUserCount: number;
  subjectRiskSummary: { subjectId: string; highRiskUsers: number; avgMastery: number }[];
  avgStudyHoursPerWeek: number;
  usersNeedingMoreThan10h: number;
  avgCriticalSubjectsPerUser: number;
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub?: string; accent?: string }) {
  return (
    <div className="bg-paper border border-rule rounded-xl px-4 py-3">
      <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-1">{label}</p>
      <p className={`font-serif text-2xl ${accent ?? "text-ink"}`}>{value}</p>
      {sub && <p className="font-mono text-[9px] text-muted-2 mt-0.5">{sub}</p>}
    </div>
  );
}

const RISK_BAR_COLOR: Record<RiskLevel, string> = {
  HIGH:   "#e33a2e",
  MEDIUM: "#e5a93c",
  LOW:    "#16a34a",
};

export function PredictiveAnalytics() {
  const [stats, setStats] = useState<FleetStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);

    async function load() {
      try {
        // Fetch all mastery snapshot rows (admin, service-role RLS bypassed via is_admin)
        const { data: rows, error: rowErr } = await supabase
          .from("mastery_snapshots")
          .select("user_id,subject_id,mastery,correct_total,answers_total,correct_7d,total_7d,baseline_mastery,updated_at");

        if (rowErr) throw new Error(rowErr.message);
        if (!rows || rows.length === 0) {
          if (active) setStats(null);
          return;
        }

        // Group by user_id
        const byUser: Record<string, MasterySnapshotRow[]> = {};
        for (const r of rows) {
          if (!byUser[r.user_id]) byUser[r.user_id] = [];
          byUser[r.user_id].push(r as MasterySnapshotRow);
        }

        const userIds = Object.keys(byUser);
        let totalProbability = 0;
        let highRisk = 0, mediumRisk = 0, lowRisk = 0;
        let totalStudyHours = 0;
        let usersOver10h = 0;
        let totalCriticalSubjects = 0;
        const subjectHighMap: Record<string, { total: number; high: number; masterySum: number }> = {};

        for (const uid of userIds) {
          const snapshots = byUser[uid].map(deriveMasteryFields);
          const subjectMasteries: Record<string, number> = {};
          const answersTotals: Record<string, number> = {};
          for (const s of snapshots) {
            subjectMasteries[s.subject_id] = s.mastery;
            answersTotals[s.subject_id] = s.answers_total;
          }
          const readiness = computeExamReadiness({
            subjectMasteries,
            answersTotals,
            totalExamSubjects: snapshots.length,
            streakCount: 0,
            lastActivityDate: "",
          });
          const pp = computePassProbability(readiness, snapshots);
          const fr = computeFailureRisk(readiness, snapshots);
          totalProbability += pp.probability;
          if (fr.level === "HIGH") highRisk++;
          else if (fr.level === "MEDIUM") mediumRisk++;
          else lowRisk++;
          totalCriticalSubjects += fr.criticalCount;

          // M11B: study hours per user
          const studyHours = computeStudyHourPrediction(snapshots, 0, 12);
          totalStudyHours += studyHours.hoursPerWeek;
          if (studyHours.hoursPerWeek > 10) usersOver10h++;

          const subjectRisks = computeSubjectRisks(snapshots, {});
          for (const sr of subjectRisks) {
            if (!subjectHighMap[sr.subjectId]) subjectHighMap[sr.subjectId] = { total: 0, high: 0, masterySum: 0 };
            subjectHighMap[sr.subjectId].total++;
            subjectHighMap[sr.subjectId].masterySum += sr.mastery;
            if (sr.risk === "HIGH") subjectHighMap[sr.subjectId].high++;
          }
        }

        const subjectRiskSummary = Object.entries(subjectHighMap)
          .map(([subjectId, d]) => ({
            subjectId,
            highRiskUsers: d.high,
            avgMastery: Math.round(d.masterySum / d.total),
          }))
          .sort((a, b) => b.highRiskUsers - a.highRiskUsers);

        if (active) {
          setStats({
            totalUsersWithSnapshots: userIds.length,
            avgPassProbability: Math.round(totalProbability / userIds.length),
            highRiskUserCount: highRisk,
            mediumRiskUserCount: mediumRisk,
            lowRiskUserCount: lowRisk,
            subjectRiskSummary,
            avgStudyHoursPerWeek: Math.round(totalStudyHours / Math.max(1, userIds.length)),
            usersNeedingMoreThan10h: usersOver10h,
            avgCriticalSubjectsPerUser: Math.round((totalCriticalSubjects / Math.max(1, userIds.length)) * 10) / 10,
          });
        }
      } catch (e: unknown) {
        if (active) setError(e instanceof Error ? e.message : "Failed to load predictive analytics.");
      } finally {
        if (active) setLoading(false);
      }
    }

    void load();
    return () => { active = false; };
  }, []);

  return (
    <div className="bg-paper border border-rule rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="font-mono text-[8px] uppercase tracking-widest text-muted-2">Predictive Intelligence</span>
        <span className="h-[1px] flex-1 bg-rule" />
        <span className="font-mono text-[8px] text-muted-2 uppercase tracking-wide">Fleet analytics</span>
      </div>

      {loading && <div className="h-24 animate-pulse bg-bg-2 rounded-xl" />}

      {!loading && error && <p className="font-sans text-sm text-signal">{error}</p>}

      {!loading && !stats && !error && (
        <p className="font-mono text-[9px] text-muted-2 uppercase tracking-wide py-4 text-center">
          No mastery snapshot data yet. Enable masterySnapshots flag and have users complete quizzes.
        </p>
      )}

      {!loading && stats && (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            <StatCard label="Users with data" value={stats.totalUsersWithSnapshots} />
            <StatCard
              label="Avg pass probability"
              value={`${stats.avgPassProbability}%`}
              accent={stats.avgPassProbability >= 70 ? "text-mint" : stats.avgPassProbability >= 50 ? "text-amber" : "text-signal"}
            />
            <StatCard
              label="High risk users"
              value={stats.highRiskUserCount}
              sub={`${Math.round((stats.highRiskUserCount / stats.totalUsersWithSnapshots) * 100)}% of fleet`}
              accent={stats.highRiskUserCount > 0 ? "text-signal" : "text-ink"}
            />
            <StatCard
              label="On-track users"
              value={stats.lowRiskUserCount}
              sub={`${Math.round((stats.lowRiskUserCount / stats.totalUsersWithSnapshots) * 100)}% of fleet`}
              accent="text-mint"
            />
          </div>

          {/* M11B: forecast KPI row */}
          <div className="grid grid-cols-3 gap-3 mb-6">
            <StatCard
              label="Avg study load"
              value={`${stats.avgStudyHoursPerWeek}h/wk`}
              sub="to reach 75% mastery"
              accent={stats.avgStudyHoursPerWeek > 10 ? "text-signal" : stats.avgStudyHoursPerWeek > 5 ? "text-amber" : "text-mint"}
            />
            <StatCard
              label="High study load"
              value={stats.usersNeedingMoreThan10h}
              sub={`need >10h/wk`}
              accent={stats.usersNeedingMoreThan10h > 0 ? "text-amber" : "text-ink"}
            />
            <StatCard
              label="Avg critical subjects"
              value={stats.avgCriticalSubjectsPerUser}
              sub="per user (< 50% mastery)"
              accent={stats.avgCriticalSubjectsPerUser > 1 ? "text-signal" : "text-ink"}
            />
          </div>

          {/* Risk distribution bar */}
          <div className="mb-6">
            <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Fleet risk distribution</p>
            <div className="flex h-3 rounded-full overflow-hidden gap-px">
              {(["HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map(level => {
                const count = level === "HIGH" ? stats.highRiskUserCount : level === "MEDIUM" ? stats.mediumRiskUserCount : stats.lowRiskUserCount;
                const pct = Math.round((count / stats.totalUsersWithSnapshots) * 100);
                if (pct === 0) return null;
                return (
                  <div
                    key={level}
                    style={{ width: `${pct}%`, backgroundColor: RISK_BAR_COLOR[level] }}
                    title={`${level}: ${count} users (${pct}%)`}
                  />
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              {(["HIGH", "MEDIUM", "LOW"] as RiskLevel[]).map(level => {
                const count = level === "HIGH" ? stats.highRiskUserCount : level === "MEDIUM" ? stats.mediumRiskUserCount : stats.lowRiskUserCount;
                return (
                  <div key={level} className="flex items-center gap-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: RISK_BAR_COLOR[level] }} />
                    <span className="font-mono text-[8px] text-muted-2">{level} {count}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Subject risk table */}
          {stats.subjectRiskSummary.length > 0 && (
            <div>
              <p className="font-mono text-[8px] uppercase tracking-widest text-muted-2 mb-2">Subject risk — most at-risk first</p>
              <div className="space-y-1.5">
                {stats.subjectRiskSummary.slice(0, 6).map(s => {
                  const pct = Math.round((s.highRiskUsers / stats.totalUsersWithSnapshots) * 100);
                  const barColor = pct >= 30 ? "#e33a2e" : pct >= 15 ? "#e5a93c" : "#16a34a";
                  return (
                    <div key={s.subjectId} className="flex items-center gap-3">
                      <span className="font-mono text-[9px] text-ink w-36 truncate flex-shrink-0">{s.subjectId}</span>
                      <div className="flex-1 h-1.5 bg-bg-2 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                      </div>
                      <span className="font-mono text-[9px] text-muted-2 w-12 text-right flex-shrink-0">
                        {s.highRiskUsers} high
                      </span>
                      <span className="font-mono text-[9px] text-muted-2 w-12 text-right flex-shrink-0">
                        {s.avgMastery}% avg
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
