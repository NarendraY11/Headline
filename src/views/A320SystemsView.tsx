import { MoveRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button, Wordmark } from '../components/Atoms';
import { FlightControlsDiagram } from '../components/SystemDiagram';
import { useAuth } from '../contexts/AuthContext';

export default function A320SystemsView() {
  const { openAuthModal } = useAuth();
  
  return (
    <div className="min-h-screen relative flex items-stretch flex-col bg-bg font-sans overflow-x-hidden pt-[72px]">
      <header className="h-[72px] flex items-center justify-between px-6 lg:px-10 bg-bg z-50 absolute top-0 w-full left-0 right-0 border-b border-rule/50">
        <Link to="/" className="hover:opacity-90 transition-opacity flex items-center gap-3">
          <Wordmark compassSize={24} />
          <span className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase border border-rule px-1.5 py-0.5 rounded-[4px] mt-0.5 opacity-80">FL · 380</span>
        </Link>
        <div className="hidden lg:flex items-center gap-8 font-sans text-[13px] tracking-wide text-ink-2">
          <Link to="/modules" className="hover:text-ink transition-colors px-2 py-2">Question bank</Link>
          <Link to="/mock-exams" className="hover:text-ink transition-colors px-2 py-2">Mock exams</Link>
          <Link to="/a320-systems" className="hover:text-ink text-ink transition-colors px-2 py-2 font-medium">A320 systems</Link>
          <Link to="/modules" className="hover:text-ink transition-colors px-2 py-2">VIVA</Link>
          <Link to="/pricing" className="hover:text-ink transition-colors px-2 py-2">Pricing</Link>
        </div>
        <div className="flex items-center gap-6">
            <button onClick={() => openAuthModal("signin")} className="text-[13px] font-sans font-medium text-ink hover:text-ink-2 transition-colors hidden sm:block cursor-pointer">Sign in</button>
            <Button onClick={() => openAuthModal("signup")} variant="primary" className="h-[38px] px-5 text-[13px] font-sans font-medium rounded-full bg-ink text-bg border-0 hover:bg-ink-2">Start studying <MoveRight size={14} className="ml-1.5" /></Button>
        </div>
      </header>
      
      <main className="flex-1 max-w-[1400px] mx-auto w-full px-6 py-20 md:py-32">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center mb-24">
          <div>
            <div className="font-mono text-[10px] text-muted-2 tracking-[0.2em] uppercase mb-6 flex items-center gap-2.5">
              <span className="w-1.5 h-1.5 rounded-sm bg-signal transform rotate-45" />
              <span>ATA 21–80 · SYSTEMS</span>
            </div>
            <h1 className="font-serif text-[48px] lg:text-[72px] leading-[0.95] tracking-tight text-ink mb-8">
              Interactive <br/>A320 Schematics.
            </h1>
            <p className="font-sans text-[18px] lg:text-[22px] font-light text-ink-2 leading-relaxed mb-10">
              Stop memorizing static PDFs. Explore dynamic ECAM logic simulation, detailed ATA chapter breakdowns, and cockpit-grade schematics engineered for Type Rating candidates.
            </p>
            <Button onClick={() => openAuthModal("signup")} variant="primary" className="h-[56px] min-h-[56px] px-8 text-[16px] font-medium shadow-lg rounded-full bg-ink text-bg hover:bg-ink-2 transition-colors">
              Access the Module <MoveRight size={16} className="ml-2" />
            </Button>
          </div>
          <div className="bg-paper border border-rule rounded-[24px] p-8 md:p-12 shadow-sm min-h-[400px] flex items-center justify-center relative blueprint overflow-hidden">
            <div className="absolute inset-0 bg-bg opacity-30 pointer-events-none mix-blend-overlay"></div>
            <FlightControlsDiagram />
          </div>
        </div>
      </main>
      
      <footer className="w-full max-w-[1400px] mx-auto px-6 py-8 border-t border-rule font-serif text-sm text-muted-2 text-center mt-auto">
        <p>&copy; {new Date().getFullYear()} Heading Simulator.</p>
      </footer>
    </div>
  );
}
