import { ArrowLeft } from "lucide-react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/Atoms";

export default function NotFoundView() {
  // SPA can't return a real 404 HTTP status, so at least keep crawlers from
  // indexing unknown routes as valid pages (mitigates the soft-404 problem).
  useEffect(() => {
    const meta = document.createElement("meta");
    meta.name = "robots";
    meta.content = "noindex, follow";
    document.head.appendChild(meta);
    return () => {
      document.head.removeChild(meta);
    };
  }, []);

  return (
    <div className="relative min-h-[80vh] flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="relative z-10 w-full max-w-xl text-center space-y-6">
        <span className="eyebrow block mx-auto text-signal">SYSTEM FAULT</span>
        <h1 className="font-serif text-[120px] leading-none text-ink tracking-tighter">
          404
        </h1>
        <h2 className="font-serif text-3xl md:text-4xl text-ink leading-tight">
          Deviation from cleared routing.
        </h2>
        <p className="font-sans text-ink-2 font-light leading-relaxed max-w-md mx-auto">
          The vector you requested is outside our airspace. Please check your coordinates or return to the active flight plan.
        </p>
        <div className="pt-8">
          <Link to="/">
            <Button variant="primary" className="h-[44px] shadow-sm items-center gap-2">
              <ArrowLeft size={16} /> Resume Operations
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
