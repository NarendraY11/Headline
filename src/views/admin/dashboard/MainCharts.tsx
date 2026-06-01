import React from "react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  AreaChart, 
  Area, 
  LineChart, 
  Line, 
} from "recharts";

interface Props {
  signupsOverTime: any[];
  conversionsOverTime: any[];
  activeUsersOverTime: any[];
}

export function MainCharts({ signupsOverTime, conversionsOverTime, activeUsersOverTime }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      
      {/* Signups over time */}
      <div className="bg-white border border-rule rounded-xl p-6 flex flex-col h-[320px] shadow-sm">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-medium text-ink">New Signups Timeline</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Cohort growth trajectory over selected range</p>
        </div>
        <div className="flex-1 w-full min-h-0" role="img" aria-label="Line chart showing new user registrations timeline">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={signupsOverTime} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} />
              <YAxis stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
              />
              <Line type="monotone" dataKey="Signups" stroke="#0F1E3C" strokeWidth={1.8} dot={{ r: 2 }} activeDot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Paid conversions */}
      <div className="bg-white border border-rule rounded-xl p-6 flex flex-col h-[320px] shadow-sm">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-medium text-teal-850">Paid License Acquisitions</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Success of upgrade_pro upgrade cycles</p>
        </div>
        <div className="flex-1 w-full min-h-0" role="img" aria-label="Area chart showing paid license acquisitions timeline">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={conversionsOverTime} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <defs>
                <linearGradient id="colorUpgrades" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#557B96" stopOpacity={0.25}/>
                  <stop offset="95%" stopColor="#557B96" stopOpacity={0.01}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} />
              <YAxis stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
              />
              <Area type="monotone" dataKey="Upgrades" stroke="#557B96" strokeWidth={1.5} fillOpacity={1} fill="url(#colorUpgrades)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily active users */}
      <div className="bg-white border border-rule rounded-xl p-6 flex flex-col h-[320px] shadow-sm">
        <div className="mb-4">
          <h3 className="font-serif text-lg font-medium text-ink">Active User Frequency</h3>
          <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Daily distinct active pilots (DAU timeline)</p>
        </div>
        <div className="flex-1 w-full min-h-0" role="img" aria-label="Bar chart showing daily active user frequency over time">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={activeUsersOverTime} margin={{ top: 5, right: 10, left: -25, bottom: 5 }}>
              <XAxis dataKey="day" stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} />
              <YAxis stroke="var(--muted)" fontSize={9} strokeWidth={1} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ background: "#222", border: "0", borderRadius: "8px", color: "#fbfaf6", fontFamily: "monospace", fontSize: "10px" }}
                cursor={{ fill: "rgba(15,30,60,0.02)" }}
              />
              <Bar dataKey="Actives" fill="#0F1E3C" radius={[3, 3, 0, 0]} barSize={16} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}
