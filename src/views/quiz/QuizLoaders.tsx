import { Button, CompassLogomark } from "../../components/Atoms";

interface QuizLoadingProps {
  isVivaRoute: boolean;
  mode: string;
}

export function QuizLoading({ isVivaRoute, mode }: QuizLoadingProps) {
  if (isVivaRoute || mode === "viva") {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center p-4 bg-bg">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
        <div className="relative z-10 flex flex-col items-center justify-center space-y-6 max-w-md text-center p-8 bg-paper/60 backdrop-blur border border-rule rounded-2xl shadow-xl">
          <div className="p-4 rounded-full bg-sky-soft/40 border border-sky/20 flex items-center justify-center">
            <CompassLogomark size={48} spin="rotate" spinDuration={3} />
          </div>
          <div>
            <h2 className="font-serif text-2xl text-ink font-bold tracking-tight">
              Initializing Oral Board
            </h2>
            <p className="font-sans text-xs text-muted mt-2 leading-relaxed">
              Loading VIVA oral questions, references, and calibrating your voice practice board. Please stand by...
            </p>
          </div>
          <div className="flex gap-1.5 justify-center items-center">
            <span className="w-2.5 h-2.5 rounded-full bg-sky animate-bounce [animation-delay:-0.3s]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky/80 animate-bounce [animation-delay:-0.15s]"></span>
            <span className="w-2.5 h-2.5 rounded-full bg-sky/60 animate-bounce"></span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="absolute inset-0 paper-grain pointer-events-none opacity-100 z-1" />
      <div className="relative z-10 px-4 py-8 md:py-16 max-w-4xl mx-auto space-y-8 animate-pulse">
        {/* Progress indicators */}
        <div className="flex justify-between items-center bg-paper border border-rule/50 rounded-xl p-3">
          <div className="h-4 bg-ink/10 w-24 rounded"></div>
          <div className="h-4 bg-muted-2/20 w-16 rounded font-mono"></div>
        </div>
        
        {/* Main question skeleton card */}
        <div className="bg-paper border border-rule/50 rounded-2xl p-6 md:p-8 space-y-6">
          <div className="space-y-3">
            <div className="h-4 bg-muted-2/25 w-24 rounded font-mono"></div>
            <div className="h-6 bg-ink/10 w-full rounded"></div>
            <div className="h-6 bg-ink/10 w-4/5 rounded pb-2"></div>
          </div>
          
          <hr className="border-t border-rule/40" />

          {/* Answer option button skeletons */}
          <div className="space-y-3 pt-2">
            {[1, 2, 3, 4].map((idx) => (
              <div key={idx} className="h-12 border border-rule/40 bg-bg-2/5 rounded-xl flex items-center px-4">
                <div className="w-5 h-5 rounded-full bg-ink/5 mr-3 shrink-0"></div>
                <div className="h-4 bg-ink/10 w-5/6 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface QuizNoQuestionsProps {
  isVivaRoute: boolean;
  topicId?: string;
  navigate: any;
}

export function QuizNoQuestions({
  isVivaRoute,
  topicId,
  navigate,
}: QuizNoQuestionsProps) {
  if (topicId?.startsWith("ai-generated-")) {
    return (
      <div className="relative min-h-screen flex items-center justify-center p-4">
        <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
        <div className="relative z-10 text-center">
          <h2 className="font-serif text-3xl text-ink">AI Session Expired</h2>
          <p className="font-sans text-muted mb-8 mt-2">
            Return to the topic module to regenerate practice questions.
          </p>
          <Button variant="ghost" onClick={() => navigate(-1)}>
            ← Back to Topic
          </Button>
        </div>
      </div>
    );
  }
  return (
    <div className="relative min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 blueprint pointer-events-none opacity-40 z-0" />
      <div className="relative z-10 text-center">
        <h2 className="font-serif text-3xl text-ink">
          {isVivaRoute ? "No VIVA questions available yet" : "No Questions Found"}
        </h2>
        <p className="font-sans text-muted mb-8 mt-2">
          {isVivaRoute 
            ? "We are currently preparing more oral board questions. Please check back soon!"
            : "There are no operational limits specified for this module yet."}
        </p>
        <Button variant="primary" onClick={() => navigate("/modules")}>
          Return to Base
        </Button>
      </div>
    </div>
  );
}
