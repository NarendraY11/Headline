import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/track';

export interface UserData {
  attempts: any;
  bookmarks: string[]; 
  targetExam: string;
  nextExam?: string;
  photoURL?: string;
  totalQuestionsAnswered?: number;
  totalSessionsCount?: number;
  lastSessionAt?: any;
  settings?: {
    negativeMarking: boolean;
    reduceMotion: boolean;
    defaultMode: string;
    practiceLayout?: 'auto' | 'editorial' | 'split';
    timedLayout?: 'auto' | 'instrument' | 'editorial';
    vivaLayout?: 'auto' | 'flashcard' | 'editorial';
  };
}

export interface CompatUser {
  uid: string;
  id: string; // for maximum compatibility
  email?: string;
  displayName?: string;
  photoURL?: string;
  getIdToken: () => Promise<string>;
}

interface AuthContextType {
  user: CompatUser | null;
  userData: UserData | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserData: (data: Partial<UserData>) => Promise<void>;
  resetAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

function mapSupabaseUser(sbUser: any, session: any): CompatUser {
  return {
    uid: sbUser.id,
    id: sbUser.id,
    email: sbUser.email,
    displayName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.display_name || sbUser.email?.split('@')[0] || 'Aviation Pilot',
    photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.photoURL || '',
    getIdToken: async () => {
      return session?.access_token || '';
    }
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<CompatUser | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string, mappedUser: any) => {
    try {
      // 1. Fetch profile
      let { data: profile, error: profileErr } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      // If profile doesn't exist, try to set up an initial record (equivalent to Firebase setDoc with merge)
      if (profileErr || !profile) {
        // Track the first signup event
        trackEvent("signup");
        
        const initialProfile = {
          id: uid,
          email: mappedUser.email,
          display_name: mappedUser.displayName || '',
          target_exam: 'DGCA CPL',
          settings: { negativeMarking: false, reduceMotion: false, defaultMode: "practice" }
        };
        const { data: insertedProfile } = await supabase
          .from('profiles')
          .upsert(initialProfile)
          .select()
          .maybeSingle();
        
        profile = insertedProfile || initialProfile;
      }

      const uData: UserData = {
        targetExam: profile?.target_exam || "DGCA CPL",
        nextExam: profile?.next_exam || "",
        settings: profile?.settings || { negativeMarking: false, reduceMotion: false, defaultMode: "practice" },
        bookmarks: [],
        attempts: {},
        photoURL: mappedUser.photoURL || ""
      };

      // 2. Fetch bookmarks
      const { data: bookmarksData, error: bookmarksErr } = await supabase
        .from('bookmarks')
        .select('question_id')
        .eq('user_id', uid);
      
      if (!bookmarksErr && bookmarksData) {
        uData.bookmarks = bookmarksData.map(b => b.question_id);
      }

      // 3. Fetch attempts
      const { data: attemptsData, error: attemptsErr } = await supabase
        .from('attempts')
        .select('*')
        .eq('user_id', uid);

      if (!attemptsErr && attemptsData) {
        attemptsData.forEach(item => {
          uData.attempts[`heading_quiz_state_${item.topic_id}`] = item.data;
        });

        // Compute auxiliary metrics on the fly
        uData.totalSessionsCount = attemptsData.length;
        uData.totalQuestionsAnswered = attemptsData.reduce((sum, item) => sum + (item.data?.total || 0), 0);
        if (attemptsData.length > 0) {
          const sorted = [...attemptsData].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
          uData.lastSessionAt = sorted[0].created_at;
        }
      }

      setUserData(uData);

      // Save to localStorage to keep local preferences in sync
      if (uData.bookmarks) localStorage.setItem("heading_bookmarks", JSON.stringify(uData.bookmarks));
      if (uData.settings) localStorage.setItem("heading_settings", JSON.stringify(uData.settings));
    } catch (e) {
      console.error("Error loading Supabase user details:", e);
    }
  };

  const syncWithServerAndMerge = async (uid: string) => {
    // Collect local storage bookmarks
    const localBookmarksStr = localStorage.getItem("heading_bookmarks");
    let localBookmarks = [];
    try { if (localBookmarksStr) localBookmarks = JSON.parse(localBookmarksStr); } catch {}

    // Collect local storage logbook
    const localLogbookStr = localStorage.getItem("heading_logbook");
    let localLogbook: any[] = [];
    try { if (localLogbookStr) localLogbook = JSON.parse(localLogbookStr); } catch {}

    const localSettingsStr = localStorage.getItem("heading_settings");
    let localSettings = { negativeMarking: false, reduceMotion: false, defaultMode: "practice" };
    try { if (localSettingsStr) localSettings = JSON.parse(localSettingsStr); } catch {}

    // Find local active attempts
    const localAttempts: Record<string, any> = {};
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('heading_quiz_state_')) {
            try {
                localAttempts[key] = JSON.parse(localStorage.getItem(key) || '{}');
            } catch {}
        }
    }

