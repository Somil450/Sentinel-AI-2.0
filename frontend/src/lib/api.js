import { supabase } from './supabase';

// In dev: Vite proxy forwards /api → localhost:8000
// In prod: VITE_API_BASE points to the Railway backend URL
const BASE = (import.meta.env.VITE_API_BASE || '') + '/api';

async function apiFetch(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail || 'Request failed');
  }
  return res.json();
}

export const api = {
  /** Submit an anonymous report via FastAPI to preserve NLP and logic */
  submitReport: (district, symptoms, freeText = '') =>
    apiFetch('/report', {
      method: 'POST',
      body: JSON.stringify({ district, symptoms, free_text: freeText }),
    }),

  /** Get all signals from Supabase */
  getSignals: async (district = null) => {
    let query = supabase.from('signals_data').select('*');
    if (district) query = query.eq('district', district);
    const { data, error } = await query;
    if (error) throw error;
    // Map to the expected format
    return data.map(s => ({
      id: s.district + s.h3_hex, // composite fake id
      name: s.disease + ' · ' + s.district,
      district: s.district,
      confidence: s.confidence_pct,
      status: s.confidence_pct >= 80 ? 'strong' : s.confidence_pct >= 40 ? 'emerging' : 'noise',
      report_count: Math.round(s.reports_score * 100), // proxy
      sources: ['user reports', 'trend signals'],
      symptoms: [s.disease], // proxy
      created_at: s.date,
      last_updated: s.date,
      h3_hex: s.h3_hex
    }));
  },

  /** Get heatmap data by adapting signals_data */
  getHeatmap: async () => {
    const { data, error } = await supabase.from('signals_data').select('*');
    if (error) throw error;
    return data.map(s => ({
      hex_id: s.h3_hex,
      district: s.district,
      confidence: s.confidence_pct,
      report_count: Math.round(s.reports_score * 100),
      dominant_symptom: s.disease
    }));
  },

  /** Get timeline data for outbreak playback - still handled by backend */
  getTimeline: () => apiFetch('/timeline'),

  /** Get dashboard stats */
  getStats: async () => {
    const { count: reportCount } = await supabase.from('reports_data').select('*', { count: 'exact', head: true });
    const { data: signals } = await supabase.from('signals_data').select('*');
    
    const active_signals = signals?.length || 0;
    const genuine_count = signals?.filter(s => s.confidence_pct >= 20).length || 0;
    const noise_count = active_signals - genuine_count;
    const top_confidence = signals?.reduce((max, s) => Math.max(max, s.confidence_pct), 0) || 0;

    return {
      active_signals,
      genuine_count,
      noise_count,
      total_reports_24h: reportCount || 0,
      spam_blocked: 0,
      top_confidence,
      alert_triggered: top_confidence >= 80,
      trends_score: 85
    };
  },

  /** Get recent anonymous reports from Supabase */
  getRecentReports: async (limit = 20, district = null) => {
    let query = supabase
      .from('reports_data')
      .select('*')
      .order('date', { ascending: false })
      .order('hour', { ascending: false })
      .limit(limit);
      
    if (district) {
       query = query.eq('district', district);
    }
      
    const { data, error } = await query;
    if (error) throw error;
    
    return data.map(r => {
      // hour is stored as "HH:MM" (e.g. "16:00"), so build a proper ISO timestamp
      const hourPart = r.hour || '00:00';
      const isoTimestamp = `${r.date}T${hourPart}:00Z`;
      return {
        anon_id: r.report_id,
        district: r.district,
        state: r.state || 'India',
        hex_id: r.h3_hex,
        h3_hex: r.h3_hex,
        lat: r.lat,
        lon: r.lon,
        symptoms: r.symptom_tags ? r.symptom_tags.split('|') : [],
        timestamp: isoTimestamp,
        severity: r.severity || 'moderate',
        duration: r.duration || '1-3 days',
        trust_score: r.trust_score ?? 0.5,
        probable_disease: r.probable_disease || 'Unknown'
      };
    });
  },

  /** Get 6-hour hex-level outbreak predictions */
  getPredictions: () => apiFetch('/predictions'),

  /** Get overall outbreak trajectory forecast */
  getForecast: () => apiFetch('/forecast'),

  /** Get live Google Trends scores from Supabase */
  getTrends: async (district = null) => {
    let query = supabase.from('trends_data').select('*');
    if (district) {
      query = query.eq('district', district);
    }
    const { data, error } = await query.limit(100);
    if (error) throw error;
    
    // Calculate aggregate score
    const avgScore = data.length 
      ? Math.round(data.reduce((sum, item) => sum + (item.normalized_score * 100), 0) / data.length)
      : 0;

    return {
      trends_score: avgScore || 50,
      keywords: data,
      geo: district || "India",
      source: "Supabase Trends Data"
    };
  },

  /** Get WHO/IDSP ground truth data from Supabase */
  getGroundTruth: async (district = null) => {
    let query = supabase.from('who_idsp_groundtruth').select('*');
    if (district) query = query.eq('district', district);
    const { data, error } = await query;
    if (error) throw error;
    
    return {
      idsp_records: data,
      source: "IDSP via Supabase",
      coverage: district || "All Districts"
    };
  },

  /** Get disease profiles */
  getDiseaseProfiles: async () => {
    const { data, error } = await supabase.from('disease_profiles').select('*');
    if (error) throw error;
    return data;
  }
};
