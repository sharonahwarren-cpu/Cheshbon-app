
import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbgmgfhjdrputegihipr.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZiZ21nZmhqZHJwdXRlZ2loaXByIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzY5NTk3NzAsImV4cCI6MjA1MjUzNTc3MH0.Zy5xQzBxQzBxQzBxQzBxQzBxQzBxQzBxQzBxQzBxQzA'; // This is a placeholder - you need to get the real anon key from Supabase dashboard

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native/Expo
  },
});
