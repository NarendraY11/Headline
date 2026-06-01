import React, { ErrorInfo, ReactNode } from "react";
import { Button } from "./Atoms";
import { RefreshCw, AlertTriangle } from "lucide-react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by ErrorBoundary:", error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="relative min-h-screen flex flex-col items-center justify-center p-6 bg-bg overflow-hidden font-sans">
          <div className="absolute inset-0 blueprint pointer-events-none opacity-20 z-0" />
          <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
          
          <div className="relative z-10 w-full max-w-md text-center bg-panel border border-rule p-8 rounded-2xl shadow-lg">
            <div className="w-14 h-14 rounded-full bg-signal/10 border border-signal/20 flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="text-signal w-7 h-7" />
            </div>
            
            <h1 className="font-serif text-3xl text-ink mb-3 tracking-tight font-semibold">
              Something went wrong
            </h1>
            
            <p className="font-mono text-[10px] text-muted mb-6 uppercase tracking-widest">
              System Render Collision Detected
            </p>
            
            <p className="font-sans text-muted text-sm leading-relaxed mb-8">
              A rendering layout error occurred in this view. The boundary intercepted the thread safely.
            </p>

            {this.state.error && (
              <div className="bg-bg-2 border border-rule rounded-lg p-3 text-left mb-8 max-h-32 overflow-y-auto no-scrollbar">
                <p className="font-mono text-[10px] text-signal whitespace-pre-wrap break-all">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}
            
            <Button 
              variant="primary" 
              className="w-full h-11 flex items-center justify-center gap-2 shadow-sm font-semibold border-0"
              onClick={this.handleReload}
              id="error-boundary-reload"
            >
              <RefreshCw size={14} className="animate-spin-slow" /> Reload Terminal
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
