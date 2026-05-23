import React from "react";
import { Link } from "react-router-dom";
import { motion } from "motion/react";
import { Button, Chip } from "../components/Atoms";
import { CheckCircle2 } from "lucide-react";
import { trackEvent } from "../lib/track";

// Scroll reveal helper
const FadeUp: React.FC<{ children: React.ReactNode, delay?: number, className?: string }> = ({ children, delay = 0, className = "" }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: delay / 1000, ease: [0.21, 0.47, 0.32, 0.98] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function PricingView() {
  return (
    <div className="pt-[64px] min-h-screen bg-bg">
      <section id="pricing" className="py-24 md:py-32 max-w-[1000px] mx-auto px-6 w-full">
         <FadeUp className="text-center mb-16">
            <span className="eyebrow block mb-6 text-[10px]">ACCESS TIERS</span>
            <h2 className="font-serif text-[56px] text-ink mb-6 tracking-tight leading-none">Invest in your exam pass.</h2>
            <p className="font-sans text-ink-2 font-light text-[18px]">Simple pricing. Essential for student pilots.</p>
         </FadeUp>
         
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            <FadeUp delay={100} className="h-full">
               <div className="border border-rule bg-paper rounded-[24px] p-10 h-full flex flex-col hover:border-ink/50 transition-colors">
                  <h3 className="font-sans font-semibold text-[24px] text-ink mb-2">Cadet</h3>
                  <p className="font-sans text-[14px] text-muted mb-8">Test the flight controls.</p>
                  <div className="font-serif text-[64px] leading-none text-ink text-opacity-80 mb-10">Free<span className="font-sans text-lg text-muted font-light align-top"></span></div>
                  
                  <ul className="space-y-4 font-sans text-[15px] text-ink-2 mb-10 flex-1">
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-muted opacity-50 shrink-0" /> 100 sample questions</li>
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-muted opacity-50 shrink-0" /> 1 standard mock exam</li>
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-muted opacity-50 shrink-0" /> Basic analytic logbook</li>
                  </ul>
                  
                  <Link to="/modules"><Button variant="ghost" className="w-full justify-center h-[52px] text-[15px] rounded-full">Explore Free Sets</Button></Link>
               </div>
            </FadeUp>
            
            <FadeUp delay={200} className="h-full relative">
               <div className="absolute top-0 right-0 -tr-translate-y-1/2 translate-x-1/4 translate-y-[-16px] z-10">
                 <Chip variant="solid" className="bg-navy text-bg text-[10px] px-3 py-1.5 shadow-md transform rotate-3 tracking-widest font-semibold uppercase border-navy-soft border">CLEARANCE DELIVERY</Chip>
               </div>
               <div className="border-2 border-navy bg-paper rounded-[24px] p-10 h-full flex flex-col shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-navy/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/3" />
                  
                  <h3 className="font-sans font-semibold text-[24px] text-navy mb-2 relative z-10">Captain (Pro)</h3>
                  <p className="font-sans text-[14px] text-navy/70 mb-8 font-medium relative z-10">The complete arsenal.</p>
                  <div className="font-serif text-[64px] text-ink mb-10 flex items-end gap-2 relative z-10 leading-none">
                    ₹499<span className="font-sans text-[18px] text-muted font-light mb-1">/mo</span>
                  </div>
                  
                  <ul className="space-y-4 font-sans text-[15px] text-ink-2 mb-10 flex-1 relative z-10">
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-navy shrink-0" /> Full 6,940+ question database</li>
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-navy shrink-0" /> Unlimited DGCA & EASA Mock Exams</li>
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-navy shrink-0" /> Generative AI Ground Instructor (Gemini)</li>
                    <li className="flex items-start gap-4"><CheckCircle2 size={20} className="text-navy shrink-0" /> Advanced Weakness Heatmaps & Diagnosis</li>
                  </ul>
                  
                  <div className="relative z-10">
                    <Button variant="primary" onClick={() => trackEvent("upgrade_pro")} className="w-full justify-center h-[52px] text-[15px] rounded-full shadow-lg bg-navy hover:bg-navy/90 border-0">Activate Subscription</Button>
                    <div className="text-center mt-4 font-mono text-[9px] text-muted tracking-widest uppercase">Or ₹2,999 / year (Save 50%)</div>
                  </div>
               </div>
            </FadeUp>
         </div>
      </section>
    </div>
  );
}
