import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useLocation } from '../context/LocationContext'

export default function Intelligence() {
  const { district } = useLocation()
  const [signals, setSignals] = useState([])
  const [groundTruth, setGroundTruth] = useState([])
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedProfile, setSelectedProfile] = useState(null)

  const loadData = async () => {
    try {
      setLoading(true)
      const [sigs, gt, profs] = await Promise.all([
        api.getSignals(district),
        api.getGroundTruth(district),
        api.getDiseaseProfiles()
      ])
      setSignals(sigs)
      setGroundTruth(gt?.idsp_records || [])
      setProfiles(profs || [])
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [district])

  if (loading) {
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--text3)' }}>
        <i className="ti ti-loader" style={{ fontSize: 32, display: 'block', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Analyzing epidemiologic signals...</div>
      </div>
    )
  }

  // Calculate statistics for the narrative briefing
  const activeSigs = signals.filter(s => s.confidence >= 40)
  const strongSigs = signals.filter(s => s.confidence >= 80)
  const maxConfidence = signals.length ? Math.max(...signals.map(s => s.confidence)) : 0
  
  // Calculate total cases from IDSP records
  const confirmedIDSPCases = groundTruth.reduce((sum, r) => sum + (r.confirmed_cases || 0), 0)
  const suspectedIDSPCases = groundTruth.reduce((sum, r) => sum + (r.suspected_cases || 0), 0)
  const totalDeaths = groundTruth.reduce((sum, r) => sum + (r.deaths || 0), 0)

  // Determine threat assessment level
  let threatLevel = 'Guarded'
  let threatColor = 'var(--gold)'
  if (maxConfidence >= 80 || totalDeaths > 0) {
    threatLevel = 'Critical'
    threatColor = 'var(--red)'
  } else if (maxConfidence >= 50 || confirmedIDSPCases > 20) {
    threatLevel = 'Elevated'
    threatColor = 'var(--amber)'
  } else if (maxConfidence > 0) {
    threatLevel = 'Moderate'
    threatColor = 'var(--gold2)'
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.7px', lineHeight: 1.1 }}>
            Epidemiological Intelligence Briefing
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '5px' }}>
            Automated correlation of anonymous user signals and WHO/IDSP ground truth registries
          </p>
        </div>
        <button 
          onClick={loadData} 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            padding: '8px 16px', 
            borderRadius: '20px', 
            fontSize: '12px', 
            fontWeight: 600, 
            background: 'var(--bg2)', 
            color: 'var(--text2)', 
            border: '1px solid var(--border)', 
            cursor: 'pointer' 
          }}
        >
          <i className="ti ti-refresh" /> Force Revalidate
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px 16px', color: 'var(--red)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* TOP BLOCK: BRIEFING SUMMARY */}
      <div className="glass-card" style={{
        background: 'linear-gradient(135deg, rgba(10, 14, 23, 0.9) 0%, rgba(212, 175, 55, 0.03) 100%)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: threatColor,
              boxShadow: `0 0 12px ${threatColor}`,
              display: 'inline-block'
            }} />
            <span style={{ fontSize: '14px', fontWeight: 800, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '1px' }}>
              Threat Assessment: <span style={{ color: threatColor }}>{threatLevel}</span>
            </span>
          </div>
          
          <div style={{ fontSize: '12px', color: 'var(--text3)', fontFamily: 'monospace' }}>
            GEO-TARGET: {district ? district.toUpperCase() : 'ALL DISTRICTS'}
          </div>
        </div>

        <p style={{ fontSize: '14px', color: 'var(--text2)', lineHeight: '1.6', margin: 0 }}>
          Sentinel AI's neural parser has aggregated and cross-referenced <strong>{signals.length}</strong> disease signals and 
          {' '}<strong>{groundTruth.length}</strong> official IDSP records for <strong>{district || 'India'}</strong>. 
          {activeSigs.length > 0 ? (
            <span> 
              There are currently <strong style={{ color: 'var(--gold)' }}>{activeSigs.length}</strong> anomalies exhibiting converging signs of transmission with a confidence above 40%. 
              {strongSigs.length > 0 && ` Critical warning issued for ${strongSigs.map(s => s.name.split(' · ')[0]).join(', ')}.`}
            </span>
          ) : (
            <span> Currently, no major emerging transmission patterns have surpassed the noise thresholds.</span>
          )}
          {confirmedIDSPCases > 0 && (
            <span> Ground truth registries confirm <strong>{confirmedIDSPCases}</strong> active hospitalizations / cases of priority pathogens in this zone.</span>
          )}
        </p>

        {/* Narrative Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginTop: '8px' }}>
          <div style={{ background: 'var(--bg2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>MAX SIGNAL STRENGTH</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--gold)', marginTop: '4px' }}>{maxConfidence.toFixed(1)}%</div>
          </div>
          <div style={{ background: 'var(--bg2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>CONFIRMED PATHOGENS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', marginTop: '4px' }}>{confirmedIDSPCases}</div>
          </div>
          <div style={{ background: 'var(--bg2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>SUSPECTED PATHOGENS</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text2)', marginTop: '4px' }}>{suspectedIDSPCases}</div>
          </div>
          <div style={{ background: 'var(--bg2)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>FATALITY COUNT</div>
            <div style={{ fontSize: '24px', fontWeight: 800, color: totalDeaths > 0 ? 'var(--red)' : 'var(--text3)', marginTop: '4px' }}>{totalDeaths}</div>
          </div>
        </div>
      </div>

      {/* MIDDLE SECTION: ACTIVE SIGNALS & PATHOGEN PROFILES */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT COLUMN: ACTIVE CONVERGING SIGNALS */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            Active Epidemiological Anomalies
          </h3>

          {signals.length === 0 ? (
            <div className="glass-card" style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>
              No active disease patterns detected for this location.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {signals.map(sig => {
                const confColor = sig.confidence >= 80 ? 'var(--red)' : sig.confidence >= 40 ? 'var(--amber)' : 'var(--text3)'
                return (
                  <div 
                    key={sig.id}
                    className="glass-card"
                    style={{
                      padding: '16px 20px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      background: 'var(--card-bg)',
                      border: '1px solid var(--border)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>
                        {sig.name.split(' · ')[0]}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text3)' }}>
                        Hex: <span style={{ fontFamily: 'monospace' }}>{sig.h3_hex}</span> • Status: <span style={{ fontWeight: 600, color: confColor }}>{sig.status}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '6px' }}>
                        {sig.symptoms.map(sym => (
                          <span key={sym} style={{ background: 'var(--bg3)', border: '1px solid rgba(255, 255, 255, 0.05)', borderRadius: '4px', padding: '2px 6px', fontSize: '10px', color: 'var(--text2)' }}>
                            {sym}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: confColor }}>{sig.confidence.toFixed(1)}%</div>
                      <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>CONFIDENCE</div>
                      <div style={{ fontSize: '11px', color: 'var(--text2)', background: 'var(--bg2)', padding: '2px 8px', borderRadius: '10px', border: '1px solid var(--border)', marginTop: '4px' }}>
                        {sig.report_count} reports
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: DISEASE PROFILES DIRECTORY */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            Pathogen Catalog
          </h3>

          <div className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '4px' }}>
              Select pathogen profile to view transmission rules:
            </span>
            {profiles.map(p => (
              <button
                key={p.disease_name}
                onClick={() => setSelectedProfile(p)}
                style={{
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  color: 'var(--text2)',
                  textAlign: 'left',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  cursor: 'pointer',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  transition: 'all 0.2s'
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = 'var(--gold)'
                  e.currentTarget.style.color = 'var(--text)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.color = 'var(--text2)'
                }}
              >
                <span style={{ fontWeight: 600 }}>{p.disease_name}</span>
                <span style={{
                  background: p.who_priority === 'High' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(212, 175, 55, 0.05)',
                  border: p.who_priority === 'High' ? '1px solid var(--red)' : '1px solid var(--border)',
                  color: p.who_priority === 'High' ? 'var(--red)' : 'var(--text3)',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  fontSize: '9px',
                  fontWeight: 700
                }}>
                  {p.who_priority} Priority
                </span>
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* LOWER SECTION: WHO/IDSP GROUND TRUTH REGISTRY */}
      <div className="glass-card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'var(--bg2)'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
            <i className="ti ti-building-hospital" /> WHO / IDSP Retrospective Registry
          </span>
          <span style={{ fontSize: '11px', color: 'var(--text3)', background: 'var(--bg3)', padding: '3px 10px', borderRadius: '12px', border: '1px solid var(--border)' }}>
            {groundTruth.length} records verified
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          {groundTruth.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text3)' }}>
              No ground truth records registered for this location.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: 'rgba(255, 255, 255, 0.01)', borderBottom: '1px solid var(--border)' }}>
                  {['Pathogen', 'District', 'State', 'Cases (Suspected/Confirmed)', 'Hospitalized', 'Deaths', 'Status', 'Onset Date'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', fontSize: '10px', letterSpacing: '0.5px' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groundTruth.map((r, i) => (
                  <tr 
                    key={r.record_id || i}
                    style={{ borderBottom: '1px solid rgba(212, 175, 55, 0.05)', transition: 'background 0.15s' }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px', fontWeight: 600, color: 'var(--text)' }}>{r.disease}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{r.district}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text3)' }}>{r.state}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)', fontFamily: 'monospace' }}>
                      {r.suspected_cases} / <strong style={{ color: 'var(--gold)' }}>{r.confirmed_cases}</strong>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)', fontFamily: 'monospace' }}>{r.hospitalised || 0}</td>
                    <td style={{ padding: '12px 16px', color: r.deaths > 0 ? 'var(--red)' : 'var(--text3)', fontFamily: 'monospace', fontWeight: r.deaths > 0 ? 700 : 500 }}>
                      {r.deaths || 0}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        background: r.outbreak_status === 'Active' || r.outbreak_status === 'Epidemic' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(255, 255, 255, 0.04)',
                        border: r.outbreak_status === 'Active' || r.outbreak_status === 'Epidemic' ? '1px solid var(--red)' : '1px solid rgba(255, 255, 255, 0.08)',
                        color: r.outbreak_status === 'Active' || r.outbreak_status === 'Epidemic' ? 'var(--red)' : 'var(--text3)',
                        padding: '2px 8px',
                        borderRadius: '10px',
                        fontSize: '10px',
                        fontWeight: 600
                      }}>
                        {r.outbreak_status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text3)', fontFamily: 'monospace' }}>{r.onset_date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div style={{ padding: '12px 20px', borderTop: '1px solid var(--border)', fontSize: '11px', color: 'var(--text3)', background: 'var(--bg2)' }}>
          Registry provided by Integrated Disease Surveillance Programme (IDSP) under Indian Ministry of Health &amp; Family Welfare.
        </div>
      </div>

      {/* DETAILED PATHOGEN MODAL */}
      {selectedProfile && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)',
          zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <div style={{
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: '16px',
            width: '500px',
            maxWidth: '90%',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              background: 'var(--bg2)'
            }}>
              <h3 style={{ color: 'var(--gold)', margin: 0, fontSize: '18px', fontWeight: 800 }}>
                {selectedProfile.disease_name} Profile
              </h3>
              <button 
                onClick={() => setSelectedProfile(null)} 
                style={{ background: 'transparent', border: 'none', color: 'var(--text2)', fontSize: '24px', cursor: 'pointer' }}
              >
                &times;
              </button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>ICD-10 CODE</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{selectedProfile.icd10_code}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>WHO PRIORITY</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{selectedProfile.who_priority}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>INCUBATION PERIOD</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{selectedProfile.incubation_days}</span>
                </div>
                <div>
                  <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>SEASONAL PEAK</span>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{selectedProfile.season_peak}</span>
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', marginBottom: '6px' }}>CORE DIAGNOSTIC SYMPTOMS</span>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {[1, 2, 3, 4, 5].map(i => {
                    const sym = selectedProfile[`symptom_${i}`]
                    if (!sym) return null
                    return (
                      <span key={i} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text2)' }}>
                        {sym.replace(/_/g, ' ')}
                      </span>
                    )
                  })}
                </div>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>TYPICAL SEVERITY</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>{selectedProfile.severity_typical}</span>
              </div>

              <div>
                <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block' }}>ENDEMIC REGIONS</span>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text2)' }}>{selectedProfile.region_endemic}</span>
              </div>

              {selectedProfile.reportable && (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.05)',
                  border: '1px solid rgba(239, 68, 68, 0.15)',
                  padding: '10px 12px',
                  borderRadius: '8px',
                  fontSize: '11px',
                  color: 'var(--red)',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <i className="ti ti-alert-circle" /> Mandatorily reportable to the National Vector Borne Disease Control / WHO.
                </div>
              )}

            </div>
          </div>
        </div>
      )}

    </div>
  )
}
