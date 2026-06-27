// Phase 2 — hidden Learning Context settings page. Gated by the
// `learningContext` flag (OFF). No nav link. Read-only view of the user's
// active program / certification / aircraft / enrollment. Future phases let
// users edit + switch enrollment from here.

import { useEffect, useState } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useFeature } from "../hooks/useFeatureFlags";
import { resolveActiveLearningContext } from "../lib/learningContextDb";
import type { ActiveLearningContext } from "../lib/learningContext";

export default function LearningContextView() {
  const enabled = useFeature("learningContext");
  const { user, userData } = useAuth();
  const [ctx, setCtx] = useState<ActiveLearningContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!enabled) { setLoading(false); return; }
    let alive = true;
    resolveActiveLearningContext(user?.uid, {
      targetExam: (userData as any)?.targetExam ?? null,
      careerObjective: (userData as any)?.careerObjective ?? null,
    })
      .then((c) => { if (alive) setCtx(c); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [enabled, user?.uid, userData]);

  if (!enabled) {
    return (
      <div style={{ padding: 24, maxWidth: 640 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Learning Context</h1>
        <p style={{ marginTop: 8, opacity: 0.8 }}>
          This page is gated by the <code>learningContext</code> feature flag
          (currently OFF). Your study track continues to work through the
          existing profile.
        </p>
      </div>
    );
  }

  const Row = ({ k, v }: { k: string; v: string | null }) => (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eee" }}>
      <span style={{ opacity: 0.7 }}>{k}</span>
      <strong>{v ?? "—"}</strong>
    </div>
  );

  return (
    <div style={{ padding: 24, maxWidth: 640 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 16 }}>Learning Context</h1>
      {loading ? <p>Loading…</p> : ctx && (
        <div>
          <Row k="Source" v={ctx.source} />
          <Row k="Program" v={ctx.programId} />
          <Row k="Certification" v={ctx.certificationId} />
          <Row k="Aircraft" v={ctx.aircraftId} />
          <Row k="Family" v={ctx.family} />
          <Row k="Career objective" v={ctx.careerObjectiveId} />
          <Row k="Active enrollment" v={ctx.enrollmentId} />
          <Row k="Subjects in scope" v={ctx.subjectScope.length ? ctx.subjectScope.join(", ") : null} />
        </div>
      )}
    </div>
  );
}
