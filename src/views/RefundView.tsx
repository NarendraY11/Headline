import { HR } from "../components/Atoms";

export default function RefundView() {
  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-45 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto">
        
        {/* Editorial Heading */}
        <div className="space-y-12">
          
          <div className="space-y-4">
            <span className="eyebrow block">HEADING REGULATORY COMPLIANCE</span>
            <h1 className="h-section text-ink font-semibold mt-2">
              Refund & Cancellation Policy
            </h1>
            <p className="font-mono text-xs text-muted-2 uppercase tracking-wider">
              Last Updated: May 24, 2026 · Doc-ID: H-POL-REF-4.0
            </p>
          </div>

          {/* Legal Disclaimer Note at the Top */}
          <div className="bg-amber-50/50 border border-amber-250/70 p-5 rounded-md space-y-2 dark:bg-amber-950/20 dark:border-amber-800/50">
            <div className="flex items-center gap-2 text-amber-800 dark:text-amber-400 font-mono text-xs font-semibold uppercase">
              <span>⚠️ ACTION REQUIRED: JURISDICTIONAL REVIEW DISCLAIMER</span>
            </div>
            <p className="text-xs text-amber-700/90 dark:text-amber-400/80 font-sans leading-relaxed">
              <strong>ATTENTION OPERATOR:</strong> This cancellation and refund policy is a template framework 
              for Google OAuth, AdSense integration, and Razorpay standard billing compliance. It is <strong>NOT</strong> 
              substantive legal advice. You must have this document reviewed by a qualified corporate attorney 
              licensed in your jurisdiction before relying on its terms or publishing this service for commercial use.
            </p>
          </div>

          {/* EDIT THESE - Business configuration coordinator */}
          <div className="border border-dashed border-rule-strong p-6 bg-panel/30 space-y-4 rounded-sm">
            <span className="font-mono text-[10px] tracking-widest text-amber block font-semibold uppercase">
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
              <h3 className="font-serif font-medium text-lg text-ink">1. Subscription Billing Context</h3>
              <p>
                Heading offers premium training subscription tiers billed in advance at regular intervals (e.g. monthly, annually). All subscriptions originate through highly secured gateways managed by <strong>Razorpay</strong>. Subscriptions are configured to auto-renew by default at the end of each flight cycle.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">2. How to Cancel Your Subscription</h3>
              <p>
                Students retain the absolute authority to deactivate recurring billings at any time. Cancellation is entirely self-serve:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-muted">
                <li><strong className="text-ink">In-App Command:</strong> Navigate to the <em>Profile & Settings</em> interface inside the secure student console and click the "Deactivate Auto-Renew" command inside your Billing card.</li>
                <li><strong className="text-ink">Written Dispatch:</strong> Send a direct written cancellation request to our team at <code className="text-xs bg-panel px-1.5 py-0.5 rounded text-signal break-all">[EDIT: support@headingeditorial.com]</code> at least forty-eight (48) hours prior to your scheduled renewal date.</li>
              </ul>
              <p>
                Upon cancellation, your premium privileges will remain active until the end of your current subscription cycle. No automatic renewals will carry forward.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">3. 7-Day Money-Back Guarantee (Clear & Fair)</h3>
              <p>
                We stand firmly behind the precision of our study tools and pilot ground school curriculums. If you are dissatisfied with our materials within your first <strong>7 days</strong> of membership, you are eligible for an immediate, full, no-questions-asked refund of your initial subscription fee.
              </p>
              <p>
                <strong>Fair Use Constraint:</strong> To prevent index scraping and abuse of our content, the 7-day refund guarantee is valid only if the student has attempted fewer than <strong>ten (10) complete quiz study runs</strong> or mocked exams during this trial slot.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">4. Pro-Rated Refunds & Mid-Cycle Cancellation</h3>
              <p>
                Except as specified in our 7-Day Money-Back Guarantee, we do <strong>NOT</strong> provide pro-rated or partial refunds for billing runs that have already been executed. If you cancel your membership 15 days into your monthly billing cycle, you will retain access for the remaining 15 days, but no pro-rated credit will be returned or refunded to your account.
              </p>
            </section>

            <section className="space-y-3">
              <h3 className="font-serif font-medium text-lg text-ink">5. Refund Processing Timeline</h3>
              <p>
                Approved refunds are generated instantly on our master console and routed directly back through the original payment channel. Please note that banks, credit card companies, and payment networks (Razorpay / banks) typically require <strong>5 to 7 business days</strong> to process, reconcile, and post the refunded funds to your account statement.
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
