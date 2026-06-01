import { CheckCircle, Minus, Plus, Settings2 } from 'lucide-react';
import { motion } from 'motion/react';
import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Card } from './Atoms';

export default function DailyStudyGoal() {
  const { userData, updateUserData } = useAuth();
  
  const [goal, setGoal] = useState(() => {
    const saved = localStorage.getItem('dailyStudyGoal');
    return saved ? parseInt(saved, 10) : 50;
  });
  
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    if (userData?.dailyGoal) {
      setGoal(userData.dailyGoal);
    }
  }, [userData?.dailyGoal]);

  const progress = userData?.questionsAnsweredToday || parseInt(localStorage.getItem('heading_questions_answered_today') || '0');

  const saveGoal = (newGoal: number) => {
    setGoal(newGoal);
    localStorage.setItem('dailyStudyGoal', newGoal.toString());
    if (userData) {
      updateUserData({ dailyGoal: newGoal });
    }
  };

  const percentage = Math.min(Math.round((progress / goal) * 100), 100);
  const isComplete = progress >= goal;

  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <Card className="bg-paper border border-rule rounded-[24px] p-8 md:p-12 shadow-sm h-full flex flex-col justify-center relative overflow-hidden group">
      <div className="flex justify-between items-center mb-8 w-full">
        <div className="font-mono text-[9px] text-muted-2 tracking-[0.2em] uppercase">DAILY · TARGET</div>
        <button 
          onClick={() => setIsEditing(!isEditing)}
          className="text-muted opacity-50 group-hover:opacity-100 transition-opacity p-1 rounded-md"
          aria-label="Edit goal"
        >
          <Settings2 size={16} />
        </button>
      </div>

      <h3 className="font-serif text-[32px] text-ink mb-8 tracking-tight">Keep the pace.</h3>

      <div className="flex flex-col items-center justify-center flex-1 py-2 w-full">
        {isEditing ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            <div className="flex items-center gap-4 mb-8">
              <button 
                onClick={() => saveGoal(Math.max(10, goal - 10))}
                className="w-10 h-10 rounded-full bg-bg flex items-center justify-center border border-rule hover:border-navy text-ink transition-colors"
                aria-label="Decrease goal"
              >
                <Minus size={18} />
              </button>
              
              <div className="text-center w-24">
                <span className="font-serif text-5xl text-ink leading-none">{goal}</span>
                <div className="font-sans text-[11px] text-muted-2 mt-2 uppercase tracking-wide">questions</div>
              </div>
              
              <button 
                onClick={() => saveGoal(Math.min(200, goal + 10))}
                className="w-10 h-10 rounded-full bg-bg flex items-center justify-center border border-rule hover:border-navy text-ink transition-colors"
                aria-label="Increase goal"
              >
                <Plus size={18} />
              </button>
            </div>
            
            <button
              onClick={() => setIsEditing(false)}
              className="bg-navy text-paper font-sans text-[13px] font-medium px-8 py-3 rounded-full hover:bg-navy-soft transition-colors w-full uppercase tracking-wider"
            >
              Save Goal
            </button>
          </motion.div>
        ) : (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center relative w-full h-full justify-center"
          >
             <div className="relative w-36 h-36 flex items-center justify-center mb-6">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="72"
                  cy="72"
                  r="40"
                  fill="transparent"
                  stroke="var(--rule)"
                  strokeWidth="8"
                />
                <circle
                  cx="72"
                  cy="72"
                  r="40"
                  fill="transparent"
                  stroke={isComplete ? "var(--mint)" : "var(--navy)"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  strokeDashoffset={strokeDashoffset}
                  className="transition-all duration-700 ease-in-out"
                />
              </svg>
              
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                {isComplete ? (
                    <CheckCircle className="text-mint mb-1" size={28} />
                ) : (
                    <span className="font-serif text-4xl text-ink leading-none">{progress}</span>
                )}
                <span className="font-sans text-[10px] text-muted-2 uppercase tracking-widest mt-2 block w-[50px] text-center border-t border-rule/50 pt-1">
                  {goal}
                </span>
              </div>
            </div>
            
            <div className="w-full border-t border-rule pt-6 mt-auto">
               <p className="font-sans text-[12px] text-ink-2 mb-1 flex items-center justify-between">
                 <span>Daily progress</span>
                 <span className="font-medium text-ink">{percentage}%</span>
               </p>
               <div className="w-full h-1 bg-rule rounded-full overflow-hidden">
                 <div className={`h-full rounded-full transition-all ${isComplete ? 'bg-mint' : 'bg-navy'}`} style={{ width: `${percentage}%` }} />
               </div>
            </div>
          </motion.div>
        )}
      </div>
    </Card>
  );
}
