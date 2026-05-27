import React, { useState, useEffect } from "react";
import { supabase } from "../../lib/supabase";
import { Card } from "../../components/Atoms";
import { 
  Users, 
  GraduationCap, 
  Calendar, 
  Mail, 
  Award, 
  RefreshCw, 
  AlertCircle, 
  Search, 
  Bookmark, 
  Clock, 
  CheckCircle, 
  X, 
  ChevronRight, 
  BookOpen, 
  Activity, 
  ChevronLeft 
} from "lucide-react";

interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  target_exam: string;
  next_exam: string | null;
  plan: "free" | "trial" | "pro" | "lifetime";
  plan_started_at: string;
  plan_expires_at?: string | null;
  trial_started_at?: string | null;
  trial_used?: boolean;
  created_at: string;
}

interface EnrichedUser extends Profile {
  totalQuestionsAnswered: number;
  avgScore: number;
  sessionsCount: number;
  bookmarksCount: number;
  lastActive: string;
  attemptsHistory: any[];
  subjectsPracticed: string[];
}

export default function UsersAnalytics() {
  const [loading, setLoading] = useState(true);
  const [errorStatus, setErrorStatus] = useState("");
  const [rawUsers, setRawUsers] = useState<EnrichedUser[]>([]);
  
  // Filtering & Sorting State
  const [searchInput, setSearchInput] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [planFilter, setPlanFilter] = useState<"all" | "free" | "trial" | "pro" | "lifetime">("all");
  const [sortField, setSortField] = useState<"lastActive" | "created_at" | "created_at_asc" | "totalQuestionsAnswered" | "avgScore">("lastActive");

  // Admin Plan Edit State
  const [editingPlan, setEditingPlan] = useState<"free" | "trial" | "pro" | "lifetime" | "">("");
  const [expiresAt, setExpiresAt] = useState<string>("");
  const [isSavingPlan, setIsSavingPlan] = useState(false);
  const [planSuccessMsg, setPlanSuccessMsg] = useState("");
  const [planErrorMsg, setPlanErrorMsg] = useState("");
  
  // Debounce search input to avoid heavy/unnecessary re-renders on every keystroke
  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      setSearchTerm(searchInput);
      setCurrentPage(1);
    }, 250);

    return () => clearTimeout(delayDebounceFn);
  }, [searchInput]);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  // Selected User for Detail Drawer
  const [selectedUser, setSelectedUser] = useState<EnrichedUser | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      // 1. Fetch profiles
      const { data: profiles, error: pError } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });

      if (pError) throw pError;

      // 2. Fetch all attempts and logs to aggregate student stats
      const { data: attempts, error: aError } = await supabase
        .from("attempts")
        .select("*")
        .order("created_at", { ascending: false });

      if (aError) {
        console.warn("Could not retrieve full attempts data, falling back:", aError);
      }

      // 3. Fetch bookmarks count
      const { data: bookmarks, error: bError } = await supabase
        .from("bookmarks")
        .select("user_id, question_id");

      if (bError) {
        console.warn("Could not retrieve bookmarks counts:", bError);
      }

      // 4. Fetch telemetry to establish last_active
      const { data: events, error: eError } = await supabase
        .from("events")
        .select("user_id, created_at, subject_id")
        .order("created_at", { ascending: false });

      if (eError) {
        console.warn("Could not retrieve events telemetry data:", eError);
      }

      const activeAttempts = attempts || [];
      const activeBookmarks = bookmarks || [];
      const activeEvents = events || [];

      // Combine profiles, attempts, bookmarks, and events into enriched metrics records
      const enriched: EnrichedUser[] = (profiles || []).map((prof) => {
        // filter user attempts
        const userAttempts = activeAttempts.filter((a) => a.user_id === prof.id);
        const userBookmarksCount = activeBookmarks.filter((b) => b.user_id === prof.id).length;
        const userEvents = activeEvents.filter((e) => e.user_id === prof.id);

        // calculate questions answered
        const totalAnswers = userAttempts.reduce((sum, a) => sum + (a.total || 0), 0);

        // calculate avg accuracy score
        const scoreSum = userAttempts.reduce((sum, a) => sum + (a.percentage || 0), 0);
        const avg = userAttempts.length > 0 ? Math.round(scoreSum / userAttempts.length) : 0;

        // compute last active timestamp
        let lastActiveTime = prof.created_at;
        if (userEvents.length > 0) {
          const latestEventTime = userEvents[0].created_at;
          if (new Date(latestEventTime) > new Date(lastActiveTime)) {
             lastActiveTime = latestEventTime;
          }
        }
        if (userAttempts.length > 0) {
          const latestAttemptTime = userAttempts[0].created_at;
          if (new Date(latestAttemptTime) > new Date(lastActiveTime)) {
             lastActiveTime = latestAttemptTime;
          }
        }

        // resolve list of subjects practiced
        const subjectsSet = new Set<string>();
        userEvents.forEach(e => { if (e.subject_id) subjectsSet.add(e.subject_id); });
        userAttempts.forEach(a => { if (a.topic_id) {
          // split standard auto-slug format if applicable
          const subjectPart = a.topic_id.split("-")[0];
          if (subjectPart && subjectPart.length < 15) {
            subjectsSet.add(subjectPart.toUpperCase());
          }
        }});

        return {
          ...prof,
          totalQuestionsAnswered: totalAnswers,
          avgScore: avg,
          sessionsCount: userAttempts.length,
          bookmarksCount: userBookmarksCount,
          lastActive: lastActiveTime,
          attemptsHistory: userAttempts,
          subjectsPracticed: Array.from(subjectsSet),
        };
      });

      setRawUsers(enriched);

      // Keep selected user updated if drawer is open during reload
      if (selectedUser) {
        const updatedSelected = enriched.find((u) => u.id === selectedUser.id);
        if (updatedSelected) {
          setSelectedUser(updatedSelected);
        }
      }

    } catch (err: any) {
      console.error("Profiles retrieval failed:", err);
      setErrorStatus(err.message || "Failed to load user roster analysis.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Synchronize edit form state when selectedUser changes
  useEffect(() => {
    if (selectedUser) {
      setEditingPlan(selectedUser.plan || "free");
      setExpiresAt(selectedUser.plan_expires_at ? selectedUser.plan_expires_at.split("T")[0] : "");
      setPlanSuccessMsg("");
      setPlanErrorMsg("");
    } else {
      setEditingPlan("");
      setExpiresAt("");
    }
  }, [selectedUser]);

  const handleSavePlan = async () => {
    if (!selectedUser || !editingPlan) return;
    setIsSavingPlan(true);
    setPlanSuccessMsg("");
    setPlanErrorMsg("");

    try {
      const expirationTimestamp = expiresAt ? new Date(expiresAt).toISOString() : null;
      
      const updateData: any = {
        plan: editingPlan,
        plan_expires_at: expirationTimestamp,
        updated_at: new Date().toISOString()
      };

      // If switching to trial, set standard trial metrics helper columns
      if (editingPlan === "trial") {
        updateData.trial_started_at = new Date().toISOString();
        updateData.trial_used = true;
        // Trial set to now + 7 days if expired date not customized
        if (!expirationTimestamp) {
          const sevenDaysFromNow = new Date();
          sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
          updateData.plan_expires_at = sevenDaysFromNow.toISOString();
        }
      } else if (editingPlan === "free") {
        updateData.plan_expires_at = null;
      } else if (editingPlan === "lifetime") {
        updateData.plan_expires_at = null;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", selectedUser.id);

      if (error) throw error;

      // Log in audited plan_changes table gracefully
      try {
        const adminUser = (await supabase.auth.getUser()).data.user;
        await supabase.from("plan_changes").insert({
          user_id: selectedUser.id,
          from_plan: selectedUser.plan,
          to_plan: editingPlan,
          changed_by: adminUser?.id || null
        });
      } catch (auditError) {
        console.warn("Audit table logbook update error (optional):", auditError);
      }

      setPlanSuccessMsg(`Plan successfully updated to ${editingPlan}!`);
      
      // Refresh list to update state across indicators immediately
      await fetchData();
    } catch (err: any) {
      console.error("Failed manual plan override:", err);
      setPlanErrorMsg(err.message || "Failed to persist database plan updates.");
    } finally {
      setIsSavingPlan(false);
    }
  };

  // Filter and sort computation
  const filteredUsers = rawUsers
    .filter((user) => {
      // search filter
      const searchStr = user.email?.toLowerCase() || "";
      const nameStr = user.display_name?.toLowerCase() || "";
      const matchesSearch = searchStr.includes(searchTerm.toLowerCase()) || nameStr.includes(searchTerm.toLowerCase());

      // plan filter
      const matchesPlan = planFilter === "all" ? true : user.plan === planFilter;

      return matchesSearch && matchesPlan;
    })
    .sort((a, b) => {
      // sort options
      if (sortField === "lastActive") {
        return new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime();
      }
      if (sortField === "created_at") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortField === "created_at_asc") {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }
      if (sortField === "totalQuestionsAnswered") {
        return b.totalQuestionsAnswered - a.totalQuestionsAnswered;
      }
      if (sortField === "avgScore") {
        return b.avgScore - a.avgScore;
      }
      return 0;
    });

  // Pagination bounds
  const totalItems = filteredUsers.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage) || 1;
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + itemsPerPage);

  // Stats
  const totalCount = rawUsers.length;
  const proCount = rawUsers.filter((u) => u.plan === "pro").length;
  const avgAccuracy = rawUsers.length > 0 
    ? Math.round(rawUsers.reduce((sum, u) => sum + u.avgScore, 0) / rawUsers.length)
    : 0;

  // Relative Time helper
  function getRelativeTime(dateStr: string) {
    if (!dateStr) return "Never";
    const d = new Date(dateStr);
    const diff = Date.now() - d.getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(mins / 60);
    const days = Math.floor(hours / 24);

    if (isNaN(d.getTime())) return "Unknown";
    if (diff < 60000) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days}d ago`;

    return d.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-2">
      
      {/* Roster Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-rule pb-6">
        <div>
          <div className="font-mono text-[9px] tracking-widest text-muted uppercase mb-1">Administrative deck</div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink leading-none">Student Cohorts Analytics</h1>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center justify-center gap-1.5 px-4 py-2 border border-rule hover:bg-bg-2 rounded-full font-sans text-xs text-ink transition-colors disabled:opacity-50 cursor-pointer h-10 shrink-0 select-none"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          <span>Sync Student Registry</span>
        </button>
      </div>

      {errorStatus && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 text-rose-800 rounded-lg text-xs flex items-center gap-3 animate-fadeIn">
          <AlertCircle size={16} className="shrink-0" />
          <span>{errorStatus}</span>
        </div>
      )}

      {loading ? (
        <div className="h-[300px] flex flex-col items-center justify-center bg-white border border-rule rounded-xl shadow-sm">
          <div className="w-8 h-8 border-4 border-ink border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="font-mono text-xs text-muted tracking-widest uppercase">Fetching enregistered student catalog...</p>
        </div>
      ) : (
        <>
          {/* Top Quick Analysis Indicators */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <Card className="p-5 flex items-center gap-4 bg-white border border-rule shadow-sm">
              <div className="p-3 bg-ink/5 rounded-full text-ink"><Users size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Total Active Roster</div>
                <div className="font-serif text-2xl font-bold text-ink">{totalCount}</div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 bg-white border border-rule shadow-sm">
              <div className="p-3 bg-teal-50 text-teal-800 rounded-full"><Award size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted font-bold">Pro Active licenses</div>
                <div className="font-serif text-2xl font-bold text-teal-850">{proCount}</div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 bg-white border border-rule shadow-sm">
              <div className="p-3 bg-amber-50 text-amber-800 rounded-full"><GraduationCap size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Free Standard tier</div>
                <div className="font-serif text-2xl font-bold text-amber-850">{totalCount - proCount}</div>
              </div>
            </Card>

            <Card className="p-5 flex items-center gap-4 bg-white border border-rule shadow-sm">
              <div className="p-3 bg-emerald-50 text-emerald-800 rounded-full"><CheckCircle size={18} /></div>
              <div>
                <div className="font-mono text-[9px] uppercase tracking-wider text-muted">Cohort Avg Accuracy</div>
                <div className="font-serif text-2xl font-bold text-emerald-800">{avgAccuracy}%</div>
              </div>
            </Card>
          </div>

          {/* Filtering Bar Panel */}
          <div className="bg-white border border-rule rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Search */}
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3.5 top-[50%] -translate-y-[50%] text-muted" size={14} />
                <input
                  type="text"
                  placeholder="Search emails or names..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                  }}
                  className="w-full bg-panel border border-rule rounded-md text-xs px-10 py-2.5 outline-none focus-visible:ring-2 focus-visible:ring-sky/60"
                />
              </div>

              {/* Filters dropdowns */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted uppercase">Plan Badge:</span>
                  <select
                    value={planFilter}
                    onChange={(e) => {
                      setPlanFilter(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-rule text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-sky/50"
                  >
                    <option value="all">All Plan Tiers</option>
                    <option value="free">Free Tier</option>
                    <option value="trial">Trial Tier</option>
                    <option value="pro">Pro Tier</option>
                    <option value="lifetime">Lifetime Tier</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-muted uppercase font-semibold">Tuning Order:</span>
                  <select
                    value={sortField}
                    onChange={(e) => {
                      setSortField(e.target.value as any);
                      setCurrentPage(1);
                    }}
                    className="bg-white border border-rule text-xs px-3 py-1.5 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-sky/50"
                  >
                    <option value="lastActive">Last Active (Newest First)</option>
                    <option value="created_at">Signup Date (Newest First)</option>
                    <option value="created_at_asc">Signup Date (Oldest First)</option>
                    <option value="totalQuestionsAnswered">Lessons Evaluated (Most)</option>
                    <option value="avgScore">Accuracy Grade (Highest)</option>
                  </select>
                </div>
              </div>

            </div>
          </div>

          {/* Roster Database Table */}
          <div className="bg-white border border-rule rounded-xl overflow-hidden shadow-sm">
            <div className="p-5 border-b border-rule bg-bg-2/20 flex justify-between items-center flex-wrap gap-2">
              <h3 className="font-serif text-lg font-medium text-ink">Active Cohorts Registry ({filteredUsers.length})</h3>
              <span className="font-mono text-[9px] text-muted uppercase tracking-wider">Double-click or click any row to inspect logbook diagnostics</span>
            </div>

            {paginatedUsers.length === 0 ? (
              <div className="text-center py-20 bg-white">
                <Users className="mx-auto text-muted mb-3" size={32} />
                <h3 className="font-serif text-lg font-medium text-ink mb-1">No Student Match Logged</h3>
                <p className="text-xs text-muted">Try re-calibrating search criteria.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse font-sans text-xs">
                  <thead>
                    <tr className="border-b border-rule font-mono uppercase tracking-wide text-muted text-[10px] bg-bg-2/30">
                      <th className="py-3.5 px-4 font-semibold">Student Account Map</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-28">Service Plan</th>
                      <th className="py-3.5 px-3 font-semibold text-right w-36">Enregistered On</th>
                      <th className="py-3.5 px-3 font-semibold text-right w-36">Last Active Event</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-32">Questions Correct</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-28">Accuracy</th>
                      <th className="py-3.5 px-3 font-semibold text-center w-20">Sessions</th>
                      <th className="py-3.5 px-3 font-semibold w-12"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedUsers.map((profile) => {
                      const signupDate = new Date(profile.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric"
                      });
                      const displayName = profile.display_name || "Aviation student";
                      const passPercent = profile.avgScore >= 70;

                      return (
                        <tr 
                          key={profile.id} 
                          onClick={() => setSelectedUser(profile)}
                          className={`border-b border-rule/50 hover:bg-bg-2/40 transition-colors cursor-pointer select-none ${selectedUser?.id === profile.id ? "bg-bg-2/50" : ""}`}
                        >
                          {/* Student Identity Map */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-ink/5 border border-rule/65 text-ink flex items-center justify-center font-serif text-xs font-bold uppercase shrink-0">
                                {displayName.charAt(0)}
                              </div>
                              <div>
                                <div className="font-sans font-semibold text-ink line-clamp-1">{displayName}</div>
                                <div className="font-mono text-[9px] text-muted-2 flex items-center gap-1 mt-0.5 whitespace-nowrap">
                                  <Mail size={8} /> {profile.email || "anonymous pilot"}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Service Plan */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block font-mono text-[9px] px-2.5 py-0.5 rounded-full border font-bold ${
                              profile.plan === "pro"
                                ? "bg-teal-50 text-teal-700 border-teal-100"
                                : profile.plan === "lifetime"
                                  ? "bg-indigo-50 text-indigo-700 border-indigo-100"
                                  : profile.plan === "trial"
                                    ? "bg-amber-50 text-amber-700 border-amber-200"
                                    : "bg-bg-1 text-muted border-rule/50 font-semibold"
                            }`}>
                              {profile.plan.toUpperCase()}
                            </span>
                          </td>

                          {/* Registered On */}
                          <td className="py-3 px-3 text-right font-mono text-[10px] text-muted-2">
                            <div className="flex items-center justify-end gap-1.5">
                              <Calendar size={11} className="text-muted shrink-0" />
                              <span>{signupDate}</span>
                            </div>
                          </td>

                          {/* Last Active Event */}
                          <td className="py-3 px-3 text-right font-mono text-[10px] text-muted-2">
                            <div className="flex items-center justify-end gap-1.5" title={profile.lastActive}>
                              <Clock size={11} className="text-muted shrink-0" />
                              <span>{getRelativeTime(profile.lastActive)}</span>
                            </div>
                          </td>

                          {/* Questions Answered */}
                          <td className="py-3 px-3 text-center font-mono font-medium text-ink text-[11px]">
                            {profile.totalQuestionsAnswered.toLocaleString()}
                          </td>

                          {/* Score Accuracy */}
                          <td className="py-3 px-3 text-center">
                            <span className={`inline-block font-mono text-[10px] px-1.5 py-0.5 rounded font-bold ${
                              passPercent ? "text-emerald-700 bg-emerald-50" : "text-rose-700 bg-rose-50"
                            }`}>
                              {profile.avgScore}%
                            </span>
                          </td>

                          {/* Total Sessions Count */}
                          <td className="py-3 px-3 text-center font-mono">
                            <span className="px-1.5 py-0.5 bg-bg-2 border border-rule/80 text-ink rounded text-[10px] font-medium">
                              {profile.sessionsCount}
                            </span>
                          </td>

                          {/* Action Navigation */}
                          <td className="py-3 px-3 text-center text-muted">
                            <ChevronRight size={14} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination controls */}
            {totalPages > 1 && (
              <div className="p-4 border-t border-rule bg-bg-2/10 flex justify-between items-center text-xs font-mono text-muted">
                <span>Showing {startIndex + 1} - {Math.min(startIndex + itemsPerPage, totalItems)} of {totalItems} accounts</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className="p-1 px-3 border border-rule hover:bg-bg-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <ChevronLeft size={12} />
                    <span>Previous</span>
                  </button>
                  <span className="py-1 px-2.5 font-bold text-ink">{currentPage} / {totalPages}</span>
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className="p-1 px-3 border border-rule hover:bg-bg-1 rounded-md transition-colors disabled:opacity-40 cursor-pointer flex items-center gap-1"
                  >
                    <span>Next</span>
                    <ChevronRight size={12} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Slide-out detail Drawer */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/30 backdrop-blur-xs animate-fadeIn" onClick={() => setSelectedUser(null)}>
          <div 
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white border-l border-rule h-screen flex flex-col shadow-2xl relative animate-slideLeft overflow-hidden"
          >
            {/* Header identity display */}
            <div className="p-6 border-b border-rule bg-bg-2/30 flex justify-between items-start">
              <div className="flex gap-4">
                <div className="w-12 h-12 rounded-full bg-ink text-white font-serif font-semibold text-lg flex items-center justify-center shrink-0 uppercase shadow-inner">
                  {selectedUser.display_name?.charAt(0) || "A"}
                </div>
                <div>
                  <h2 className="font-serif text-xl font-medium tracking-tight text-ink leading-tight">{selectedUser.display_name || "Aviation Student"}</h2>
                  <div className="font-mono text-[10px] text-muted-2 flex items-center gap-1 mt-0.5">
                    <Mail size={10} /> {selectedUser.email || "anonymous"}
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setSelectedUser(null)} 
                className="p-1.5 hover:bg-bg-2 border border-transparent hover:border-rule rounded-full text-muted hover:text-ink transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable specs layout */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              
               {/* Profile variables bento */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg flex flex-col justify-between">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide">License Plan</span>
                  <span className={`inline-block font-mono text-[10px] font-bold px-3 py-0.5 rounded-full border self-start mt-2 ${
                    selectedUser.plan === "pro"
                      ? "bg-teal-50 border-teal-100 text-teal-800"
                      : selectedUser.plan === "lifetime"
                        ? "bg-indigo-50 border-indigo-100 text-indigo-800"
                        : selectedUser.plan === "trial"
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-bg-1 border-rule text-muted-2"
                  }`}>
                    {selectedUser.plan.toUpperCase()}
                  </span>
                  {selectedUser.plan_started_at && (
                    <span className="font-mono text-[8.5px] text-muted mt-1">Upgrade: {new Date(selectedUser.plan_started_at).toLocaleDateString()}</span>
                  )}
                  {selectedUser.plan_expires_at && (
                    <span className="font-mono text-[8.5px] text-rose-600 font-bold mt-1">Expires: {new Date(selectedUser.plan_expires_at).toLocaleDateString()}</span>
                  )}
                </div>

                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg flex flex-col justify-between">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide">Target Syllabus Exam</span>
                  <span className="font-sans font-bold text-ink text-[12px] mt-2 flex items-center gap-1">
                    <GraduationCap size={13} className="text-muted shrink-0" />
                    <span>{selectedUser.target_exam || "General study"}</span>
                  </span>
                  {selectedUser.next_exam && (
                    <span className="font-mono text-[8.5px] text-muted mt-1">Goal date: {selectedUser.next_exam}</span>
                  )}
                </div>

                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg flex flex-col justify-between">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide">Bookmarks pinned</span>
                  <span className="font-sans font-bold text-ink text-sm mt-2 flex items-center gap-1.5">
                    <Bookmark size={13} className="text-muted shrink-0" />
                    <span>{selectedUser.bookmarksCount} Question mappings</span>
                  </span>
                </div>

                <div className="p-3 bg-bg-2/40 border border-rule/75 rounded-lg flex flex-col justify-between">
                  <span className="font-mono text-[8.5px] uppercase text-muted tracking-wide">Aggregate progress</span>
                  <span className="font-sans font-bold text-ink text-sm mt-2 flex items-center gap-1.5">
                    <Activity size={13} className="text-[#E5A93C] shrink-0" />
                    <span>{selectedUser.totalQuestionsAnswered} answered</span>
                  </span>
                </div>
              </div>

              {/* ADMIN COCKPIT LICENSE CONTROL PANEL */}
              <div className="bg-panel/75 border border-rule rounded-lg p-4 space-y-4">
                <div className="flex items-center gap-1.5 border-b border-rule pb-2">
                  <Activity size={14} className="text-navy" />
                  <h3 className="font-serif text-xs font-bold uppercase tracking-wider text-ink">Manage Cockpit Clearance (Admin)</h3>
                </div>
                
                {planSuccessMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded text-xs leading-normal">
                    {planSuccessMsg}
                  </div>
                )}
                {planErrorMsg && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-850 rounded text-xs leading-normal">
                    {planErrorMsg}
                  </div>
                )}

                <div className="space-y-3 font-sans">
                  <div>
                    <label className="block font-mono text-[9px] uppercase tracking-wider text-muted mb-1.5 font-bold">Select Active Plan Tier</label>
                    <select
                      value={editingPlan}
                      onChange={(e) => setEditingPlan(e.target.value as any)}
                      className="w-full bg-white border border-rule text-xs p-2 rounded-lg outline-none cursor-pointer focus:ring-1 focus:ring-sky/50"
                    >
                      <option value="free">Free Tier</option>
                      <option value="trial">Trial Tier (7 Days)</option>
                      <option value="pro">Pro Tier (Captain)</option>
                      <option value="lifetime">Lifetime Access (Admin Override)</option>
                    </select>
                  </div>

                  {(editingPlan === "pro" || editingPlan === "trial") && (
                    <div>
                      <label className="block font-mono text-[9px] uppercase tracking-wider text-muted mb-1.5 font-bold">
                        Set Plan Expiration Date {editingPlan === "trial" && "(Default is Now + 7 Days)"}
                      </label>
                      <input
                        type="date"
                        value={expiresAt}
                        onChange={(e) => setExpiresAt(e.target.value)}
                        className="w-full bg-white border border-rule text-xs p-2 rounded-lg outline-none focus:ring-1 focus:ring-sky/50"
                      />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={handleSavePlan}
                    disabled={isSavingPlan || !editingPlan}
                    className="w-full py-2 bg-navy text-bg hover:bg-navy-dark font-mono text-[10px] uppercase font-bold rounded-lg tracking-wide transition-colors cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                  >
                    {isSavingPlan ? "Persisting changes..." : "Commit Plan Override"}
                  </button>
                </div>
              </div>

              {/* Practiced Subjects lists */}
              <div className="space-y-2">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <BookOpen size={13} className="text-muted" />
                  <span>Syllabus Modules Explored</span>
                </h3>
                {selectedUser.subjectsPracticed.length === 0 ? (
                  <p className="font-mono text-[9px] uppercase tracking-wide text-muted py-2">No navigation telemetry records logged.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUser.subjectsPracticed.map((sub, idx) => (
                      <span key={idx} className="font-mono text-[9px] border border-rule bg-bg-2 text-ink rounded-lg px-2.5 py-0.5 tracking-wide">
                        {sub}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Simulation histories list */}
              <div className="space-y-3">
                <h3 className="font-serif text-sm font-medium text-ink flex items-center gap-1.5">
                  <Clock size={13} className="text-muted" />
                  <span>Logbook Examination Attempts ({selectedUser.attemptsHistory.length})</span>
                </h3>
                
                {selectedUser.attemptsHistory.length === 0 ? (
                  <div className="text-center py-8 border border-dashed border-rule rounded-lg">
                    <p className="font-mono text-[9px] uppercase tracking-wider text-muted">No full quiz simulations logged.</p>
                  </div>
                ) : (
                  <div className="space-y-2 bg-none">
                    {selectedUser.attemptsHistory.map((attempt) => {
                      const dateText = new Date(attempt.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit"
                      });
                      const passValue = attempt.percentage >= 70;
                      return (
                        <div key={attempt.id} className="p-3 bg-bg-2/30 hover:bg-bg-2/65 border border-rule/55 rounded-lg flex justify-between items-center transition-colors">
                          <div>
                            <span className="font-semibold text-xs text-ink block capitalize">{attempt.mode || "Practice"} evaluation</span>
                            <span className="font-mono text-[9px] text-muted-2 block mt-0.5">{dateText}</span>
                          </div>
                          
                          <div className="text-right flex items-center gap-3">
                            <div className="font-mono text-[11px] text-ink">
                              Score: <span className="font-bold">{attempt.score}</span> / {attempt.total}
                            </div>
                            <span className={`inline-block font-mono text-[9px] font-bold rounded px-1.5 py-0.5 ${
                              passValue ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                            }`}>
                              {attempt.percentage}% · {passValue ? "PASS" : "FAIL"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>

            {/* Bottom actions */}
            <div className="p-4 border-t border-rule bg-bg-2/20 flex gap-2 justify-end">
              <button 
                onClick={() => setSelectedUser(null)}
                className="px-4 py-2 bg-ink text-white font-mono text-[10px] uppercase font-bold rounded-lg hover:bg-ink-2 tracking-wide transition-colors cursor-pointer"
              >
                Close Logs
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