    try {
      // 1. Get current Profile
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();

      let bookmarksToSave: string[] = [];
      let settingsToSave = localSettings;
      let nextExamToSave = localStorage.getItem("heading_next_exam") || "";

      // Format local bookmarks
      for (const lb of localBookmarks) {
         if (typeof lb === 'string') bookmarksToSave.push(lb);
         else if (lb && lb.id) bookmarksToSave.push(lb.id);
      }

      if (profile) {
         const { data: existingBookmarks } = await supabase
           .from('bookmarks')
           .select('question_id')
           .eq('user_id', uid);
         
         const serverBookmarks = existingBookmarks?.map(b => b.question_id) || [];
         const serverSettings = profile.settings;
         
         if (serverSettings) {
           settingsToSave = { ...localSettings, ...serverSettings };
         }
         
         if (!nextExamToSave && profile.next_exam) {
           nextExamToSave = profile.next_exam;
         }

         const mergedBookmarks = [...serverBookmarks];
         for (const lbId of bookmarksToSave) {
             if (!mergedBookmarks.includes(lbId)) {
                mergedBookmarks.push(lbId);
             }
         }
         bookmarksToSave = mergedBookmarks;
      }

      // 2. Upsert profile
      await supabase.from('profiles').upsert({
        id: uid,
        target_exam: profile?.target_exam || "DGCA CPL",
        next_exam: nextExamToSave,
        settings: settingsToSave,
        updated_at: new Date().toISOString()
      });

      // 3. Save bookmarks
      if (bookmarksToSave.length > 0) {
        await supabase.from('bookmarks').delete().eq('user_id', uid);
        const rows = bookmarksToSave.map(qid => ({
          user_id: uid,
          question_id: qid
        }));
        await supabase.from('bookmarks').insert(rows);
      }

      // 4. Save historic logbook entries
      for (const item of localLogbook) {
          if (!item.id) continue;
          await supabase.from('attempts').insert({
            user_id: uid,
            topic_id: item.id,
            mode: item.mode || 'practice',
            score: item.score || 0,
            total: item.total || 0,
            percentage: item.percentage || 0,
            duration_sec: item.durationSec || 0,
            wrong_question_ids: item.wrongQuestionIds || [],
            data: item
          });
      }

      // 5. Save local state attempts
      for (const [key, value] of Object.entries(localAttempts)) {
        const topicId = key.replace('heading_quiz_state_', '');
        const { data: existing } = await supabase
          .from('attempts')
          .select('id')
          .eq('user_id', uid)
          .eq('topic_id', topicId)
          .maybeSingle();

        const payload = {
          user_id: uid,
          topic_id: topicId,
          mode: value?.mode || 'practice',
          score: value?.score || 0,
          total: value?.total || 0,
          percentage: value?.percentage || 0,
          duration_sec: value?.durationSec || 0,
          wrong_question_ids: value?.wrongQuestionIds || [],
          data: value
        };

        if (existing?.id) {
          await supabase.from('attempts').update(payload).eq('id', existing.id);
        } else {
          await supabase.from('attempts').insert(payload);
        }
      }

      // 6. Housekeeping - clear synced keys from LocalStorage
      if (localLogbook.length > 0) {
          localStorage.removeItem('heading_logbook');
      }
      if (localBookmarks.length > 0) {
          localStorage.removeItem('heading_bookmarks');
      }
      if (localStorage.getItem("heading_next_exam")) {
          localStorage.removeItem('heading_next_exam');
      }
      for (const key of Object.keys(localAttempts)) {
        localStorage.removeItem(key);
      }

    } catch (e) {
      console.error("Error migrating anonymous local storage progress:", e);
    }
  };

  useEffect(() => {
    let active = true;

    // Check currently active session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!active) return;
      if (session?.user) {
        const mappedUser = mapSupabaseUser(session.user, session);
        setUser(mappedUser);
        fetchUserData(mappedUser.uid, mappedUser);
      } else {
        setUser(null);
        setUserData(null);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      const currentUser = session?.user || null;
      if (currentUser) {
        const mappedUser = mapSupabaseUser(currentUser, session);
        setUser(mappedUser);
        
        // Execute sync/merge transition
        await syncWithServerAndMerge(mappedUser.uid);
        
        // Retrieve profile details
        await fetchUserData(mappedUser.uid, mappedUser);
      } else {
        setUser(null);
        setUserData(null);
      }
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin
      }
    });
    if (error) throw error;
  };

  const logout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setUser(null);
    setUserData(null);
  };

  const updateUserData = async (data: Partial<UserData>) => {
    if (!user) return;
    try {
        const updatePayload: any = { updated_at: new Date().toISOString() };
        if (data.targetExam !== undefined) updatePayload.target_exam = data.targetExam;
        if (data.nextExam !== undefined) updatePayload.next_exam = data.nextExam;
        if (data.settings !== undefined) {
            updatePayload.settings = data.settings;
            localStorage.setItem("heading_settings", JSON.stringify(data.settings));
        }

        if (Object.keys(updatePayload).length > 1) {
            await supabase.from('profiles').update(updatePayload).eq('id', user.uid);
        }

        if (data.bookmarks !== undefined) {
            await supabase.from('bookmarks').delete().eq('user_id', user.uid);
            if (data.bookmarks.length > 0) {
              const rows = data.bookmarks.map(qid => ({
                user_id: user.uid,
                question_id: qid
              }));
              await supabase.from('bookmarks').insert(rows);
            }
            localStorage.setItem("heading_bookmarks", JSON.stringify(data.bookmarks));
        }

        if (data.photoURL !== undefined) {
          // Sync photo to metadata
          await supabase.auth.updateUser({
            data: { avatar_url: data.photoURL, photoURL: data.photoURL }
          });
        }

        if (data.attempts) {
           for (const [key, value] of Object.entries(data.attempts)) {
              if (key.startsWith('heading_quiz_state_')) {
                const topicId = key.replace('heading_quiz_state_', '');
                const attemptVal = value as any;

                const { data: existing } = await supabase
                  .from('attempts')
                  .select('id')
                  .eq('user_id', user.uid)
                  .eq('topic_id', topicId)
                  .maybeSingle();

                const payload = {
                  user_id: user.uid,
                  topic_id: topicId,
                  mode: attemptVal?.mode || 'practice',
                  score: attemptVal?.score || 0,
                  total: attemptVal?.total || 0,
                  percentage: attemptVal?.percentage || 0,
                  duration_sec: attemptVal?.durationSec || 0,
                  wrong_question_ids: attemptVal?.wrongQuestionIds || [],
                  data: attemptVal
                };

                if (existing?.id) {
                  await supabase.from('attempts').update(payload).eq('id', existing.id);
                } else {
                  await supabase.from('attempts').insert(payload);
                }
              }
           }
        }
        
        await fetchUserData(user.uid, user);
    } catch (e) {
      console.error("Error saving user settings payload inside Supabase:", e);
    }
  };

  const resetAccount = async () => {
      if (!user) return;
      try {
        await supabase.from('attempts').delete().eq('user_id', user.uid);
        await supabase.from('bookmarks').delete().eq('user_id', user.uid);

        localStorage.removeItem("heading_bookmarks");
        localStorage.removeItem("heading_logbook");
        const keysToRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key?.startsWith('heading_quiz_state_')) {
                keysToRemove.push(key);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        await fetchUserData(user.uid, user);
      } catch (e) {
         console.error("Error resetting Supabase user credentials:", e);
      }
  };

  return (
    <AuthContext.Provider value={{ user, userData, loading, signInWithGoogle, logout, updateUserData, resetAccount }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
};
