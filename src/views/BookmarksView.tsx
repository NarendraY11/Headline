import { Bookmark, BookmarkMinus, Filter, Play, X } from "lucide-react";
import { useMemo, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Card, Chip } from "../components/Atoms";
import { useAuth } from "../contexts/AuthContext";
import { Question } from "../data/questions";
import { fetchQuestionsByIds } from "../lib/content";

export default function BookmarksView() {
  const { userData, updateUserData, loading } = useAuth();
  const navigate = useNavigate();
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<Set<string>>(new Set());
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  useEffect(() => {
    async function resolveBookmarks() {
      try {
        let rawBookmarks: any[] = [];
        if (userData && userData.bookmarks) {
          rawBookmarks = userData.bookmarks;
        } else {
          try {
            const saved = localStorage.getItem("heading_bookmarks");
            if (saved) {
              rawBookmarks = JSON.parse(saved);
            }
          } catch {}
        }

        const stringIds = rawBookmarks.filter(b => typeof b === 'string');
        const fullObjects = rawBookmarks.filter(b => typeof b !== 'string');

        let resolvedQuestions: Question[] = [...fullObjects];
        if (stringIds.length > 0) {
          const fetched = await fetchQuestionsByIds(stringIds);
          resolvedQuestions = [...resolvedQuestions, ...fetched];
        }

        setBookmarkedQuestions(resolvedQuestions);
      } catch (err) {
        console.error("Failed resolving bookmarks:", err);
      } finally {
        setLoadingQuestions(false);
      }
    }

    resolveBookmarks();
  }, [userData?.bookmarks]);

  const removeBookmark = (qId: string) => {
    const updatedQuestions = bookmarkedQuestions.filter(q => q.id !== qId);
    setBookmarkedQuestions(updatedQuestions);
    
    // Convert back to string IDs for storage
    const updatedIds = updatedQuestions.map(q => q.id);
    localStorage.setItem("heading_bookmarks", JSON.stringify(updatedIds));
    if (userData) {
      updateUserData({ bookmarks: updatedIds });
    }
  };

  // Unique subjects present in bookmarked questions for the filter panel
  const availableSubjects = useMemo(() => {
    const seen = new Map<string, string>();
    bookmarkedQuestions.forEach((q) => {
      const id = q.subjectId || q.topicId || "";
      const label = q.ata?.split("·")[0]?.trim() || id;
      if (id && !seen.has(id)) seen.set(id, label);
    });
    return Array.from(seen.entries()).map(([id, label]) => ({ id, label }));
  }, [bookmarkedQuestions]);

  const filteredForPractice = useMemo(() => {
    if (selectedSubjectFilter.size === 0) return bookmarkedQuestions;
    return bookmarkedQuestions.filter(
      (q) =>
        selectedSubjectFilter.has(q.subjectId || "") ||
        selectedSubjectFilter.has(q.topicId || "")
    );
  }, [bookmarkedQuestions, selectedSubjectFilter]);

  const startPractice = () => {
    navigate('/quiz/bookmarks-review', {
      state: {
        customQuestions: filteredForPractice,
        generatedTopic: selectedSubjectFilter.size > 0
          ? `Bookmarks — ${selectedSubjectFilter.size} subject${selectedSubjectFilter.size > 1 ? "s" : ""}`
          : "Bookmarked Interrogatories"
      }
    });
  };

  const toggleSubjectFilter = (id: string) => {
    setSelectedSubjectFilter((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Loading state
  if (loading || loadingQuestions) {
    return (
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="relative z-10 w-full max-w-sm text-center space-y-4 flex flex-col items-center">
          <div className="w-12 h-12 rounded-full border-t-2 border-navy animate-spin" />
          <p className="font-mono text-xs uppercase tracking-widest text-muted-2">Retrieving flight profile...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (bookmarkedQuestions.length === 0) {
    return (
      <div className="relative min-h-[70vh] flex flex-col items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
        <div className="relative z-10 w-full max-w-md text-center space-y-6 flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-rule flex items-center justify-center text-muted mb-4 opacity-50">
            <Bookmark size={32} />
          </div>
          <h1 className="font-serif text-4xl text-ink leading-tight">No references pinned.</h1>
          <p className="font-sans text-ink-2 font-light leading-relaxed max-w-sm">
            You haven't bookmarked any interrogatories yet. Pin tricky questions during practice to review them here.
          </p>
          <div className="pt-6">
            <Link to="/modules">
              <Button variant="primary" className="h-[44px] shadow-sm">
                Return to Modules
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto py-12 md:py-24 px-4 w-full">
      <div className="mb-10 border-b border-rule pb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <span className="eyebrow block mb-4">SAVED CHRONICLES</span>
          <h1 className="font-serif text-[50px] leading-none text-ink tracking-tight mb-4">
            Bookmarked References
          </h1>
          <p className="font-sans text-lg text-ink-2 font-light max-w-2xl">
            Review tricky questions from your practice runs or prepare for oral exams with your dedicated flashcard set.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {availableSubjects.length > 1 && (
            <Button
              variant="ghost"
              onClick={() => setShowFilterPanel(!showFilterPanel)}
              className={selectedSubjectFilter.size > 0 ? "border-ink text-ink" : ""}
            >
              <Filter size={14} />
              {selectedSubjectFilter.size > 0 ? `${selectedSubjectFilter.size} filter${selectedSubjectFilter.size > 1 ? "s" : ""}` : "Filter papers"}
            </Button>
          )}
          <Button variant="primary" onClick={startPractice}>
            <Play size={16} fill="currentColor" />
            {filteredForPractice.length < bookmarkedQuestions.length
              ? `Practice ${filteredForPractice.length} selected`
              : "Practice Bookmarked"}
          </Button>
        </div>
      </div>

      {/* Subject filter panel */}
      {showFilterPanel && availableSubjects.length > 1 && (
        <div className="mb-8 p-5 bg-bg-2 border border-rule-strong rounded-xl">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-sans text-sm font-semibold text-ink">Filter by subject paper</h3>
            <div className="flex items-center gap-2">
              {selectedSubjectFilter.size > 0 && (
                <button
                  onClick={() => setSelectedSubjectFilter(new Set())}
                  className="font-mono text-[10px] text-muted-2 hover:text-ink transition-colors"
                >
                  Clear all
                </button>
              )}
              <button
                onClick={() => setShowFilterPanel(false)}
                className="p-1 text-muted-2 hover:text-ink transition-colors rounded"
              >
                <X size={14} />
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableSubjects.map(({ id, label }) => {
              const active = selectedSubjectFilter.has(id);
              return (
                <button
                  key={id}
                  onClick={() => toggleSubjectFilter(id)}
                  className={`px-3 py-1.5 rounded-full border text-[12px] font-sans font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky/60 ${
                    active
                      ? "bg-ink text-paper border-ink"
                      : "bg-paper border-rule-strong text-muted hover:border-ink hover:text-ink"
                  }`}
                >
                  {label}
                  {active && <X size={10} className="inline ml-1.5 -mt-0.5" />}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="space-y-6">
        {bookmarkedQuestions.map((q) => (
          <Card key={q.id} className="bg-panel border-rule flex flex-col md:flex-row md:items-start gap-6 relative group">
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <Chip variant="solid" className="text-[9px]">{q.ata.split('·')[0].trim()}</Chip>
                <span className="font-mono text-[9px] uppercase tracking-widest text-muted">{q.difficulty || "standard"}</span>
              </div>
              <p className="font-serif text-xl sm:text-2xl text-ink leading-snug mb-4">{q.prompt}</p>
              <div className="bg-paper p-4 rounded-lg border border-rule-strong opacity-80 mt-4 font-sans text-sm text-ink-2">
                 <span className="font-medium text-ink mr-2">Correct Answer:</span>
                 {q.choices.find(c => c.id === q.correct)?.label}
              </div>
            </div>
            
            <button
              onClick={() => removeBookmark(q.id)}
              aria-label="Remove bookmark"
              className="absolute top-4 right-4 p-2 text-muted hover:text-signal hover:bg-signal-soft rounded-full transition-colors md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-sky/60 focus-visible:outline-none"
              title="Remove bookmark"
            >
              <BookmarkMinus size={20} />
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

