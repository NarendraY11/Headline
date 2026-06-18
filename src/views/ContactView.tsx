import React, { useState } from "react";
import { Card, HR, Button } from "../components/Atoms";
import { useToast } from "../components/ui/Toast";
import { useHoneypot } from "../components/Honeypot";
import { supabase } from "../lib/supabase";
import { Mail, Phone, MapPin, Send, CheckCircle2 } from "lucide-react";

export default function ContactView() {
  const { showToast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "support",
    message: ""
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const honeypot = useHoneypot();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Bot trap: silently feign success, write nothing.
    if (honeypot.isBot) {
      setSubmitted(true);
      return;
    }

    if (!formData.name || !formData.email || !formData.message) {
      showToast({
        title: "Validation Error",
        message: "Please fill out all required fields before dispatching your flight note.",
        type: "error"
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("contact_messages").insert({
        name: formData.name.trim().slice(0, 200),
        email: formData.email.trim().toLowerCase().slice(0, 320),
        subject: formData.subject,
        message: formData.message.trim().slice(0, 5000),
      });
      if (error) throw error;

      setSubmitted(true);
      showToast({
        title: "Message Dispatched",
        message: "Your briefing report was successfully received. Our ground crew will contact you shortly.",
        type: "success"
      });
    } catch (err: any) {
      console.error("Contact submission failed:", err);
      showToast({
        title: "Transmission Failed",
        message: err?.message || "Could not send your message. Please try again.",
        type: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFormData({
      name: "",
      email: "",
      subject: "support",
      message: ""
    });
    setSubmitted(false);
  };

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-45 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />

      <div className="relative z-10 px-4 py-8 md:py-16 max-w-5xl mx-auto">
        
        {/* Editorial Heading */}
        <div className="space-y-12">
          
          <div className="space-y-4">
            <span className="eyebrow block">HEADING COMMUNICATIONS SYSTEMS</span>
            <h1 className="h-section text-ink font-semibold mt-2">
              Contact Ground Crew Dispatch
            </h1>
            <p className="font-mono text-xs text-muted-2 uppercase tracking-wider">
              Channel: 121.5 MHz · Dispatch Support Desk
            </p>
          </div>

          <HR />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            
            {/* Contact Details Column */}
            <div className="lg:col-span-5 space-y-6">
              
              <div className="space-y-2">
                <h3 className="font-serif font-medium text-lg text-ink">Operational Base Directory</h3>
                <p className="text-sm font-sans font-light text-muted leading-relaxed">
                  Have questions about your pilot ground school membership, technical instrumentation bugs, 
                  or regulatory syllabus mappings? Deploy a direct written note below or drop a briefing to our 
                  central offices.
                </p>
              </div>

              {/* EDIT THESE - Contact card info */}
              <div className="border border-dashed border-rule-strong p-6 bg-panel/30 space-y-5 rounded-sm">
                <span className="font-mono text-[10px] tracking-widest text-amber block font-semibold uppercase">
                  ⚙️ OPERATOR CONTACT DIRECTORY (EDIT THESE DETAILS)
                </span>
                
                <div className="space-y-4">
                  
                  <div className="flex gap-3 items-start">
                    <Mail size={16} className="text-signal shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider block">Central Support Mail</span>
                      <strong className="text-sm text-ink break-all font-mono">[EDIT: support@headingeditorial.com]</strong>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <MapPin size={16} className="text-signal shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider block">Registered Corporate HQ</span>
                      <strong className="text-sm text-ink font-sans font-light block">
                        [EDIT: Runway 3, Chakeri Airport Area]
                      </strong>
                      <span className="text-xs text-muted font-sans font-light">
                        [EDIT: Kanpur, Uttar Pradesh, 208008, India]
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-3 items-start">
                    <Phone size={16} className="text-signal shrink-0 mt-0.5" />
                    <div>
                      <span className="font-mono text-[9px] text-muted-2 uppercase tracking-wider block">Operational Hotline</span>
                      <strong className="text-sm text-ink font-mono">[EDIT: +91 512 555 0192]</strong>
                    </div>
                  </div>

                </div>
              </div>

              <div className="bg-paper border border-rule-strong p-4 rounded-sm space-y-2">
                <span className="font-mono text-[9px] text-mint uppercase tracking-widest font-semibold block">● CENTRAL OPERATIONS SYSTEM STATUS</span>
                <p className="text-xs text-muted font-sans font-light">
                  Our dispatch crew is active Monday through Friday, 09:00 to 18:00 IST (UTC +5:30). Average payload response latency is under 18 hours.
                </p>
              </div>

            </div>

            {/* Interactive Contact Form Column */}
            <div className="lg:col-span-7">
              <Card className="bg-paper border border-rule-strong p-6 md:p-8">
                
                {submitted ? (
                  <div className="text-center py-8 space-y-4 animate-[fadeIn_0.4s_ease-out]">
                    <div className="flex justify-center">
                      <CheckCircle2 size={48} className="text-mint animate-bounce" />
                    </div>
                    <h4 className="font-serif font-medium text-xl text-ink">Signal Lock Confirmed</h4>
                    <p className="text-sm text-muted max-w-md mx-auto leading-relaxed">
                      Your operational dispatch has been logged in our queue. A flight controller has been 
                      assigned to your ticket and will follow up with you via <strong>{formData.email}</strong> shortly.
                    </p>
                    <div className="pt-4">
                      <Button variant="ghost" onClick={handleReset} className="h-9 text-xs">
                        Dispatch Another Transmission
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleSubmit} className="space-y-5">
                    {honeypot.field}

                    <div className="space-y-1">
                      <h4 className="font-serif font-semibold text-lg text-ink">Transmit Briefing</h4>
                      <p className="text-xs text-muted font-sans font-light">Ensure your return email coordinates are configured precisely.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label htmlFor="contact-name" className="font-mono text-[10px] text-muted-2 uppercase tracking-wider block">
                          Cadet Name <span className="text-signal">*</span>
                        </label>
                        <input
                          id="contact-name"
                          name="name"
                          type="text"
                          autoComplete="name"
                          required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full bg-[#fcfcf9] dark:bg-[#1a1c18] border border-rule px-3 py-2 text-sm text-ink font-sans focus:outline-none focus:border-signal transition-colors rounded-sm"
                          placeholder="Captain John Doe"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label htmlFor="contact-email" className="font-mono text-[10px] text-muted-2 uppercase tracking-wider block">
                          Return Email Location <span className="text-signal">*</span>
                        </label>
                        <input
                          id="contact-email"
                          name="email"
                          type="email"
                          autoComplete="email"
                          inputMode="email"
                          required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className="w-full bg-[#fcfcf9] dark:bg-[#1a1c18] border border-rule px-3 py-2 text-sm text-ink font-sans focus:outline-none focus:border-signal transition-colors rounded-sm"
                          placeholder="john@aeroflight.com"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-subject" className="font-mono text-[10px] text-muted-2 uppercase tracking-wider block">
                        Transmission Classification
                      </label>
                      <select
                        id="contact-subject"
                        value={formData.subject}
                        onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                        className="w-full bg-[#fcfcf9] dark:bg-[#1a1c18] border border-rule px-3 py-2 text-sm text-ink font-sans focus:outline-none focus:border-signal transition-colors rounded-sm"
                      >
                        <option value="support">Technical & Auth Support</option>
                        <option value="billing">Billing & Razorpay Subscriptions</option>
                        <option value="curriculum">Aviation Syllabus Mappings</option>
                        <option value="enterprise">FTO / Aviation Academy licensing</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="contact-message" className="font-mono text-[10px] text-muted-2 uppercase tracking-wider block">
                        Payload Message <span className="text-signal">*</span>
                      </label>
                      <textarea
                        id="contact-message"
                        name="message"
                        required
                        rows={5}
                        value={formData.message}
                        onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                        className="w-full bg-[#fcfcf9] dark:bg-[#1a1c18] border border-rule px-3 py-2 text-sm text-ink font-sans focus:outline-none focus:border-signal transition-colors rounded-sm"
                        placeholder="Detail your operational query or subscription bug coordinates..."
                      />
                    </div>

                    <div className="pt-2">
                      <Button
                        type="submit"
                        variant="primary"
                        className="w-full h-11 flex justify-center items-center gap-2 font-semibold"
                        disabled={loading}
                      >
                        {loading ? (
                          <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <Send size={15} />
                            Transmit Flight Note
                          </>
                        )}
                      </Button>
                    </div>

                  </form>
                )}

              </Card>
            </div>

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
