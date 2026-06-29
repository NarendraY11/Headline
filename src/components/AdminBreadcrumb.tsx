import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

interface Crumb {
  label: string;
  to?: string;
}

interface AdminBreadcrumbProps {
  crumbs: Crumb[];
}

export function AdminBreadcrumb({ crumbs }: AdminBreadcrumbProps) {
  return (
    <nav className="flex items-center gap-1.5 font-mono text-[10px] text-muted uppercase tracking-wider mb-6" aria-label="Breadcrumb">
      <Link to="/admin" className="hover:text-ink transition-colors">
        Admin
      </Link>
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          <ChevronRight size={10} className="text-muted-2" />
          {crumb.to && i < crumbs.length - 1 ? (
            <Link to={crumb.to} className="hover:text-ink transition-colors">
              {crumb.label}
            </Link>
          ) : (
            <span className="text-ink font-semibold">{crumb.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
