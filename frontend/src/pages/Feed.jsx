import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useLocation } from '../context/LocationContext'

export default function Feed() {
  const { district } = useLocation()
  const [reports, setReports] = useState([])
  const [allReports, setAllReports] = useState([]) // Keep full list for calculating similar reports
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterSeverity, setFilterSeverity] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [votes, setVotes] = useState({}) // Store upvotes/downvotes locally for interactive feel

  const loadFeed = async () => {
    try {
      setLoading(true)
      // Fetch recent reports (limit to 100 to calculate correlations)
      const data = await api.getRecentReports(100)
      setAllReports(data)
      
      // Filter by district if selected
      const filtered = district ? data.filter(r => r.district === district) : data
      setReports(filtered)
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadFeed()
    const interval = setInterval(loadFeed, 10000) // Poll every 10s
    return () => clearInterval(interval)
  }, [district])

  // Recalculate filtered reports when search or filters change
  const filteredReports = reports.filter(r => {
    const matchesSeverity = filterSeverity === 'all' || r.severity?.toLowerCase() === filterSeverity.toLowerCase()
    const matchesSearch = searchQuery === '' || 
      r.probable_disease?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.symptoms?.some(s => s.toLowerCase().includes(searchQuery.toLowerCase())) ||
      r.district?.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesSeverity && matchesSearch
  })

  // Handle upvote/downvote click
  const handleVote = (id, type) => {
    setVotes(prev => {
      const current = prev[id] || { status: null, score: 0 }
      let nextStatus = null
      let diff = 0

      if (type === 'up') {
        if (current.status === 'up') {
          nextStatus = null
          diff = -1
        } else {
          nextStatus = 'up'
          diff = current.status === 'down' ? 2 : 1
        }
      } else {
        if (current.status === 'down') {
          nextStatus = null
          diff = 1
        } else {
          nextStatus = 'down'
          diff = current.status === 'up' ? -2 : -1
        }
      }

      return {
        ...prev,
        [id]: { status: nextStatus, score: current.score + diff }
      }
    })
  }

  // Helper to find similar reports count in the dataset
  const getSimilarReportsCount = (report) => {
    return allReports.filter(r => 
      r.probable_disease === report.probable_disease && 
      r.district === report.district && 
      r.anon_id !== report.anon_id
    ).length
  }

  if (loading && reports.length === 0) {
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--text3)' }}>
        <i className="ti ti-loader" style={{ fontSize: 32, display: 'block', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Loading observations feed...</div>
      </div>
    )
  }

  return (
    <div className="animate-in" style={{ display: 'flex', gap: '24px', position: 'relative' }}>
      
      {/* LEFT SIDE: FEED CARDS */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* FILTERS & SEARCH HEADER */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '16px',
          background: 'var(--bg2)',
          border: '1px solid var(--border)',
          padding: '16px 20px',
          borderRadius: '12px',
          flexWrap: 'wrap'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: '280px' }}>
            <div style={{ position: 'relative', width: '100%' }}>
              <i className="ti ti-search" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
              <input
                type="text"
                placeholder="Search diseases, symptoms, or districts..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: '100%',
                  background: 'var(--bg)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)',
                  padding: '8px 12px 8px 36px',
                  borderRadius: '8px',
                  fontSize: '13px',
                  outline: 'none',
                }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Severity:</span>
            {['all', 'severe', 'moderate', 'mild'].map(sev => (
              <button
                key={sev}
                onClick={() => setFilterSeverity(sev)}
                style={{
                  background: filterSeverity === sev ? 'rgba(212, 175, 55, 0.15)' : 'transparent',
                  border: filterSeverity === sev ? '1px solid var(--gold)' : '1px solid var(--border)',
                  color: filterSeverity === sev ? 'var(--gold)' : 'var(--text2)',
                  padding: '5px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px 16px', color: 'var(--red)', fontSize: '13px' }}>
            {error}
          </div>
        )}

        {/* FEED LIST */}
        {filteredReports.length === 0 ? (
          <div style={{
            background: 'var(--bg2)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '48px',
            textAlign: 'center',
            color: 'var(--text3)'
          }}>
            <i className="ti ti-radar" style={{ fontSize: '36px', color: 'var(--gold)', opacity: 0.5, display: 'block', marginBottom: '12px' }} />
            <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text2)' }}>No matching observations found</p>
            <p style={{ fontSize: '12px', marginTop: '4px' }}>Try broadening your search or choosing a different district.</p>
          </div>
        ) : (
          filteredReports.map(r => {
            const voteState = votes[r.anon_id] || { status: null, score: 0 }
            const baseScore = Math.floor((r.trust_score || 0.5) * 100)
            const finalScore = baseScore + voteState.score
            const similarCount = getSimilarReportsCount(r)
            const ts = new Date(r.timestamp)
            const formattedTime = isNaN(ts.getTime())
              ? r.timestamp?.slice(0, 16).replace('T', ' ') + ' UTC'
              : ts.toLocaleString('en-IN', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit', hour12: true,
                  timeZone: 'Asia/Kolkata'
                })

            // Derive a title for the reddit post
            const title = `${r.probable_disease || 'Unspecified anomaly'} pattern flagged in ${r.district}`

            return (
              <div 
                key={r.anon_id} 
                className="glass-card animate-in"
                style={{
                  display: 'flex',
                  padding: '16px 20px',
                  gap: '16px',
                  transition: 'transform 0.2s, box-shadow 0.2s',
                  background: 'var(--card-bg)',
                  border: '1px solid var(--border)',
                  borderRadius: '14px'
                }}
              >
                {/* Reddit Style Vote Column */}
                <div style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '4px',
                  minWidth: '40px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  padding: '8px 4px',
                  borderRadius: '8px',
                  alignSelf: 'flex-start'
                }}>
                  <button 
                    onClick={() => handleVote(r.anon_id, 'up')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: voteState.status === 'up' ? 'var(--gold)' : 'var(--text3)',
                      fontSize: '18px',
                      cursor: 'pointer',
                      transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <i className="ti ti-chevron-up" />
                  </button>
                  <span style={{ 
                    fontSize: '12px', 
                    fontWeight: 700, 
                    color: voteState.status === 'up' ? 'var(--gold)' : voteState.status === 'down' ? 'var(--red)' : 'var(--text2)',
                    fontFamily: 'monospace'
                  }}>
                    {finalScore}
                  </span>
                  <button 
                    onClick={() => handleVote(r.anon_id, 'down')}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: voteState.status === 'down' ? 'var(--red)' : 'var(--text3)',
                      fontSize: '18px',
                      cursor: 'pointer',
                      transition: 'transform 0.1s'
                    }}
                    onMouseDown={e => e.currentTarget.style.transform = 'scale(0.85)'}
                    onMouseUp={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                    <i className="ti ti-chevron-down" />
                  </button>
                </div>

                {/* Card Main Body */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {/* Meta header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text3)' }}>
                    <span style={{
                      background: 'var(--bg3)',
                      border: '1px solid var(--border)',
                      padding: '2px 8px',
                      borderRadius: '12px',
                      fontWeight: 600,
                      color: 'var(--gold2)'
                    }}>
                      anon-{r.anon_id?.slice(0, 5).toLowerCase()}
                    </span>
                    <span>•</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <i className="ti ti-map-pin" /> {r.district}, {r.state || 'India'}
                    </span>
                    <span>•</span>
                    <span>{formattedTime}</span>
                  </div>

                  {/* Title */}
                  <h3 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text)', margin: 0, letterSpacing: '-0.3px', lineHeight: 1.3 }}>
                    {title}
                  </h3>

                  {/* Symptoms Badges */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '4px 0' }}>
                    {r.symptoms?.map(sym => (
                      <span key={sym} style={{
                        background: 'rgba(255, 255, 255, 0.04)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        color: 'var(--text2)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--gold)' }} />
                        {sym.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Severity & Duration details */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '12px', color: 'var(--text2)', background: 'var(--bg2)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text3)' }}>Severity:</span>
                      <span style={{
                        fontWeight: 700,
                        color: r.severity?.toLowerCase() === 'severe' ? 'var(--red)' : r.severity?.toLowerCase() === 'moderate' ? 'var(--amber)' : 'var(--gold)'
                      }}>
                        {r.severity || 'moderate'}
                      </span>
                    </div>
                    <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text3)' }}>Duration:</span>
                      <span style={{ fontWeight: 600 }}>{r.duration || 'unknown'}</span>
                    </div>
                    <div style={{ width: '1px', height: '12px', background: 'var(--border)' }} />
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: 'var(--text3)' }}>Trust Index:</span>
                      <span style={{ fontWeight: 600, color: 'var(--gold)' }}>{(r.trust_score * 100).toFixed(0)}%</span>
                    </div>
                  </div>

                  {/* Confidence Gauge */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', margin: '4px 0' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
                      <span style={{ color: 'var(--text3)' }}>AI Outbreak Convergence Confidence</span>
                      <span style={{ fontWeight: 700, color: 'var(--gold)' }}>{(r.trust_score * 100).toFixed(1)}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'var(--bg3)', borderRadius: '3px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.05)' }}>
                      <div style={{
                        height: '100%',
                        background: 'linear-gradient(90deg, var(--gold3) 0%, var(--gold) 100%)',
                        width: `${(r.trust_score || 0.5) * 100}%`
                      }} />
                    </div>
                  </div>

                  {/* Footer Row */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px', borderTop: '1px solid rgba(212, 175, 55, 0.08)', paddingTop: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--gold2)', fontWeight: 600 }}>
                      <i className="ti ti-git-branch" />
                      <span>{similarCount > 0 ? `${similarCount} similar reports in ${r.district}` : `First flagged observation of this profile`}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <button 
                        onClick={() => alert(`Observational profile details:\nReport ID: ${r.anon_id}\nCoordinates: ${r.lat}, ${r.lon}\nH3 Cell: ${r.h3_hex}`)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--text3)',
                          fontSize: '11px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        <i className="ti ti-info-circle" /> Detail Metadata
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            )
          })
        )}
      </div>

      {/* RIGHT SIDE: FEED STATS SIDEBAR (Sticky) */}
      <div style={{
        width: '320px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        position: 'sticky',
        top: '96px',
        height: 'fit-content'
      }}>
        
        {/* NETWORK HEURISTIC STATS */}
        <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h4 style={{ margin: 0, color: 'var(--gold)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px' }}>
            District Intelligence
          </h4>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Target District:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>{district || 'All Districts'}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Active Observations:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)' }}>{filteredReports.length}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '12px', color: 'var(--text3)' }}>Confidence Threshold:</span>
              <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--red)' }}>80.0% alert limit</span>
            </div>
          </div>

          <div style={{
            background: 'rgba(212, 175, 55, 0.03)',
            border: '1px solid rgba(212, 175, 55, 0.1)',
            padding: '12px',
            borderRadius: '8px',
            fontSize: '11px',
            color: 'var(--text3)',
            lineHeight: 1.4
          }}>
            <strong style={{ color: 'var(--gold2)', display: 'block', marginBottom: '4px' }}>🛡 Validation Layer</strong>
            This is a decentralized reporting feed. Submissions are processed in real-time by the FastAPI confidence engine to compute threat escalation levels.
          </div>
        </div>

        {/* TOP PATHOGENS/SYMPTOMS CARD */}
        <div className="glass-card" style={{ padding: '20px' }}>
          <h4 style={{ margin: 0, color: 'var(--gold)', fontSize: '13px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', borderBottom: '1px solid var(--border)', paddingBottom: '10px', marginBottom: '16px' }}>
            Emerging Pathogens
          </h4>

          {filteredReports.length === 0 ? (
            <div style={{ fontSize: '12px', color: 'var(--text3)', textAlign: 'center', padding: '16px 0' }}>
              No active reports in this context.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {Object.entries(
                filteredReports.reduce((acc, curr) => {
                  const disease = curr.probable_disease || 'Unknown'
                  acc[disease] = (acc[disease] || 0) + 1
                  return acc
                }, {})
              )
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([name, count]) => {
                  const percentage = ((count / filteredReports.length) * 100).toFixed(0)
                  return (
                    <div key={name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text2)' }}>{name}</span>
                        <span style={{ color: 'var(--gold)', fontWeight: 700 }}>{count} ({percentage}%)</span>
                      </div>
                      <div style={{ height: '3px', background: 'var(--bg3)', borderRadius: '1.5px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--gold)', width: `${percentage}%` }} />
                      </div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>

      </div>

    </div>
  )
}
