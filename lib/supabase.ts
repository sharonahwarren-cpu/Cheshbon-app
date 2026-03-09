import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://vbgmgfhjdrputegihipr.supabase.co';
const supabaseAnonKey = 'sb_publishable_g1YY-p0m9M2MhW6Jxh5SIw_OZdPIf_N'; // Updated with your provided key

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native/Expo
  },
});
