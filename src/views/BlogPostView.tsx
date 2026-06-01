import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { blogPosts, BlogPost } from "../data/blog";
import { AdSlot } from "../components/AdSlot";
import { Card, Button } from "../components/Atoms";
import { supabase } from "../lib/supabase";
import { 
  Clock, 
  Calendar, 
  User, 
  ChevronLeft, 
  ArrowRight, 
  Sparkles, 
  Share2, 
  Bookmark,
  Check
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import ReadingProgress from "../components/ReadingProgress";

// In-post dynamic newsletter sub-card
function NewsletterSubCard() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "submitting" | "success" | "error">("idle");
  const [errMsg, setErrMsg] = useState("");

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes("@")) {
      setStatus("error");
      setErrMsg("Please enter valid flightline coordinates.");
      return;
    }
    setStatus("submitting");
    setTimeout(() => {
      try {
        const subscribers = JSON.parse(localStorage.getItem("heading_subscribers") || "[]");
        if (!subscribers.includes(email)) {
          subscribers.push(email);
          localStorage.setItem("heading_subscribers", JSON.stringify(subscribers));
        }
      } catch (err) {
        console.error(err);
      }
      setStatus("success");
      setEmail("");
    }, 1200);
  };

  if (status === "success") {
    return (
      <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-md text-emerald-400 space-y-2 animate-[fadeIn_0.3s_ease-out]">
        <div className="flex items-center gap-2 font-mono text-[10px] tracking-wider uppercase font-bold text-emerald-400">
          <Check size={14} /> FLIGHT PLAN COORDINATES CONVERGED!
        </div>
        <p className="font-serif text-sm font-semibold">Subscription Logged.</p>
        <p className="text-xs text-muted-2">We have configured your credentials on the flight desk queue. Detailed ground updates will navigate to your briefing folder soon.</p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubscribe} className="space-y-2">
      <div className="flex flex-col sm:flex-row gap-2 max-w-md">
        <input 
          type="email" 
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (status === "error") setStatus("idle");
          }}
          placeholder="Enter pilot flightline email..." 
          disabled={status === "submitting"}
          className="flex-grow h-10 px-4.5 bg-bg/60 border border-rule hover:border-rule-strong focus:border-navy focus:outline-none rounded text-xs text-ink transition-all placeholder:text-muted/60"
        />
        <button 
          type="submit"
          disabled={status === "submitting"}
          className="h-10 px-5 rounded bg-navy hover:bg-navy-strong border border-navy text-bg font-mono text-[10px] uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow disabled:opacity-50"
        >
          {status === "submitting" ? (
            <span className="inline-block w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
          ) : (
            "Join Deck Briefings"
          )}
        </button>
      </div>
      {status === "error" && (
        <p className="text-[10px] font-mono uppercase tracking-wider text-red-500 font-bold transition-opacity">
          &middot; {errMsg}
        </p>
      )}
    </form>
  );
}

