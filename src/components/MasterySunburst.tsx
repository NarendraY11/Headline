import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import { SubjectItem } from "../data/topics";
import { Card, Button } from "./Atoms";
import { Info, Archive, Star, Target, CheckCircle, AlertTriangle } from "lucide-react";

interface MasterySunburstProps {
  subjectsList: SubjectItem[];
  logbook: any[];
}

interface SunburstNodeData {
  id: string;
  name: string;
  code: string;
  questionCount: number;
  correct: number;
  total: number;
  score: number | null;
  hue?: string;
  value?: number;
  children?: SunburstNodeData[];
}

export function MasterySunburst({ subjectsList, logbook }: MasterySunburstProps) {
  const svgRef = useRef<SVGSVGElement>(null);

  // Interaction State
  const [hoveredNode, setHoveredNode] = useState<d3.HierarchyRectangularNode<SunburstNodeData> | null>(null);
  const [selectedNode, setSelectedNode] = useState<d3.HierarchyRectangularNode<SunburstNodeData> | null>(null);
  const [sizeMode, setSizeMode] = useState<"questions" | "equal">("questions");

  // Load question-level progress map from local storage
  const [progressMap, setProgressMap] = useState<Record<string, any>>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem("heading_question_progress");
      if (saved) {
        setProgressMap(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Failed to load question progress in MasterySunburst:", e);
    }
  }, []);

  // Compute hierarchical tree
  const buildHierarchyData = (): SunburstNodeData => {
    const rootChildren: SunburstNodeData[] = [];
    const normalize = (s: string) => s.replace(/[^a-z0-9]/gi, "").toLowerCase();

    subjectsList.forEach((sub) => {
      const children: SunburstNodeData[] = [];

      if (sub.subTopics && sub.subTopics.length > 0) {
        sub.subTopics.forEach((st) => {
          let correct = 0;
          let total = 0;

          // Compute correct/total from key-value progress map
          Object.values(progressMap).forEach((prog: any) => {
            if (prog.topic_id && normalize(prog.topic_id) === normalize(st.id)) {
              total++;
              if (prog.correct) correct++;
            }
          });

          // Aggregate from block logbook sessions
          logbook.forEach((entry) => {
            if (entry.topicId === st.id) {
              correct += entry.correct || 0;
              total += entry.total || 0;
            }
          });

          const score = total > 0 ? Math.round((correct / total) * 100) : null;

          children.push({
            id: st.id,
            name: st.title,
            code: st.code || `ATA ${st.id.replace("ata-", "").toUpperCase()}`,
            questionCount: st.questionCount || 20,
            correct,
            total,
            score,
            hue: sub.hue,
            value: sizeMode === "questions" ? (st.questionCount || 20) : 10,
          });
        });
      } else {
        // Fallback for subjects without fine-grained subtopics
        let correct = 0;
        let total = 0;

        Object.values(progressMap).forEach((prog: any) => {
          if (prog.topic_id && normalize(prog.topic_id) === normalize(sub.id)) {
            total++;
            if (prog.correct) correct++;
          }
        });

        logbook.forEach((entry) => {
          if (entry.topicId === sub.id) {
            correct += entry.correct || 0;
            total += entry.total || 0;
          }
        });

        const score = total > 0 ? Math.round((correct / total) * 100) : null;

        children.push({
          id: sub.id,
          name: sub.title,
          code: sub.num || "ATA",
          questionCount: sub.questionCount || 50,
          correct,
          total,
          score,
          hue: sub.hue,
          value: sizeMode === "questions" ? (sub.questionCount || 50) : 10,
        });
      }

      const totalCorrect = children.reduce((sum, c) => sum + c.correct, 0);
      const totalAttempted = children.reduce((sum, c) => sum + c.total, 0);
      const subjectScore = totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : null;
      const totalQuestionsCount = children.reduce((sum, c) => sum + c.questionCount, 0);

      rootChildren.push({
        id: sub.id,
        name: sub.title,
        code: sub.num ? `§ ${sub.num}` : "ATA",
        questionCount: totalQuestionsCount,
        correct: totalCorrect,
        total: totalAttempted,
        score: subjectScore,
        hue: sub.hue,
        children,
      });
    });

    const rootCorrect = rootChildren.reduce((sum, c) => sum + c.correct, 0);
    const rootAttempted = rootChildren.reduce((sum, c) => sum + c.total, 0);
    const overallScore = rootAttempted > 0 ? Math.round((rootCorrect / rootAttempted) * 100) : null;
    const overallQuestions = rootChildren.reduce((sum, c) => sum + c.questionCount, 0);

    return {
      id: "root-mastery",
      name: "Pilot Registry",
      code: "ALL",
      questionCount: overallQuestions,
      correct: rootCorrect,
      total: rootAttempted,
      score: overallScore,
      children: rootChildren,
    };
  };

  const hierarchyData = buildHierarchyData();

  useEffect(() => {
    if (!svgRef.current) return;

    // Dimensions
    const width = 500;
    const height = 500;
    const radius = width / 2;
    const innerRadius = 75;

    // Clear previous elements
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", "100%")
      .attr("height", "100%")
      .append("g")
      .attr("transform", `translate(${width / 2}, ${height / 2})`);

    // D3 Scales for layout calculations
    const x = d3.scaleLinear().range([0, 2 * Math.PI]);
    const y = d3.scaleLinear().range([innerRadius, radius]);

    // Format hierarchy
    const root = d3.hierarchy<SunburstNodeData>(hierarchyData)
      .sum(d => d.value || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0)) as unknown as d3.HierarchyRectangularNode<SunburstNodeData>;

    // Create D3 Partition
    const partition = d3.partition<SunburstNodeData>();
    partition(root);

    // Arc Generator
    const arc = d3.arc<d3.HierarchyRectangularNode<SunburstNodeData>>()
      .startAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x0))))
      .endAngle(d => Math.max(0, Math.min(2 * Math.PI, x(d.x1))))
      .innerRadius(d => Math.max(0, y(d.y0)))
      .outerRadius(d => Math.max(0, y(d.y1)));

    // Color mapper based on actual telemetry
    const getNodeColor = (d: d3.HierarchyRectangularNode<SunburstNodeData>) => {
      if (d.depth === 0) return "transparent";

      if (d.data.score !== null) {
        const score = d.data.score;
        if (score >= 80) return "rgba(44, 110, 84, 0.85)"; // polished green
        if (score >= 50) return "rgba(201, 138, 43, 0.85)"; // polished amber
        return "rgba(194, 64, 46, 0.85)"; // critical signal red
      }

      // Fallback elegant palette based on core subject line color
      const hue = d.data.hue || "navy";
      if (d.depth === 1) {
        switch (hue) {
          case "navy": return "rgba(20, 48, 90, 0.16)";
          case "sky": return "rgba(65, 115, 168, 0.16)";
          case "mint": return "rgba(44, 110, 84, 0.16)";
          case "amber": return "rgba(201, 138, 43, 0.16)";
          default: return "rgba(13, 26, 45, 0.12)";
        }
      } else {
        switch (hue) {
          case "navy": return "rgba(20, 48, 90, 0.08)";
          case "sky": return "rgba(65, 115, 168, 0.08)";
          case "mint": return "rgba(44, 110, 84, 0.08)";
          case "amber": return "rgba(201, 138, 43, 0.08)";
          default: return "rgba(13, 26, 45, 0.06)";
        }
      }
    };

    // Slice paths
    const path = svg.selectAll<SVGPathElement, d3.HierarchyRectangularNode<SunburstNodeData>>("path")
      .data(root.descendants().filter(d => d.depth > 0))
      .enter().append("path")
      .attr("d", arc)
      .style("fill", d => getNodeColor(d))
      .style("stroke", "var(--color-paper)")
      .style("stroke-width", "1.5px")
      .style("cursor", "pointer")
      .on("mouseover", (event, d) => {
        setHoveredNode(d);
      })
      .on("mouseleave", () => {
        setHoveredNode(null);
      })
      .on("click", (event, p) => {
        event.stopPropagation();
        zoomToNode(p);
      });

    // Add overlay center circle for simple back navigation and status reporting
    svg.append("circle")
      .attr("r", innerRadius - 2)
      .style("fill", "var(--color-paper)")
      .style("stroke", "var(--color-rule)")
      .style("stroke-width", "1px")
      .style("cursor", "pointer")
      .on("click", (event) => {
        event.stopPropagation();
        if (selectedNode && selectedNode.parent) {
          zoomToNode(selectedNode.parent);
        } else if (selectedNode) {
          zoomToNode(root);
        }
      });

    // Handle zoom behavior using SVG path interpolation
    function zoomToNode(p: d3.HierarchyRectangularNode<SunburstNodeData>) {
      setSelectedNode(p.depth === 0 ? null : p);

      // Transition the scale domains
      path.transition()
        .duration(750)
        .tween("data", () => {
          const xd = d3.interpolate(x.domain(), [p.x0, p.x1]);
          const yd = d3.interpolate(y.domain(), [p.y0, 1]);
          const yr = d3.interpolate(y.range(), [p.depth > 0 ? 40 : innerRadius, radius]);
          return (t) => {
            x.domain(xd(t));
            y.domain(yd(t)).range(yr(t));
          };
        })
        .attrTween("d", d => () => arc(d) || "");
    }

  }, [hierarchyData, sizeMode, progressMap, selectedNode]);

  // Node to display inside the donut hole (hover takes precedence, then active zoom node, then root level metrics)
  const displayNode = hoveredNode || selectedNode || { depth: 0, data: hierarchyData };
  const hasScore = displayNode.data.score !== null;

  return (
    <div className="w-full grid grid-cols-1 md:grid-cols-12 gap-8 items-start my-8">
      {/* LEFT: THE INTERACTIVE D3 SVG CANVAS */}
      <div className="md:col-span-7 flex flex-col items-center">
        <div className="relative w-full max-w-[380px] sm:max-w-[420px] aspect-square flex items-center justify-center">
          <svg ref={svgRef} className="w-full h-full drop-shadow-sm select-none" />

          {/* ABSOLUTE CENTER OVERLAY (READOUT WITHIN THE GAUGE) */}
          <div 
            className="absolute z-10 w-[130px] h-[130px] rounded-full flex flex-col items-center justify-center text-center p-3 pointer-events-none transition-all duration-300"
            style={{ top: "calc(50% - 65px)", left: "calc(50% - 65px)" }}
          >
            <span className="font-mono text-[9px] tracking-[0.1em] uppercase text-muted-2 leading-none mb-1">
              {displayNode.data.code}
            </span>
            <span className="font-serif text-[15px] font-bold text-ink leading-tight line-clamp-2 max-w-[110px] my-1">
              {displayNode.data.name}
            </span>
            <div className="flex flex-col items-center justify-center mt-1">
              <span className="font-serif text-2xl font-bold tracking-tight text-ink leading-none">
                {hasScore ? `${displayNode.data.score}%` : "--"}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider text-muted-2 mt-1">
                {displayNode.data.total > 0 ? `${displayNode.data.correct}/${displayNode.data.total} OK` : `${displayNode.data.questionCount} Qs`}
              </span>
            </div>
          </div>
        </div>

        {/* METRIC CONTROLS UNDER CHART */}
        <div className="mt-4 flex gap-2 items-center justify-center">
          <span className="font-mono text-[9px] tracking-widest uppercase text-muted-2">Scale Angular Width:</span>
          <Button 
            variant="ghost" 
            onClick={() => setSizeMode("questions")}
            className={`h-7 px-2.5 text-[9px] font-mono uppercase tracking-widest ${sizeMode === "questions" ? "bg-navy text-bg" : "border-transparent"}`}
          >
            Questions Count
          </Button>
          <Button 
            variant="ghost" 
            onClick={() => setSizeMode("equal")}
            className={`h-7 px-2.5 text-[9px] font-mono uppercase tracking-widest ${sizeMode === "equal" ? "bg-navy text-bg" : "border-transparent"}`}
          >
            Equal Angles
          </Button>
        </div>
      </div>

      {/* RIGHT: LEGEND AND ACTIVE TELEMETRY DETAIL PANEL */}
      <div className="md:col-span-5 flex flex-col gap-6 h-full justify-between">
        {/* DETAIL INSPECTOR CARD */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-[10px] tracking-widest uppercase text-ink-2 font-bold flex items-center gap-2">
              <Target size={14} className="text-signal animate-pulse" /> Telemetry Inspector
            </h3>
            {selectedNode && (
              <button 
                onClick={() => setSelectedNode(null)} 
                className="font-mono text-[9px] uppercase tracking-widest text-[#c2402e] hover:underline"
              >
                Reset Focus
              </button>
            )}
          </div>

          <Card className="bg-paper border border-rule p-4 space-y-4 shadow-sm relative overflow-hidden transition-all duration-300">
            {/* Design accents */}
            <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.03]">
              <Star size={64} className="text-navy" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[9px] tracking-wider uppercase text-muted">
                  {displayNode.depth === 0 ? "Global Hierarchy" : displayNode.depth === 1 ? "Chapter Node" : "Detail Segment"}
                </span>
                <span className="font-mono text-[9px] bg-rule-strong/20 px-1.5 py-0.5 rounded text-ink font-bold">
                  {displayNode.data.code}
                </span>
              </div>
              <h4 className="font-serif text-xl text-ink leading-tight font-medium">
                {displayNode.data.name}
              </h4>
            </div>

            <hr className="border-t border-rule" />

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-0.5">
                <span className="font-sans text-[10px] text-muted-2 uppercase">Competency Mastery</span>
                <div className="flex items-baseline gap-1.5">
                  <span className={`font-serif text-2xl font-bold ${hasScore ? (displayNode.data.score >= 80 ? "text-mint" : displayNode.data.score >= 50 ? "text-amber" : "text-signal") : "text-muted-2"}`}>
                    {hasScore ? `${displayNode.data.score}%` : "0%"}
                  </span>
                  <span className="font-mono text-[9px] text-muted">score</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <span className="font-sans text-[10px] text-muted-2 uppercase">Subject Scope</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="font-serif text-2xl font-bold text-ink">
                    {displayNode.data.questionCount}
                  </span>
                  <span className="font-mono text-[9px] text-muted">syllabus Qs</span>
                </div>
              </div>
            </div>

            {/* Performance status messages */}
            <div className="rounded p-2.5 flex gap-2.5 items-start text-xs leading-relaxed bg-bg-2/35 border border-rule/50">
              {hasScore ? (
                displayNode.data.score! >= 80 ? (
                  <>
                    <CheckCircle size={15} className="text-mint shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-mint block font-medium">Flight Ready (Mastery Achieved)</strong>
                      <span className="text-muted text-[11px]">Exceeds DGCA threshold standards. Periodic reviews advised to lock memory gates.</span>
                    </div>
                  </>
                ) : displayNode.data.score! >= 50 ? (
                  <>
                    <Info size={15} className="text-amber shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-amber block font-medium">Telemetry Warning (Partially Reviewed)</strong>
                      <span className="text-muted text-[11px]">Competency remains volatile. Re-run targeted review modules in {displayNode.data.name}.</span>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={15} className="text-signal shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-signal block font-medium">Ground Warning (Critical Gaps)</strong>
                      <span className="text-muted text-[11px]">Unacceptable performance margins. Prioritize mock exams or focus study immediately.</span>
                    </div>
                  </>
                )
              ) : (
                <>
                  <Archive size={15} className="text-muted shrink-0 mt-0.5" />
                  <div>
                    <strong className="text-ink-2 block font-medium">Syllabus Unexplored</strong>
                    <span className="text-muted text-[11px]">Telemetry record empty. Complete a simulation segment in this area to initialize tracking.</span>
                  </div>
                </>
              )}
            </div>

            {/* Tip info helper */}
            <p className="font-sans text-[11px] leading-snug text-muted">
              💡 <em>Navigation Tip:</em> Hover slices to overlay values. <strong>Click</strong> an arc to expand details. <strong>Click the center hole</strong> to zoom up one level.
            </p>
          </Card>
        </div>

        {/* SYSTEM COLOR LEGEND */}
        <div className="space-y-2 border-t border-rule pt-4">
          <span className="font-mono text-[9px] tracking-widest uppercase text-muted">Mastery Color Gates:</span>
          <div className="grid grid-cols-2 gap-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-mint block" />
              <span className="text-ink-2 text-[11px]">Optimal (≥ 80%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-amber block" />
              <span className="text-ink-2 text-[11px]">Warning (50% - 79%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-signal block" />
              <span className="text-ink-2 text-[11px]">Unacceptable (&lt; 50%)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-navy-soft/15 border border-rule block" />
              <span className="text-ink-2 text-[11px]">No Telemetry</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
