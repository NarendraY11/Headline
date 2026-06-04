interface Props {
  contactMessages: any[];
  leads: any[];
  handleResolveContact: (messageId: string, currentStatus: string) => void;
}

const subjectLabels: Record<string, string> = {
  support: "Technical & Auth Support",
  billing: "Billing & Subscriptions",
  curriculum: "Syllabus Mappings",
  enterprise: "FTO / Academy Licensing",
};

export function InboxPanel({ contactMessages, leads, handleResolveContact }: Props) {
  return (
    <div className="space-y-8">
      {/* Contact messages */}
      <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-rule pb-4 mb-4">
          <div>
            <h3 className="font-serif text-lg font-medium text-ink">Ground Crew Dispatch Inbox</h3>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Contact form submissions from pilots</p>
          </div>
          <span className="font-mono text-[9px] px-2.5 py-1 bg-sky-50 text-sky-800 border border-sky-200 uppercase tracking-wider rounded-md font-semibold">
            {contactMessages.length} Messages
          </span>
        </div>

        {contactMessages.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-rule rounded-lg">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">No contact messages received.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                  <th className="py-2.5 px-4 font-semibold w-44">Sender</th>
                  <th className="py-2.5 px-4 font-semibold w-44">Classification</th>
                  <th className="py-2.5 px-4 font-semibold">Message</th>
                  <th className="py-2.5 px-4 font-semibold text-center w-28">Status</th>
                  <th className="py-2.5 px-4 font-semibold text-right w-36">Received</th>
                </tr>
              </thead>
              <tbody>
                {contactMessages.map((msg) => {
                  const dateDisplay = new Date(msg.created_at).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <tr key={msg.id} className="border-b border-rule/50 hover:bg-bg-2/20 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-sans font-medium text-ink">{msg.name}</div>
                        <div className="font-mono text-[9px] text-muted mt-0.5 break-all">{msg.email}</div>
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-mono text-[9px] uppercase font-bold text-[#557B96]">
                          {subjectLabels[msg.subject] || msg.subject}
                        </div>
                      </td>
                      <td className="py-3 px-4 max-w-md">
                        <p className="font-sans text-xs text-ink-2 leading-relaxed break-words whitespace-pre-wrap">
                          {msg.message}
                        </p>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          onClick={() => handleResolveContact(msg.id, msg.status)}
                          className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[9.5px] font-bold border transition-colors cursor-pointer uppercase ${
                            msg.status === "resolved"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/50"
                              : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100/50"
                          }`}
                        >
                          {msg.status}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[10px] text-muted-2">
                        {dateDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Newsletter / lead-magnet signups */}
      <div className="bg-paper border border-rule rounded-xl p-6 shadow-sm">
        <div className="flex justify-between items-center border-b border-rule pb-4 mb-4">
          <div>
            <h3 className="font-serif text-lg font-medium text-ink">Lead Capture & Newsletter Roster</h3>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Email signups from lead magnets</p>
          </div>
          <span className="font-mono text-[9px] px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 uppercase tracking-wider rounded-md font-semibold">
            {leads.length} Leads
          </span>
        </div>

        {leads.length === 0 ? (
          <div className="text-center py-10 border border-dashed border-rule rounded-lg">
            <p className="font-mono text-xs text-muted uppercase tracking-widest">No leads captured yet.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              <thead>
                <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                  <th className="py-2.5 px-4 font-semibold">Email</th>
                  <th className="py-2.5 px-4 font-semibold">Requested Resource</th>
                  <th className="py-2.5 px-4 font-semibold text-center w-24">Consent</th>
                  <th className="py-2.5 px-4 font-semibold text-right w-36">Captured</th>
                </tr>
              </thead>
              <tbody>
                {leads.map((lead) => {
                  const dateDisplay = new Date(lead.created_at).toLocaleString("en-GB", {
                    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
                  });
                  return (
                    <tr key={lead.id} className="border-b border-rule/50 hover:bg-bg-2/20 transition-colors">
                      <td className="py-3 px-4 font-mono text-[11px] text-ink break-all">{lead.email}</td>
                      <td className="py-3 px-4 font-sans text-xs text-ink-2">{lead.resource}</td>
                      <td className="py-3 px-4 text-center">
                        <span className={`inline-flex items-center rounded px-2 py-0.5 font-mono text-[9.5px] font-bold border uppercase ${
                          lead.consent
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-slate-50 text-slate-500 border-slate-200"
                        }`}>
                          {lead.consent ? "Yes" : "No"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-[10px] text-muted-2">
                        {dateDisplay}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
