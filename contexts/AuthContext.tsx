
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { router, useSegments } from 'expo-router';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name?: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const segments = useSegments();

  useEffect(() => {
    console.log('🔄 [SUPABASE AUTH] Initializing auth state...');
    
    // PERFORMANCE FIX: Render UI immediately, check auth in background
    // Set isLoading to false immediately so UI can render
    setIsLoading(false);
    
    let mounted = true;
    
    // Get initial session asynchronously (non-blocking)
    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      if (!mounted) return;
      console.log('🔄 [SUPABASE AUTH] Initial session:', initialSession ? 'YES' : 'NO');
      setSession(initialSession);
      setUser(initialSession?.user || null);
    }).catch((error) => {
      console.error('❌ [SUPABASE AUTH] Error getting session:', error);
    });

    // Listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;
        console.log('🔄 [SUPABASE AUTH] Auth state changed:', event);
        setSession(currentSession);
        setUser(currentSession?.user || null);
      }
    );

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Handle routing based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = 
      segments[0] === 'auth' || 
      segments[0] === 'verify-email' ||
      segments[0] === 'reset-password' ||
      segments[0] === 'forgot-password';

    console.log('🔐 [SUPABASE AUTH] Routing check:', { 
      hasSession: !!session, 
      inAuthGroup, 
      segments 
    });

    if (session && inAuthGroup) {
      // User is logged in but on auth screen, navigate to home
      console.log('🔐 [SUPABASE AUTH] Redirecting to home (logged in)');
      router.replace('/(tabs)/(home)');
    } else if (!session && !inAuthGroup) {
      // User is not logged in and not on auth screen, navigate to auth
      console.log('🔐 [SUPABASE AUTH] Redirecting to auth (not logged in)');
      router.replace('/auth');
    }
  }, [session, isLoading, segments]);

  const signInWithEmail = async (email: string, password: string) => {
    console.log('📧 [SUPABASE AUTH] Signing in with email:', email);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ [SUPABASE AUTH] Sign in error:', error.message);
      throw error;
    }

    console.log('✅ [SUPABASE AUTH] Sign in successful');
    setSession(data.session);
    setUser(data.user);
  };

  const signUpWithEmail = async (email: string, password: string, name?: string) => {
    console.log('📧 [SUPABASE AUTH] Signing up with email:', email);
    
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
        emailRedirectTo: `${window.location.origin}/verify-email`,
      },
    });

    if (error) {
      console.error('❌ [SUPABASE AUTH] Sign up error:', error.message);
      throw error;
    }

    console.log('✅ [SUPABASE AUTH] Sign up successful - check email for verification');
    
    // Note: Supabase may auto-confirm or require email verification depending on settings
    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }
  };

  const signOut = async () => {
    console.log('🚪 [SUPABASE AUTH] Signing out...');
    
    const { error } = await supabase.auth.signOut();
    
    if (error) {
      console.error('❌ [SUPABASE AUTH] Sign out error:', error.message);
      throw error;
    }

    console.log('✅ [SUPABASE AUTH] Signed out');
    setSession(null);
    setUser(null);
    router.replace('/auth');
  };

  const value: AuthContextType = {
    session,
    user,
    isLoading: isLoading,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
