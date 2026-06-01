import { HR } from "../components/Atoms";

export default function PrivacyView() {
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
              Privacy & Data Protection Policy
            </h2>
            <p className="font-mono text-xs text-muted-2 uppercase tracking-wider">
              Last Updated: May 24, 2026 · Doc-ID: H-POL-PRV-4.0
            </p>
          </div>

          {/* Legal Disclaimer Note at the Top */}
          <div className="bg-amber-50/50 border border-amber-250/70 p-5 rounded-md space-y-2 dark:bg-amber-950/20 dark:border-amber-800/50">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-mono text-xs font-semibold uppercase">
              <span>⚠️ ACTION REQUIRED: JURISDICTIONAL REVIEW DISCLAIMER</span>
            </div>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/80 font-sans leading-relaxed">
              <strong>ATTENTION OPERATOR:</strong> This privacy policy is a template framework designed for 
              Google OAuth, AdSense integration, and Razorpay standard billing compliance. It is <strong>NOT</strong> 
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
              <h3 className="font-serif font-medium text-lg text-ink">1. Objective & Scope</h3>
              <p>
                At <strong>[EDIT: HEADING EDITORIAL PRIVATE LIMITED]</strong> (referred to as "we", "us", or "our"), we respect 
                the integrity of our users' personal and academic metrics. This Policy details how we govern the intake, 
                custody, processing, and distribution of personal information acquired via our pilot ground-training 
                platform, designed in accordance with Swiss typographic and aeronautic instrumentation principles.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">2. Collected Information Vectors</h3>
              <p>
                We capture specific datasets to maintain flight ground school training accuracy:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted">
                <li>
                  <strong className="text-ink">Identity & Credentials:</strong> Email addresses, display names, profile avatars 
                  provided during explicit sign-in initialization through high-security OAuth integrations (including Google Auth).
                </li>
                <li>
                  <strong className="text-ink">Aeronautic Progress & Study Metrics:</strong> Detailed records of answer selections, 
                  timestamped performance variables, mastery logs, customized study preferences, and quiz configurations to power 
                  our spaced repetition review scheduler.
                </li>
                <li>
                  <strong className="text-ink">Payment Context:</strong> Information processed during premium subscriptions, including transaction token 
                  metadata, order states, and billing identifiers. Note: We do not hold clear credit/debit card details directly; all payments are 
                  handled directly by our PCI-DSS compliant partner <strong>Razorpay</strong>.
                </li>
                <li>
                  <strong className="text-ink">System Logs & Telemetry Events:</strong> Non-sensitive browser identifiers, device profiles, 
                  dynamic window resizes, active sessions, and system latencies tracked to prevent operational crashes.
                </li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">3. Data Retainment, Hosting & Storage</h3>
              <p>
                Your private profiles and academic state histories are hosted in highly secure cloud architectures managed by 
                <strong> Supabase</strong>. These servers are hosted in secure data centers operating with advanced hardware access controls. 
                Data is stored in perpetuity until either (a) the user triggers an explicit account suppression action, or (b) an idle profile 
                shows zero interface check-ins for three (3) consecutive years, at which point it is automatically purged or archived.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">4. Cookie Guidelines & AdSense Personalization</h3>
              <p>
                Cookies are tiny system packets logged onto hard drives to calibrate interface consistency. Our platform executes 
                cookies to preserve user login sessions, store styling preferences, and coordinate analytical metrics.
              </p>
              <p>
                Additionally, we run with <strong>Google AdSense</strong>. Third-party advertising vendors, including Google, execute cookies to 
                serve personalized context based on your previous clicks on this or external virtual portals. Users can choose to opt-out 
                of personalized advertising frameworks entirely by adjusting their master configurations inside Google's Ads Preferences settings.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">5. Third-Party Integrations</h3>
              <p>
                Under no circumstances do we barter, vend, or lease your private logs to random marketers. We do share designated data 
                slots with specialized standard interfaces solely to fulfill operational requirements:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted">
                <li><strong className="text-ink">Google OAuth:</strong> To provide instant, passwordless sign-on utility.</li>
                <li><strong className="text-ink">Razorpay API:</strong> To fulfill card, NetBanking, and UPI subscription payment routes securely.</li>
                <li><strong className="text-ink">Gemini AI Engine:</strong> To generate AI-boosted ground-prep study items and analyze your weak operational subjects.</li>
                <li><strong className="text-ink">Google AdSense:</strong> To offer educational ads as support for operating ground infrastructure.</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">6. User Rights (GDPR & CFPB Alignment)</h3>
              <p>
                Whether you are studying under EASA, FAA, or DGCA jurisdictions, we grant uniform procedural rights relative to your personal records:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted">
                <li><strong className="text-ink">Right to Inspect:</strong> Request a comprehensive export copy of all logs recorded under your name.</li>
                <li><strong className="text-ink">Right to Recalibrate:</strong> Request corrections to misspelled names or flawed study settings.</li>
                <li><strong className="text-ink">Right to Reset/Delete:</strong> Request absolute and immediate termination of your registration, wiping all databases clean of your historical runs.</li>
              </ul>
              <p>
                To utilize these rights, escalate your written flight plan to our dispatch unit at <code className="text-xs bg-panel px-1.5 py-0.5 rounded text-signal break-all">[EDIT: support@headingeditorial.com]</code>.
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
