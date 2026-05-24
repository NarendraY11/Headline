import React, { useState, useEffect } from "react";
import { Button, Card } from "../../components/Atoms";
import { supabase } from "../../lib/supabase";
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle2, 
  FileText, 
  BookOpen
} from "lucide-react";

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/^-+|-+$/g, "");
};

export default function BlogManager() {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [currentPost, setCurrentPost] = useState<Partial<any>>({
    slug: "",
    title: "",
    description: "",
    date: "",
    read_time: "5 min read",
    category: "Study Guides",
    tags: [],
    content: "",
    author: "",
    author_role: "Chief Theory Instructor",
    status: "draft"
  });

  const [tagInput, setTagInput] = useState("");
  const [errorStatus, setErrorStatus] = useState("");
  const [successStatus, setSuccessStatus] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  // Sync / pull blogs from Supabase
  const loadPosts = async () => {
    setLoading(true);
    setErrorStatus("");
    try {
      const { data, error } = await supabase
        .from("blog_posts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
    } catch (err: any) {
      console.error("Error fetching blog posts for manager:", err);
      setErrorStatus(err.message || "Failed to load blog posts from Supabase.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const openNewModal = () => {
    setIsNew(true);
    setCurrentPost({
      slug: "",
      title: "",
      description: "",
      date: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      read_time: "6 min read",
      category: "Study Guides",
      tags: ["Flight Training"],
      content: "",
      author: "Chief Instructor",
      author_role: "Chief Theory Instructor",
      status: "draft"
    });
    setTagInput("Flight Training");
    setErrorStatus("");
    setIsEditing(true);
  };

  const openEditModal = (post: any) => {
    setIsNew(false);
    let tagsArray = [];
    if (Array.isArray(post.tags)) {
      tagsArray = post.tags;
    } else if (typeof post.tags === "string") {
      try {
        tagsArray = JSON.parse(post.tags || "[]");
      } catch (e) {
        tagsArray = post.tags.split(",").map((t: string) => t.trim());
      }
    }
    setCurrentPost({
      ...post,
      tags: tagsArray
    });
    setTagInput(tagsArray.join(", "));
    setErrorStatus("");
    setIsEditing(true);
  };

  const handleTitleChange = (title: string) => {
    setCurrentPost((prev) => {
      const next = { ...prev, title };
      if (isNew) {
        next.slug = slugify(title);
      }
      return next;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(false);
    setErrorStatus("");
    setSuccessStatus("");

    const targetSlug = currentPost.slug?.trim();
    if (!targetSlug || !currentPost.title?.trim()) {
      setErrorStatus("Post URL Slug and Title are required fields.");
      return;
    }

    setIsSaving(true);
    try {
      const tagsParsed = tagInput
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        slug: targetSlug,
        title: currentPost.title.trim(),
        description: currentPost.description?.trim() || "",
        date: currentPost.date || new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        read_time: currentPost.read_time || "5 min read",
        category: currentPost.category || "General",
        tags: tagsParsed, // PostgreSQL JSON column or jsonb handles Arrays natively or as JSON string depending on driver
        content: currentPost.content || "",
        author: currentPost.author?.trim() || "Aviation Expert",
        author_role: currentPost.author_role?.trim() || "Chief Theory Instructor",
        status: currentPost.status || "draft",
        updated_at: new Date().toISOString()
      };

      let saveError;
      if (isNew) {
        // Check if slug exists already
        const { data: existing } = await supabase
          .from("blog_posts")
          .select("slug")
          .eq("slug", targetSlug)
          .maybeSingle();

        if (existing) {
          throw new Error(`The URL slug '${targetSlug}' is already claimed by another post.`);
        }

        const { error } = await supabase
          .from("blog_posts")
          .insert([payload]);
        saveError = error;
      } else {
        const { error } = await supabase
          .from("blog_posts")
          .update(payload)
          .eq("slug", targetSlug);
        saveError = error;
      }

      if (saveError) throw saveError;

      setSuccessStatus(`Successfully saved publication '${payload.title}'`);
      setIsEditing(false);
      loadPosts();
    } catch (err: any) {
      console.error("Error saving blog post:", err);
      setErrorStatus(err.message || "Failed to save blog post into Supabase catalog.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (slug: string) => {
    if (!window.confirm("Are you 100% sure you want to delete this publication? This action is irreversible.")) {
      return;
    }

    setErrorStatus("");
    setSuccessStatus("");
    try {
      const { error } = await supabase
        .from("blog_posts")
        .delete()
        .eq("slug", slug);

      if (error) throw error;
      setSuccessStatus("Post deleted successfully.");
      loadPosts();
    } catch (err: any) {
      console.error("Error deleting post:", err);
      setErrorStatus(err.message || "Failed to delete post.");
    }
  };

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto font-sans">
      
      {/* Back to top row / headers */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-rule pb-6">
        <div>
          <h1 className="font-serif text-3xl font-bold text-ink">Blog Publications Manager</h1>
          <p className="text-muted text-xs sm:text-sm leading-relaxed mt-1">
            Write, publish and manage articles stored in your live cloud Supabase database, feeding search engine crawling loops.
          </p>
        </div>
        <Button 
          variant="primary" 
          onClick={openNewModal}
          className="h-10 px-5 text-xs font-mono uppercase bg-ink text-bg rounded-lg hover:bg-ink-2 shadow transition-all flex items-center gap-2 cursor-pointer"
        >
          <Plus size={16} /> New Article
        </Button>
      </div>

      {errorStatus && (
        <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg text-orange-900 dark:text-orange-200 text-xs sm:text-sm flex items-start gap-2.5">
          <AlertCircle size={18} className="text-orange-500 shrink-0 mt-0.5" />
          <span>{errorStatus}</span>
        </div>
      )}

      {successStatus && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-900 dark:text-emerald-200 text-xs sm:text-sm flex items-start gap-2.5">
          <CheckCircle2 size={18} className="text-emerald-500 shrink-0 mt-0.5" />
          <span>{successStatus}</span>
        </div>
      )}

      {/* NEW/EDIT MODAL OVERLAY */}
      {isEditing && (
        <div className="fixed inset-0 bg-ink/30 dark:bg-ink/60 backdrop-blur-sm flex items-center justify-center p-4 z-[99] animate-[fadeIn_0.2s_ease-out]">
          <div className="bg-paper border border-rule shadow-2xl rounded-xl w-full max-w-3xl relative max-h-[90vh] flex flex-col">
            
            <div className="p-6 border-b border-rule flex items-center justify-between shrink-0">
              <h2 className="font-serif text-xl font-bold text-ink">
                {isNew ? "Draft New Article" : "Edit Publication Settings"}
              </h2>
              <button 
                onClick={() => setIsEditing(false)}
                className="text-muted-2 hover:text-ink transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSave} className="overflow-y-auto p-6 space-y-4 flex-1 text-left">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Title */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Title *
                  </label>
                  <input 
                    type="text"
                    required
                    value={currentPost.title || ""}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    placeholder="Enter fascinating article heading..."
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  />
                </div>

                {/* Slug */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    URL Slug * (Requires unique ID)
                  </label>
                  <input 
                    type="text"
                    required
                    value={currentPost.slug || ""}
                    onChange={(e) => setCurrentPost({ ...currentPost, slug: slugify(e.target.value) })}
                    placeholder="airline-fcom-control-computers"
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all font-mono"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                  Sitemap Description (Max 160 Characters for Optimal SERP Crawling)
                </label>
                <textarea 
                  value={currentPost.description || ""}
                  onChange={(e) => setCurrentPost({ ...currentPost, description: e.target.value })}
                  placeholder="Summarize the core concepts tested on the exam..."
                  rows={2}
                  className="w-full p-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Category */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Category
                  </label>
                  <select 
                    value={currentPost.category || "Study Guides"}
                    onChange={(e) => setCurrentPost({ ...currentPost, category: e.target.value })}
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  >
                    <option value="Syllabus Guides">Syllabus Guides</option>
                    <option value="Study Guides">Study Guides</option>
                    <option value="Type Rating">Type Rating</option>
                    <option value="FAA Written">FAA Written</option>
                    <option value="Aviation Meteorology">Aviation Meteorology</option>
                    <option value="Regulations">Regulations</option>
                  </select>
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Tags (Comma Separated)
                  </label>
                  <input 
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    placeholder="DGCA CPL, Meteorology, Weather"
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  />
                </div>

                {/* Read Time */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Read Time Estimate
                  </label>
                  <input 
                    type="text"
                    value={currentPost.read_time || "5 min read"}
                    onChange={(e) => setCurrentPost({ ...currentPost, read_time: e.target.value })}
                    placeholder="6 min read"
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Author */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Author Name
                  </label>
                  <input 
                    type="text"
                    value={currentPost.author || ""}
                    onChange={(e) => setCurrentPost({ ...currentPost, author: e.target.value })}
                    placeholder="Capt. Rahul Sharma"
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  />
                </div>

                {/* Author Role */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Author Professional Title
                  </label>
                  <input 
                    type="text"
                    value={currentPost.author_role || ""}
                    onChange={(e) => setCurrentPost({ ...currentPost, author_role: e.target.value })}
                    placeholder="Chief Flight Instructor"
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  />
                </div>

                {/* Status */}
                <div>
                  <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                    Publication Node
                  </label>
                  <select 
                    value={currentPost.status || "draft"}
                    onChange={(e) => setCurrentPost({ ...currentPost, status: e.target.value })}
                    className="w-full h-10 px-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all"
                  >
                    <option value="draft">Draft (Private to Admin)</option>
                    <option value="published">Published (Sitemap & SERP Visible)</option>
                  </select>
                </div>
              </div>

              {/* MD Body */}
              <div>
                <label className="block text-[11px] font-mono uppercase tracking-wider text-muted-2 mb-1.5 font-bold">
                  Markdown Content
                </label>
                <textarea 
                  required
                  value={currentPost.content || ""}
                  onChange={(e) => setCurrentPost({ ...currentPost, content: e.target.value })}
                  placeholder="# Enter your Markdown Body. Write headers using # and ##..."
                  rows={8}
                  className="w-full p-3 bg-bg/40 border border-rule focus:border-navy focus:outline-none rounded text-xs text-ink transition-all font-mono"
                />
              </div>

              <div className="pt-4 flex justify-end gap-3 shrink-0">
                <Button 
                  variant="ghost" 
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="h-10 text-xs font-mono uppercase"
                >
                  Cancel
                </Button>
                <Button 
                  variant="primary" 
                  type="submit"
                  disabled={isSaving}
                  className="h-10 px-5 text-bg bg-ink text-xs font-mono uppercase flex items-center justify-center gap-2"
                >
                  {isSaving ? (
                    <span className="w-4 h-4 border-2 border-bg border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <Save size={14} /> Commit Changes
                    </>
                  )}
                </Button>
              </div>

            </form>

          </div>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <Card className="p-5 border-rule bg-paper rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-navy/10 text-navy flex items-center justify-center">
            <BookOpen size={18} />
          </div>
          <div>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Total Stored</p>
            <h3 className="text-xl font-serif font-bold text-ink mt-0.5">{posts.length} Publications</h3>
          </div>
        </Card>

        <Card className="p-5 border-rule bg-paper rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Published</p>
            <h3 className="text-xl font-serif font-bold text-ink mt-0.5">
              {posts.filter(p => p.status === "published").length} Live
            </h3>
          </div>
        </Card>

        <Card className="p-5 border-rule bg-paper rounded-xl shadow-sm flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-orange-500/10 text-orange-600 flex items-center justify-center">
            <FileText size={18} />
          </div>
          <div>
            <p className="font-mono text-[9px] text-muted uppercase tracking-wider">Drafts</p>
            <h3 className="text-xl font-serif font-bold text-ink mt-0.5">
              {posts.filter(p => p.status !== "published").length} Under Review
            </h3>
          </div>
        </Card>
      </div>

      {/* LIVE DB MAIN TABLE */}
      <Card className="border border-rule bg-paper rounded-xl shadow-sm overflow-hidden select-none">
        <div className="px-5 py-4 border-b border-rule bg-paper sticky top-0 flex items-center justify-between">
          <h3 className="font-serif text-base font-bold text-ink">Publications Database Index</h3>
          <span className="font-mono text-[8.5px] text-muted-2 uppercase tracking-wide">SUPABASE SYNC OK</span>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-12 text-center text-muted text-xs font-mono">
              <span className="inline-block w-6 h-6 border-2 border-navy border-t-transparent rounded-full animate-spin mb-3"></span>
              <p>Fetching Dynamic Database State...</p>
            </div>
          ) : posts.length === 0 ? (
            <div className="p-12 text-center max-w-md mx-auto space-y-3 font-sans">
              <BookOpen size={32} className="text-muted mx-auto" />
              <h4 className="font-serif text-lg font-bold text-ink">Zero Database Articles Found</h4>
              <p className="text-muted text-xs leading-relaxed">
                Supabase blog_posts table contains 0 elements. Create a new article now, or keep browsing static fallback files.
              </p>
              <Button onClick={openNewModal} variant="primary" className="h-9 px-4 text-xs font-mono uppercase pt-1">
                Create First Article
              </Button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-rule font-sans text-xs sm:text-sm">
              <thead className="bg-bg-2">
                <tr className="border-b border-rule">
                  <th className="px-5 py-3 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">Title</th>
                  <th className="px-5 py-3 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">URL Slug</th>
                  <th className="px-5 py-3 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">Category</th>
                  <th className="px-5 py-3 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">Author</th>
                  <th className="px-5 py-3 text-left font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">Status</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink uppercase tracking-wider font-mono text-[8.5px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-rule bg-paper text-[12px]">
                {posts.map((post) => {
                  let statusColor = "bg-orange-500/10 text-orange-600 border border-orange-500/20";
                  if (post.status === "published") {
                    statusColor = "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20";
                  }
                  
                  return (
                    <tr key={post.slug} className="hover:bg-bg-2/30">
                      <td className="px-5 py-3.5 font-medium text-ink truncate max-w-[200px]">
                        {post.title}
                      </td>
                      <td className="px-5 py-3.5 text-muted-2 font-mono text-[10.5px]">
                        /blog/{post.slug}
                      </td>
                      <td className="px-5 py-3.5 text-muted">
                        {post.category}
                      </td>
                      <td className="px-5 py-3.5 text-muted truncate max-w-[120px]">
                        {post.author}
                      </td>
                      <td className="px-5 py-3.5 font-mono text-[9px]">
                        <span className={`inline-block px-1.5 py-0.5 rounded ${statusColor} font-bold uppercase`}>
                          {post.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-right font-mono text-[10px] space-x-2 shrink-0 select-none">
                        <button 
                          onClick={() => openEditModal(post)}
                          className="p-1 px-2.5 bg-paper hover:bg-bg-2 border border-rule hover:border-rule-strong rounded text-ink font-semibold flex items-center gap-1 inline-flex cursor-pointer transition-colors"
                        >
                          <Edit2 size={11} /> Edit
                        </button>
                        <button 
                          onClick={() => handleDelete(post.slug)}
                          className="p-1 px-2 text-rose-600 hover:bg-rose-50 border border-rule hover:border-rose-200 rounded font-semibold inline-flex cursor-pointer transition-colors"
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </Card>

    </div>
  );
}
