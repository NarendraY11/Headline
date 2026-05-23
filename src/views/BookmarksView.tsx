import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Chip, Button, Card } from "../components/Atoms";
import { Question } from "../data/questions";
import { fetchPublishedQuestions } from "../lib/content";
import { Bookmark, BookmarkMinus, Play } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";

export default function BookmarksView() {
  const { userData, updateUserData, loading } = useAuth();
  const navigate = useNavigate();
  const [bookmarkedQuestions, setBookmarkedQuestions] = useState<Question[]>([]);
  const [loadingQuestions, setLoadingQuestions] = useState(true);

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

        const pubQuestions = await fetchPublishedQuestions();

        // Resolve string IDs to full objects, migrate existing full objects
        const resolvedQuestions = rawBookmarks
          .map(b => typeof b === 'string' ? pubQuestions.find(q => q.id === b) : b)
          .filter((q): q is Question => Boolean(q));

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

  const startPractice = () => {
    navigate('/quiz/bookmarks-review', {
      state: {
        customQuestions: bookmarkedQuestions,
        generatedTopic: "Bookmarked Interrogatories"
      }
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
      <div className="mb-16 border-b border-rule pb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <span className="eyebrow block mb-4">SAVED CHRONICLES</span>
          <h1 className="font-serif text-[50px] leading-none text-ink tracking-tight mb-4">
            Bookmarked References
          </h1>
          <p className="font-sans text-lg text-ink-2 font-light max-w-2xl">
            Review tricky questions from your practice runs or prepare for oral exams with your dedicated flashcard set.
          </p>
        </div>
        <Button variant="primary" className="shrink-0" onClick={startPractice}>
          <Play size={16} fill="currentColor" /> Practice Bookmarked
        </Button>
      </div>

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
              className="absolute top-4 right-4 p-2 text-muted hover:text-signal hover:bg-signal-soft rounded-full transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
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

