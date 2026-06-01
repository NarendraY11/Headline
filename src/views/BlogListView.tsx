import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { blogPosts, BlogPost } from "../data/blog";
import { AdSlot } from "../components/AdSlot";
import { Card, Button } from "../components/Atoms";
import { supabase } from "../lib/supabase";
import { 
  Search, 
  Clock, 
  ChevronRight, 
  Calendar, 
  User, 
  ArrowUpRight,
  Target,
  Sparkles
} from "lucide-react";

export default function BlogListView() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    window.scrollTo(0, 0);
    
    async function loadPosts() {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("blog_posts")
          .select("*")
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("Supabase load blog posts warning:", error);
        }

        if (data && data.length > 0) {
          const formatted: BlogPost[] = data.map((item: any) => ({
            slug: item.slug,
            title: item.title,
            description: item.description,
            date: item.date || new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
            readTime: item.read_time || item.readTime || "5 min read",
            category: item.category,
            tags: Array.isArray(item.tags) ? item.tags : (typeof item.tags === "string" ? JSON.parse(item.tags || "[]") : []),
            content: item.content,
            author: item.author,
            authorRole: item.author_role || item.authorRole || "Aviation Expert"
          }));
          
          // Merge static with dynamic database posts, avoiding slug duplication
          const dynamicSlugs = new Set(formatted.map(p => p.slug));
          const nonDupStatic = blogPosts.filter(p => !dynamicSlugs.has(p.slug));
          setPosts([...formatted, ...nonDupStatic]);
        } else {
          setPosts(blogPosts);
        }
      } catch (err) {
        console.error("Error fetching blogs from Supabase:", err);
        setPosts(blogPosts);
      } finally {
        setLoading(false);
      }
    }
    loadPosts();
  }, []);

  const categories = ["All", ...Array.from(new Set(posts.map(p => p.category)))];

  const filteredPosts = posts.filter(post => {
    const matchesSearch = 
      post.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      post.tags.some(t => t.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesCategory = selectedCategory === "All" || post.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  // Dynamic Organization metadata
  const blogListJsonLd = {
    "@context": "https://schema.org",
    "@type": "Blog",
    "name": "Heading Pilot Theory Blog",
    "description": "Educational articles, DGCA rules, and EASA syllabus summaries for airline flight training.",
    "publisher": {
      "@type": "Organization",
      "name": "Heading",
      "url": window.location.origin
    },
    "blogPost": posts.map(p => ({
      "@type": "BlogPosting",
      "headline": p.title,
      "description": p.description,
      "datePublished": "2026-05-24",
      "url": `${window.location.origin}/blog/${p.slug}`,
      "author": {
        "@type": "Person",
        "name": p.author
      }
    }))
  };

  return (
    <div className="bg-bg min-h-screen pb-20 animate-[fadeIn_0.4s_ease-out]">
      {/* Inject Schema LD */}
      <script type="application/ld+json">
        {JSON.stringify(blogListJsonLd)}
      </script>

      {/* HEADER SECTION */}
      <div className="bg-paper border-b border-rule py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(#0d1a2d_1px,transparent_1px)] [background-size:16px_16px] opacity-[0.02]" />

        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="max-w-2xl space-y-4">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[9px] font-mono uppercase tracking-wider bg-navy/10 text-navy border border-navy/20">
              <Sparkles size={11} className="text-navy animate-pulse" /> Pilot Knowledge Center
            </div>
            <h1 className="font-serif text-4xl sm:text-5xl font-bold text-ink leading-none tracking-tight">
              Theoretical Flight Blog
            </h1>
            <p className="font-sans text-muted text-lg leading-relaxed max-w-xl">
              In-depth syllabus guides, regulatory breakdowns, and theoretical tactics curated from active flight captains and examiners. Designed to pass exams and feed organic-traffic channels.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 mt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* MAIN ARTICLES CONTAINER */}
          <div className="lg:col-span-8 space-y-8">
            
            {/* SEARCH AND CATEGORY FILTERING CONTROLS */}
            <div className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 text-muted-2" size={16} />
                <input 
                  type="text" 
                  placeholder="Search aviation articles, exam questions, systems..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full h-12 bg-paper border border-rule hover:border-rule-strong focus:border-navy focus:outline-none pl-11 pr-4 rounded font-sans text-sm text-ink transition-all shadow-sm"
                />
              </div>

              {/* Category Pills */}
              <div className="flex flex-wrap items-center gap-1.5 pt-1">
                {categories.map((cat, idx) => (
                  <button 
                    key={idx}
                    onClick={() => setSelectedCategory(cat)}
                    className={`h-8 px-3.5 rounded text-[10px] font-mono uppercase tracking-wider border transition-all cursor-pointer ${
                      selectedCategory === cat 
                        ? "bg-navy text-bg border-navy font-semibold shadow-sm" 
                        : "bg-paper text-muted hover:text-ink border-rule hover:border-rule-strong"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <AdSlot slotId={import.meta.env.VITE_ADSENSE_SLOT_BANNER} />

            {/* ARTICLES LOOP */}
            {loading ? (
              <div className="space-y-6">
                {[1, 2, 3].map((n) => (
                  <Card key={n} className="bg-paper border border-rule p-6 rounded shadow-sm flex flex-col justify-between animate-pulse">
                    <div className="space-y-4">
                      <div className="flex gap-4">
                        <div className="h-4 bg-ink/10 w-20 rounded" />
                        <div className="h-4 bg-ink/10 w-24 rounded" />
                        <div className="h-4 bg-ink/10 w-16 rounded" />
                      </div>
                      <div className="h-6 bg-ink/10 w-4/5 rounded animate-pulse" />
                      <div className="space-y-2">
                        <div className="h-4 bg-ink/5 w-full rounded" />
                        <div className="h-4 bg-ink/5 w-2/3 rounded" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredPosts.length > 0 ? (
              <div className="space-y-6">
                {filteredPosts.map((post) => (
                  <Card 
                    key={post.slug} 
                    className="bg-paper border border-rule p-6 hover:border-navy-soft transition-all duration-300 rounded shadow-sm hover:shadow group flex flex-col justify-between"
                  >
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted">
                        <span className="inline-flex items-center gap-1 text-navy font-semibold uppercase tracking-wider bg-navy-soft/10 px-1.5 py-0.5 rounded">
                          {post.category}
                        </span>
                        <span className="flex items-center gap-1"><Calendar size={11} /> {post.date}</span>
                        <span className="flex items-center gap-1"><Clock size={11} /> {post.readTime}</span>
                      </div>

                      <Link to={`/blog/${post.slug}`} className="block group-hover:text-navy transition-colors">
                        <h2 className="font-serif text-xl sm:text-2xl font-bold text-ink leading-tight tracking-tight group-hover:underline">
                          {post.title}
                        </h2>
                      </Link>

                      <p className="font-sans text-xs sm:text-sm text-muted-2 leading-relaxed line-clamp-2">
                        {post.description}
                      </p>

                      {/* Clickable Card Tags */}
                      <div className="flex flex-wrap gap-1.5 pt-2">
                        {post.tags.map((t, idx) => (
                          <button
                            key={idx}
                            onClick={(e) => {
                              e.preventDefault();
                              setSearchTerm(t);
                            }}
                            className="font-mono text-[9px] border border-rule bg-bg-2/10 hover:bg-navy-soft/10 text-muted-2 hover:text-navy hover:border-navy-soft px-2 py-0.5 rounded transition-all cursor-pointer"
                          >
                            #{t.toLowerCase()}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-5 border-t border-rule mt-5 flex flex-wrap items-center justify-between gap-4">
                      {/* Author */}
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-navy/10 text-navy flex items-center justify-center">
                          <User size={11} />
                        </div>
                        <div className="font-sans">
                          <p className="text-[11px] font-semibold text-ink leading-none">{post.author}</p>
                          <p className="text-[8px] font-mono text-muted uppercase tracking-wider">{post.authorRole}</p>
                        </div>
                      </div>

                      {/* Read Link */}
                      <Link 
                        to={`/blog/${post.slug}`}
                        className="inline-flex items-center gap-1 font-mono text-[11px] font-bold text-navy uppercase tracking-wider group-hover:text-navy-strong"
                      >
                        Read Chapter <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                      </Link>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="bg-paper border border-rule p-12 text-center rounded">
                <h3 className="font-serif text-lg font-bold text-ink">No articles matched your coordinates</h3>
                <p className="text-muted text-xs mt-1">Adjust search parameters or select a different subject category.</p>
                <Button variant="ghost" onClick={() => { setSearchTerm(""); setSelectedCategory("All"); }} className="h-8 text-xs mt-4">
                  Clear Flight Coordinates
                </Button>
              </div>
            )}

          </div>

          {/* SIDEBAR */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* SEO VALUE CTA */}
            <Card className="bg-paper border border-rule p-5 space-y-4 rounded shadow-sm">
              <h3 className="font-mono text-[10px] tracking-wider uppercase text-muted font-bold flex items-center gap-2">
                <Target size={13} className="text-signal animate-pulse" /> Simulated Cockpit
              </h3>
              <p className="font-sans text-xs text-muted-2 leading-relaxed">
                Study DGCA, EASA and A320 FCOM structures using Heading's interactive desktop exam simulators. Highly rated by global cadets.
              </p>
              <Link to="/mock-exams">
                <button className="w-full h-9 rounded bg-navy text-bg font-mono text-[10px] uppercase tracking-widest font-semibold hover:bg-navy-strong transition-all flex items-center justify-center gap-1 cursor-pointer">
                  Launch Free Mock Suite <ChevronRight size={11} />
                </button>
              </Link>
            </Card>

            <AdSlot slotId={import.meta.env.VITE_ADSENSE_SLOT_SQUARE} format="rectangle" />

            {/* RELATED EXAMS SUMMARY CARDS */}
            <Card className="bg-paper border border-rule p-5 space-y-4 rounded shadow-sm">
              <h3 className="font-mono text-[10px] tracking-wider uppercase text-muted font-bold">Exam Knowledge Centers</h3>
              <div className="space-y-3 font-sans text-xs">
                <div className="flex items-center justify-between">
                  <Link to="/exams/dgca-cpl" className="font-medium text-ink hover:text-navy hover:underline">DGCA CPL India</Link>
                  <span className="font-mono text-[8px] bg-bg-2 px-1.5 rounded uppercase">70% Pass</span>
                </div>
                <hr className="border-t border-rule" />
                <div className="flex items-center justify-between">
                  <Link to="/exams/easa-atpl" className="font-medium text-ink hover:text-navy hover:underline">EASA ATPL Europe</Link>
                  <span className="font-mono text-[8px] bg-bg-2 px-1.5 rounded uppercase">75% Pass</span>
                </div>
                <hr className="border-t border-rule" />
                <div className="flex items-center justify-between">
                  <Link to="/exams/faa-written" className="font-medium text-ink hover:text-navy hover:underline">FAA Written USA</Link>
                  <span className="font-mono text-[8px] bg-bg-2 px-1.5 rounded uppercase">70% Pass</span>
                </div>
                <hr className="border-t border-rule" />
                <div className="flex items-center justify-between">
                  <Link to="/exams/a320-type-rating" className="font-medium text-ink hover:text-navy hover:underline">A320 Systems Rating</Link>
                  <span className="font-mono text-[8px] bg-bg-2 px-1.5 rounded uppercase">80% Pass</span>
                </div>
              </div>
            </Card>

          </div>

        </div>
      </div>
    </div>
  );
}
