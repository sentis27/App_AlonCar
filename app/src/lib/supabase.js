import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://rlisvmlqlgvpofoqzvjf.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsaXN2bWxxbGd2cG9mb3F6dmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyNzEyNDAsImV4cCI6MjEwNTg0NzI0MH0.oNsrTXRSc4UofpCPeh7dq1I9T-A8GiToCUxGsPmsagw'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
