/* ============================================================
   THRONE CAMPAIGN — Configuration
   
   This file contains the public Supabase credentials.
   These are SAFE to be in a public repo — they're designed
   to be exposed. The actual security comes from Row Level
   Security (RLS) policies in the database.
   
   The anon key can ONLY do what RLS policies allow.
   ============================================================ */

window.THRONE_CONFIG = {
  // Supabase (public anon key — safe to expose)
  SUPABASE_URL: 'https://kfrfzbnzusqdszrslqef.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmcmZ6Ym56dXNxZHN6cnNscWVmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyODczMzEsImV4cCI6MjA5Mzg2MzMzMX0.yWPhvnc2AiSprKO01_OyP68p4U-GS2WvUTFYcXv_JaM',
  
  // Tribute platform URLs — UPDATE THESE before launch
  PLATFORMS: {
    loyalfans: '#',  // e.g. 'https://www.loyalfans.com/sophiatruee'
    throne:    '#',  // e.g. 'https://throne.com/sophiatruee'
    iwc:       '#',  // e.g. 'https://iwantclips.com/store/sophiatruee'
    c4s:       '#',  // e.g. 'https://www.clips4sale.com/studio/XXXXX'
    tipfunder: '#',  // e.g. 'https://tipfunder.com/sophiatruee'
  },
  
  // Campaign meta
  CAMPAIGN_START: '2026-05-11',
  CAMPAIGN_END:   '2026-06-11',
  MIN_TRIBUTE_GBP: 10,
};
