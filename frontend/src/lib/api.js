import { supabase, isMock } from './supabase';

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
    if (isMock) {
      const loc = district || 'New Delhi';
      const pool = ['Nipah Virus', 'Cholera', 'Dengue', 'Malaria', 'Typhoid', 'COVID-19', 'Common Cold', 'Food Poisoning', 'Hepatitis A'];
      
      return Array.from({ length: 5 }).map((_, i) => {
        const disease = pool[Math.floor(Math.random() * pool.length)];
        const confidence = Math.floor(Math.random() * 60) + 30;
        return {
          id: `mock-sig-${i}`,
          name: `${disease} · ${loc}`,
          district: loc,
          confidence,
          status: confidence >= 80 ? 'strong' : confidence >= 50 ? 'emerging' : 'noise',
          report_count: Math.floor(Math.random() * 20) + 1,
          sources: ['user reports', 'trend signals'],
          symptoms: [disease.toLowerCase(), 'fever'],
          created_at: new Date().toISOString(),
          last_updated: new Date().toISOString(),
          h3_hex: '873e80000ffffff'
        };
      });
    }
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
  getHeatmap: async (district = null) => {
    if (isMock) {
      const loc = district || 'New Delhi';
      const pool = ['Nipah Virus', 'Cholera', 'Dengue', 'Malaria', 'Typhoid', 'COVID-19', 'Common Cold', 'Food Poisoning', 'Hepatitis A'];
      
      return Array.from({ length: 8 }).map((_, i) => ({
        hex_id: i % 2 === 0 ? '873e80000ffffff' : '873e80001ffffff',
        district: loc,
        confidence: Math.floor(Math.random() * 80) + 20,
        report_count: Math.floor(Math.random() * 15) + 1,
        dominant_symptom: pool[Math.floor(Math.random() * pool.length)]
      }));
    }
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
    if (isMock) {
      return {
        active_signals: 2, genuine_count: 2, noise_count: 0,
        total_reports_24h: 17, spam_blocked: 0, top_confidence: 85,
        alert_triggered: true, trends_score: 85
      };
    }
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
    if (isMock) {
      const loc = district || 'New Delhi';
      const diseasePool = [
        { name: 'Nipah Virus', symptoms: ['fever', 'headache', 'confusion'], severity: 'severe' },
        { name: 'Cholera', symptoms: ['diarrhea', 'vomiting', 'dehydration'], severity: 'severe' },
        { name: 'Dengue', symptoms: ['fever', 'joint pain', 'rash'], severity: 'severe' },
        { name: 'Malaria', symptoms: ['fever', 'chills', 'sweat'], severity: 'moderate' },
        { name: 'Common Cold', symptoms: ['runny nose', 'sneezing', 'mild cough'], severity: 'mild' },
        { name: 'Food Poisoning', symptoms: ['nausea', 'vomiting', 'cramps'], severity: 'mild' },
        { name: 'Typhoid', symptoms: ['fever', 'stomach pain', 'weakness'], severity: 'moderate' },
        { name: 'COVID-19', symptoms: ['cough', 'fever', 'loss of smell'], severity: 'severe' },
        { name: 'Chikungunya', symptoms: ['fever', 'joint pain', 'fatigue'], severity: 'moderate' },
        { name: 'Hepatitis A', symptoms: ['fatigue', 'jaundice', 'stomach pain'], severity: 'severe' }
      ];
      
      return Array.from({ length: 18 }).map((_, i) => {
        const d = diseasePool[Math.floor(Math.random() * diseasePool.length)];
        return {
          anon_id: `MOCK-${Math.floor(Math.random()*10000)}`, 
          district: loc, 
          state: 'Local State', 
          hex_id: `873e80${Math.floor(Math.random()*1000)}ffffff`, 
          h3_hex: `873e80${Math.floor(Math.random()*1000)}ffffff`, 
          lat: 20 + Math.random() * 5, 
          lon: 75 + Math.random() * 5, 
          symptoms: d.symptoms, 
          timestamp: new Date(Date.now() - Math.random() * 86400000).toISOString(), 
          severity: d.severity, 
          duration: `${Math.floor(Math.random() * 5 + 1)} days`, 
          trust_score: 0.4 + Math.random() * 0.55, 
          probable_disease: d.name
        };
      });
    }
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
    if (isMock) {
      const allMocks = [
        { id: 1, keyword: 'fever symptoms', related_disease: 'Viral', normalized_score: 0.85, district: 'Bhopal' },
        { id: 2, keyword: 'fever symptoms', related_disease: 'Viral', normalized_score: 0.65, district: 'New Delhi' },
        { id: 3, keyword: 'fever symptoms', related_disease: 'Viral', normalized_score: 0.45, district: 'Mumbai' },
        { id: 4, keyword: 'malaria treatment', related_disease: 'Malaria', normalized_score: 0.70, district: 'Mumbai' },
        { id: 5, keyword: 'dengue test near me', related_disease: 'Dengue', normalized_score: 0.90, district: 'Bhopal' },
        { id: 6, keyword: 'dengue test near me', related_disease: 'Dengue', normalized_score: 0.80, district: 'New Delhi' }
      ];
      
      let filtered = allMocks;
      if (district) {
        filtered = allMocks.filter(m => m.district === district);
      }
      
      const avgScore = filtered.length 
        ? Math.round(filtered.reduce((sum, item) => sum + (item.normalized_score * 100), 0) / filtered.length)
        : 50;

      return { 
        trends_score: avgScore, 
        keywords: filtered, 
        geo: district || "India", 
        source: "Mock Data (Connect backend for Live Google Trends)" 
      };
    }
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
    if (isMock) return { idsp_records: [], source: "Mock IDSP Data", coverage: district || "All Districts" };
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
    if (isMock) return [{ name: 'Dengue', current_threat_level: 8, severity: 7 }];
    const { data, error } = await supabase.from('disease_profiles').select('*');
    if (error) throw error;
    return data;
  }
};
