import { HR } from "../components/Atoms";

export default function TermsView() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-45 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto">
        
        {/* Editorial Heading */}
        <div className="space-y-12">
          
          <div className="space-y-4">
            <span className="eyebrow block">HEADING REGULATORY COMPLIANCE</span>
            <h2 className="h-section text-ink font-semibold mt-2">
              Terms & Conditions of Service
            </h2>
            <p className="font-mono text-xs text-muted-2 uppercase tracking-wider">
              Last Updated: May 24, 2026 · Doc-ID: H-POL-TMS-4.0
            </p>
          </div>

          {/* Legal Disclaimer Note at the Top */}
          <div className="bg-amber-50/50 border border-amber-250/70 p-5 rounded-md space-y-2 dark:bg-amber-950/20 dark:border-amber-800/50">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-mono text-xs font-semibold uppercase">
              <span>⚠️ ACTION REQUIRED: JURISDICTIONAL REVIEW DISCLAIMER</span>
            </div>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/80 font-sans leading-relaxed">
              <strong>ATTENTION OPERATOR:</strong> These Terms and Conditions represent a template framework 
              for Google OAuth, AdSense integration, and Razorpay standard billing compliance. It is <strong>NOT</strong> 
              substantive legal advice. You must have this document reviewed by a qualified corporate attorney 
              licensed in your jurisdiction before relying on its terms or publishing this service for commercial use.
            </p>
          </div>

          {/* EDIT THESE - Business configuration coordinator */}
          <div className="border border-dashed border-rule-strong p-6 bg-panel/30 space-y-4 rounded-sm">
            <span className="font-mono text-[10px] tracking-widest text-[#DF9D38] block font-semibold uppercase">
              ⚙️ OPERATOR CONFIGURATION CARD (EDIT THESE DETAILS)
            </span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono text-muted">
              <div>
                <span className="text-muted-2 block">1. Legal Entity Name:</span>
                <strong className="text-ink">[EDIT: HEADING EDITORIAL PRIVATE LIMITED]</strong>
              </div>
              <div>
                <span className="text-muted-2 block">2. Official Contact Email:</span>
                <strong className="text-ink">[EDIT: support@headingeditorial.com]</strong>
              </div>
              <div className="md:col-span-2">
                <span className="text-muted-2 block">3. Registered Business Office Address:</span>
                <strong className="text-ink">[EDIT: Runway 3, Chakeri Airport Area, Kanpur, Uttar Pradesh, 208008, India]</strong>
              </div>
            </div>
          </div>

          {/* Comprehensive Content Sections */}
          <div className="font-sans font-light text-ink-2 text-md leading-relaxed space-y-8">
            
            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">1. Acceptance of Terms</h3>
              <p>
                By accessing, registration-keying, or study-navigating the Heading preparation program, you signify 
                unconditional agreement to these Terms & Conditions. If you do not accept these articles, do not arm 
                the flight decks or login to our educational systems.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">2. Critical Aviation Training Disclaimer</h3>
              <div className="bg-red-500/5 border border-red-500/20 px-5 py-4 rounded-sm italic text-red-700/95 dark:text-red-400 font-serif leading-relaxed text-sm">
                "Heading is strictly an offline-first pilot-prep academic aid. It does <strong>NOT</strong> represent any official Civil Aviation Authority, including but not limited to the FAA (USA), EASA (Europe), or DGCA (India). Heading does <strong>NOT</strong> grant any flight ratings, pilot licensing, airspace authorization, or regulatory credentials. It does <strong>NOT</strong> substitute for actual hands-on flight commands or approved flight training school (FTO) curricular instruction."
              </div>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">3. License, Acceptable Use & Sharing Constraints</h3>
              <p>
                We authorize registered students a restricted, non-transferable, single-seat academic subscription license 
                to explore Heading for personal exam preparation. You explicitly covenant <strong>not to:</strong>
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted">
                <li>Share, swap, or re-vende subscription coordinates or credentials with secondary flight students. One license permits exclusive single-user logins.</li>
                <li>Deploy automated crawling mechanisms, data scrapers, or indexers to parse, retrieve, or copy our question databases, explanations, or diagrams.</li>
                <li>Attempt to bypass paywall gateways, secure pro-gates, or simulation engines on our server-side networks.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">4. Intellectual Property Integrity</h3>
              <p>
                All elements built on Heading — comprising typographic style guides, code mechanisms, server-side APIs, sample exams, 
                aerological diagrams, explanation logs, and AI coaching architectures — represent exclusive intellectual assets owned by 
                <strong> [EDIT: HEADING EDITORIAL PRIVATE LIMITED]</strong> or licensed by our software designers. Unauthorized copying, modification, 
                or reverse-engineering of our software structure or visual layout triggers immediate suppression of service without refund.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">5. Subscription Billings & Merchant Terms</h3>
              <p>
                Access to designated premium study blueprints requires a fee processing step routed via <strong>Razorpay</strong>. Billing configurations are handled on a recurring billing cycle according to the pricing tier activated (monthly, yearly, or as otherwise outlined).
              </p>
              <p>
                Operator reserves the absolute right to alter plan fees with at least 14 days preview notification. Your continued login after any change confirms agreement to the updated pricing system.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">6. Limitation of Liability</h3>
              <p>
                In no event shall we, our directors, employees, or flight coaches be held liable for any aviation failure, regulatory exam disqualification, 
                flight simulator training setbacks, license application delays, or any consequential damages arising directly or indirectly from using 
                this training platform. All contents are delivered "as-is" without warranty of any kind.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">7. Governing Law & Location of Settlement</h3>
              <p>
                These covenants and all transaction operations associated with Heading are interpreted, governed, and governed in accordance with 
                the laws of <strong>India</strong>. Any litigation, dispute, or conflict arising from these policies shall be subject to the exclusive 
                jurisdiction of the courts of <strong>Kanpur, Uttar Pradesh, India</strong>.
              </p>
            </section>

          </div>

          <HR />

          {/* Calibration footer signature */}
          <div className="pt-4 text-center">
            <span className="footnote text-muted-2 text-[9px]">
              HEADING SYSTEM COMPLIANCE DOCUMENTATION · ALL CHANNELS CRYPTOGRAPHICALLY CONTROLLED
            </span>
          </div>

        </div>

      </div>
    </div>
  );
}