// Simple Markdown Parser Component for rich layout inside React 19
function CustomMarkdown({ content }: { content: string }) {
  const lines = content.split("\n");
  const renderedElements: React.ReactNode[] = [];
  
  let keyIdx = 0;
  let inList = false;
  let listItems: string[] = [];
  let inTable = false;
  let tableRows: string[][] = [];

  const flushList = () => {
    if (listItems.length > 0) {
      renderedElements.push(
        <ul key={`list-${keyIdx++}`} className="list-disc pl-6 space-y-2 my-4 font-sans text-[15px] leading-relaxed text-ink-2">
          {listItems.map((item, id) => (
            <li key={id}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
      inList = false;
    }
  };

  const flushTable = () => {
    if (tableRows.length > 0) {
      const headers = tableRows[0];
      const rows = tableRows.slice(1).filter(r => r.length > 0 && !r.every(val => val.trim().startsWith("---")));
      
      renderedElements.push(
        <div key={`table-container-${keyIdx++}`} className="overflow-x-auto my-6 border border-rule rounded">
          <table className="min-w-full divide-y divide-rule font-sans text-xs sm:text-sm">
            <thead className="bg-bg-2">
              <tr>
                {headers.map((h, i) => (
                  <th key={i} className="px-4 py-2.5 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[9px]">
                    {h.trim()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule bg-paper">
              {rows.map((row, index) => (
                <tr key={index} className="hover:bg-bg-2/30">
                  {row.map((cell, i) => (
                    <td key={i} className="px-4 py-2.5 text-ink-2">
                      {parseInlineMarkdown(cell.trim())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      tableRows = [];
      inTable = false;
    }
  };

  const parseInlineMarkdown = (text: string) => {
    // Simple bold (**text**) mapping
    const parts = text.split(/\*\*([\s\S]*?)\*\*/g);
    if (parts.length === 1) return text;
    
    return parts.map((part, i) => {
      if (i % 2 === 1) {
        return <strong key={i} className="font-bold text-ink">{part}</strong>;
      }
      return part;
    });
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect Tables
    if (line.trim().startsWith("|")) {
      flushList();
      inTable = true;
      const columns = line.split("|").map(col => col.trim()).filter((col, idx, arr) => idx > 0 && idx < arr.length - 1);
      tableRows.push(columns);
      continue;
    } else {
      if (inTable && !line.trim().startsWith("|")) {
        flushTable();
      }
    }

    // Detect Lists
    if (line.trim().startsWith("* ") || line.trim().startsWith("- ")) {
      inList = true;
      listItems.push(line.replace(/^[\*\-]\s+/, ""));
      continue;
    } else {
      if (inList) {
        flushList();
      }
    }

    // Empty Lines
    if (line.trim() === "") {
      continue;
    }

    // Headings
    if (line.startsWith("# ")) {
      renderedElements.push(
        <h1 key={`h1-${keyIdx++}`} className="font-serif text-3xl sm:text-4xl font-bold text-ink tracking-tight mt-8 mb-4 leading-tight">
          {line.substring(2)}
        </h1>
      );
    } else if (line.startsWith("## ")) {
      renderedElements.push(
        <h2 key={`h2-${keyIdx++}`} className="font-serif text-xl sm:text-2xl font-bold text-ink tracking-tight mt-8 mb-3 border-b border-rule pb-1 leading-snug">
          {line.substring(3)}
        </h2>
      );
    } else if (line.startsWith("### ")) {
      renderedElements.push(
        <h3 key={`h3-${keyIdx++}`} className="font-serif text-lg font-bold text-ink mt-6 mb-2 leading-snug">
          {line.substring(4)}
        </h3>
      );
    } else if (line.startsWith("> ") || line.startsWith(">")) {
      renderedElements.push(
        <blockquote key={`bq-${keyIdx++}`} className="border-l-4 border-navy-soft pl-4 italic text-muted text-sm sm:text-base my-4 bg-bg-2/30 p-2.5 rounded-r">
          {parseInlineMarkdown(line.replace(/^>\s*/, ""))}
        </blockquote>
      );
    } else {
      // Custom In-article high-yield Adsense placements
      if (line.trim() === "---") {
        renderedElements.push(
          <AdSlot key={`ad-${keyIdx++}`} slotId={import.meta.env.VITE_ADSENSE_SLOT_ARTICLE} />
        );
      } else {
        // Standard Paragraph
        renderedElements.push(
          <p key={`p-${keyIdx++}`} className="font-sans text-[15px] sm:text-base text-ink-2 leading-relaxed mb-4">
            {parseInlineMarkdown(line)}
          </p>
        );
      }
    }
  }

  // Flush remaining elements
  flushList();
  flushTable();

  return <div className="space-y-4">{renderedElements}</div>;
}

export default function BlogPostView() {
  const { slug } = useParams<{ slug: string }>();
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const { openAuthModal } = useAuth();

  useEffect(() => {
    window.scrollTo(0, 0);
    
    async function loadPost() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("*")
          .eq("slug", slug)
          .maybeSingle();

        if (error) {
          console.warn("Supabase single post fetch warning:", error);
        }

        if (data) {
          const formatted: BlogPost = {
            slug: data.slug,
            title: data.title,
            description: data.description,
            date: data.date || new Date(data.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            readTime: data.read_time || data.readTime || "5 min read",
            category: data.category,
            tags: Array.isArray(data.tags) ? data.tags : (typeof data.tags === "string" ? JSON.parse(data.tags || "[]") : []),
            content: data.content,
            author: data.author,
            authorRole: data.author_role || data.authorRole || "Aviation Expert"
          };
          setPost(formatted);
        } else {
          // Fallback to static blogPosts
          const matched = blogPosts.find(p => p.slug === slug);
          setPost(matched || null);
        }
      } catch (err) {
        console.error("Error loading blog post from Supabase:", err);
        const matched = blogPosts.find(p => p.slug === slug);
        setPost(matched || null);
      } finally {
        setLoading(false);
      }
    }
    
    if (slug) {
      loadPost();
    }
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-6 py-20 space-y-8 animate-pulse font-sans">
        <div className="h-4 bg-ink/10 w-24 rounded" />
        <div className="space-y-4">
          <div className="h-10 bg-ink/10 w-4/5 rounded" />
          <div className="h-10 bg-ink/10 w-2/3 rounded" />
        </div>
        <div className="h-6 bg-ink/5 w-1/2 rounded" />
        <div className="space-y-4 pt-8">
          <div className="h-4 bg-ink/5 w-full rounded" />
          <div className="h-4 bg-ink/5 w-full rounded" />
          <div className="h-4 bg-ink/5 w-3/4 rounded" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center font-sans">
        <h1 className="font-serif text-3xl font-bold mb-4 text-ink">Article Flight Deflection</h1>
        <p className="text-muted mb-8">The requested academic publication could not be charted.</p>
        <Link to="/blog">
          <Button variant="primary">Return to Aviation Log</Button>
        </Link>
      </div>
    );
  }

  // Structured Data (JSON-LD Article Schema)
  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.description,
    "datePublished": "2026-05-24",
    "dateModified": "2026-05-24",
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": window.location.href
    },
    "author": {
      "@type": "Person",
      "name": post.author,
      "jobTitle": post.authorRole
    },
    "publisher": {
      "@type": "Organization",
      "name": "Heading",
      "logo": {
        "@type": "ImageObject",
        "url": `${window.location.origin}/icon.png`
      }
    }
  };

  // Find related articles sharing the most tags
  const relatedPosts = blogPosts
    .filter(p => p.slug !== post.slug)
    .map(p => {
      const sharedTagsCount = p.tags.filter(t => post?.tags.includes(t)).length;
      return { post: p, score: sharedTagsCount };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 2)
    .map(item => item.post);

  return (
    <div className="bg-bg min-h-screen pb-20 animate-[fadeIn_0.4s_ease-out]">
      <ReadingProgress />
      {/* Inject Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(articleJsonLd)}
      </script>

      {/* BACK NAVIGATION */}
      <div className="max-w-4xl mx-auto px-6 pt-6 flex items-center justify-between">
        <Link 
          to="/blog" 
          className="inline-flex items-center gap-1 font-mono text-[10px] tracking-wider uppercase text-muted hover:text-ink transition-colors"
        >
          <ChevronLeft size={14} /> Back to Blog Index
        </Link>

        {/* Share / Save buttons */}
        <div className="flex items-center gap-2">
          <button className="p-2 rounded bg-paper border border-rule hover:bg-bg-2 text-muted hover:text-ink transition-all cursor-pointer">
            <Share2 size={13} />
          </button>
          <button className="p-2 rounded bg-paper border border-rule hover:bg-bg-2 text-muted hover:text-ink transition-all cursor-pointer">
            <Bookmark size={13} />
          </button>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-6 mt-6">
        {/* POST HEADER */}
        <div className="space-y-6 pb-6 border-b border-rule">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block px-2.5 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-navy-soft/10 text-navy font-semibold">
              {post.category}
            </span>
            <span className="text-muted-2 font-mono text-[10px]">&middot;</span>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
              <Calendar size={11} /> {post.date}
            </div>
            <span className="text-muted-2 font-mono text-[10px]">&middot;</span>
            <div className="flex items-center gap-1.5 font-mono text-[10px] text-muted">
              <Clock size={11} /> {post.readTime}
            </div>
          </div>

          <h1 className="font-serif text-3xl sm:text-5xl font-bold text-ink leading-[1.15] tracking-tight">
            {post.title}
          </h1>

          <p className="font-sans text-muted text-base sm:text-lg leading-relaxed italic border-l-2 border-rule pl-4">
            {post.description}
          </p>

          {/* Author Details Block */}
          <div className="flex items-center gap-3 bg-paper p-3 rounded-md border border-rule/60 max-w-sm">
            <div className="w-9 h-9 rounded-full bg-navy/10 text-navy flex items-center justify-center font-bold">
              <User size={16} />
            </div>
            <div className="font-sans">
              <p className="text-xs font-semibold text-ink leading-tight">{post.author}</p>
              <p className="text-[10px] font-mono text-muted uppercase tracking-wider leading-none mt-0.5">{post.authorRole}</p>
            </div>
          </div>
        </div>

        {/* POST CONTENT */}
        <div className="prose max-w-none mt-8">
          <CustomMarkdown content={post.content} />
        </div>

        {/* BOTTOM HIGH-MONETIZATION CTAS */}
        <div className="mt-16 border-t border-rule pt-8 space-y-6">
          <Card className="bg-navy p-6 sm:p-8 text-bg border border-navy shadow-lg relative overflow-hidden rounded">
            {/* abstract visual accent */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:12px_12px] opacity-10 pointer-events-none" />
            
            <div className="max-w-xl space-y-4 relative z-10 font-sans">
              <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[8px] tracking-widest bg-amber text-navy uppercase font-mono font-bold">
                <Sparkles size={10} className="text-navy" /> Heading Training Integration
              </div>
              <h2 className="font-serif text-2xl sm:text-3xl font-bold text-bg leading-tight">
                Practice Aligned Theory Questions Free
              </h2>
              <p className="text-bg-2 text-xs sm:text-sm leading-relaxed">
                Clear EASA/DGCA CPL & ATPL paper margins by testing simulated exams aligned with the {post.category} curriculum. Built-in performance dashboards highlight your weak system chapters instantly.
              </p>
              <div className="pt-2 flex flex-wrap gap-3">
                <button 
                  onClick={() => openAuthModal && openAuthModal("signup")}
                  className="h-10 px-5 rounded bg-amber text-navy hover:bg-amber-strong font-mono text-xs uppercase tracking-widest font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow"
                >
                  Start Practice Deck <ArrowRight size={14} className="animate-pulse" />
                </button>
                <Link to="/modules">
                  <Button variant="ghost" className="h-10 text-xs border-bg/30 text-bg hover:bg-bg/10 hover:text-bg">
                    Browse Core Syllabus
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        </div>

        {/* NEWSLETTER SIGNUP FORM */}
        <div className="mt-12 bg-paper border border-rule p-6 sm:p-8 rounded shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-24 h-24 bg-[radial-gradient(#0f1e31_1px,transparent_1px)] [background-size:8px_8px] opacity-[0.05] pointer-events-none" />
          <div className="space-y-4 max-w-xl font-sans relative z-10">
            <span className="inline-block px-2.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-navy-soft/10 text-navy font-semibold border border-navy/10">
              Exam brief updates
            </span>
            <h3 className="font-serif text-xl sm:text-2xl font-bold text-ink">
              Subscribe to Bulletins & Simulated Deck Updates
            </h3>
            <p className="text-muted text-xs sm:text-sm leading-relaxed">
              Stay ahead of sudden syllabus shifts, fresh EASA theoretical question drops, and Airbus technical FCOM systems deep-dives. We send only high-density study logs straight to your inbox.
            </p>
            <NewsletterSubCard />
          </div>
        </div>

        {/* RELATED ARTICLES SECTION */}
        {relatedPosts.length > 0 && (
          <div className="mt-12 space-y-4 font-sans">
            <h3 className="font-mono text-[10px] tracking-wider uppercase text-muted font-bold">
              Related Syllabus Chapters
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {relatedPosts.map((rPost) => (
                <Card key={rPost.slug} className="bg-paper border border-rule p-5 hover:border-navy-soft transition-all duration-300 rounded group flex flex-col justify-between">
                  <div className="space-y-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider text-navy bg-navy-soft/10 px-1.5 py-0.5 rounded font-semibold self-start inline-block">
                      {rPost.category}
                    </span>
                    <Link to={`/blog/${rPost.slug}`}>
                      <h4 className="font-serif text-sm sm:text-base font-bold text-ink group-hover:text-navy group-hover:underline leading-snug">
                        {rPost.title}
                      </h4>
                    </Link>
                    <p className="text-muted text-[11px] sm:text-xs line-clamp-2 leading-relaxed">
                      {rPost.description}
                    </p>
                  </div>
                  <div className="pt-3 border-t border-rule mt-3 flex items-center justify-between text-[10px] text-muted font-mono">
                    <span>{rPost.date}</span>
                    <Link to={`/blog/${rPost.slug}`} className="text-navy group-hover:text-navy-strong font-bold uppercase tracking-wider">
                      Read Post &rarr;
                    </Link>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* ADSENSE RECOMMENDATION FOOTER AD FRAME */}
        <div className="mt-12 py-4 bg-bg-2/30 border border-rule/50 rounded text-center select-none text-muted-2">
          <span className="font-mono text-[7px] uppercase tracking-widest">Sponsored Recommendation Grid</span>
          <div className="h-[120px] border border-dashed border-rule rounded bg-paper/60 flex items-center justify-center mt-1">
            <span className="font-mono text-[9px] uppercase tracking-wider font-bold text-muted">Related Commercial Offers Ads Slot</span>
          </div>
        </div>

        {/* RELATED COMPLETED CHIPS */}
        <div className="mt-12 space-y-4">
          <h3 className="font-mono text-[10px] tracking-wider uppercase text-muted font-bold">Article Tags</h3>
          <div className="flex flex-wrap gap-2">
            {post.tags.map((t, idx) => (
              <span key={idx} className="font-mono text-[9px] border border-rule bg-paper text-muted-2 px-2.5 py-1 rounded">
                #{t.replace(/\s+/g, "").toLowerCase()}
              </span>
            ))}
          </div>
        </div>

      </article>
    </div>
  );
}
