import React from "react";
import { Card, HR, CompassLogomark } from "../components/Atoms";

export default function AboutView() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-45 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto">
        
        {/* Editorial Essay layout */}
        <div className="space-y-12">
          
          <div className="space-y-4">
            <span className="eyebrow">HEADING EDITORIAL MISSION STATEMENT</span>
            <h2 className="h-section text-ink font-semibold mt-2">
              Philosophical Instrument Alignment
            </h2>
          </div>

          {/* Blockquote / Elegant Display statement */}
          <blockquote className="border-l-2 border-navy pl-6 py-2 italic font-serif text-2xl text-navy-soft leading-relaxed">
            "Aviation does not reward memorization of questions; it rewards structural mental organization under severe physiological pressure."
          </blockquote>

          <div className="font-sans font-light text-ink-2 text-md leading-relaxed space-y-6">
            <p>
              Heading was founded by a team of active long-haul flight officers and aerospace instructional 
              designers who realized standard pilot-prep utilities were overcrowded directories which failed 
              to translate complex flight deck scenarios. We believe studying for CPL or ATPL rating exam 
              should match the pristine ergonomics of Swiss typographic principles and cockpit instruments.
            </p>
            <p>
              In aviation operations, clutter induces cognitive overhead. This is why every screen on the Heading 
              platform utilizes spacious negative margins, high contrast values, and strict regulatory alignments. 
              Our navigation features are designed around direct, linear workflows allowing you to lock in 
              specific knowledge vectors without distraction.
            </p>
          </div>

          <HR />

          {/* Flight Standards Card */}
          <Card className="bg-paper border border-rule-strong space-y-6 p-8">
            <div className="flex items-center gap-4">
              <CompassLogomark size={48} spin="rotate" className="text-signal" />
              <div>
                <h3 className="h-card-title text-ink font-semibold">Instrument Calibration Specs</h3>
                <span className="footnote text-[9px] tracking-widest text-muted-2">COMPLIANT INTEGRATIONS</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm font-light pt-4 border-t border-rule">
              <div className="space-y-2">
                <span className="font-mono text-xs text-ink font-semibold block uppercase">01. THE PAPER BACKDROP</span>
                <p className="text-muted leading-relaxed">
                  Our main canvas mimics actual physical flight manuals and plotting charts (warm parchment #f5f2ea), 
                  reducing optic strain during extended night study runs.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs text-ink font-semibold block uppercase">02. COMPASS DIAL METRIC</span>
                <p className="text-muted leading-relaxed">
                  Our official logomark is configured precisely to 030° — representing standard magnetic heading 
                  transitions on high-altitude departures.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs text-ink font-semibold block uppercase">03. COGNITIVE LATENCY TIMING</span>
                <p className="text-muted leading-relaxed">
                  We measure response latency to the tenth of a second, preparing cadets for timed authority 
                  assessments where every second represents flight distance.
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-mono text-xs text-ink font-semibold block uppercase">04. AERONAUTIC REGULATION REFERENCE</span>
                <p className="text-muted leading-relaxed">
                  We publish exact references to FAA Federal Regulations, EASA Part-FCL codes, and DGCA Civil Aviation Requirements 
                  alongside every core study card.
                </p>
              </div>
            </div>
          </Card>

          {/* Footer of the segment */}
          <div className="pt-8 text-center">
            <span className="footnote text-muted-2 text-[9px]">
              HEADING SYSTEM SPECIFICATION v1.0.0 · ALL RUNS RECORDED
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
