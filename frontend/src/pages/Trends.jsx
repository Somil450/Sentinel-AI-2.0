import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { useLocation } from '../context/LocationContext'

export default function Trends() {
  const { district } = useLocation()
  const [trends, setTrends] = useState(null)
  const [allTrends, setAllTrends] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedKeyword, setSelectedKeyword] = useState(null)
  const [comparisonList, setComparisonList] = useState([])

  const loadTrends = async () => {
    try {
      setLoading(true)
      const data = await api.getTrends(district)
      setTrends(data)
      
      // Fetch all trends (no district filter) to allow comparison/geographic breakdowns
      const globalData = await api.getTrends(null)
      setAllTrends(globalData?.keywords || [])

      if (data?.keywords?.length > 0) {
        setSelectedKeyword(data.keywords[0])
      }
      setError(null)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadTrends()
  }, [district])

  if (loading && !trends) {
    return (
      <div style={{ padding: 64, textAlign: 'center', color: 'var(--text3)' }}>
        <i className="ti ti-loader" style={{ fontSize: 32, display: 'block', margin: '0 auto 16px', animation: 'spin 1s linear infinite' }} />
        <div style={{ fontSize: 14, fontWeight: 600 }}>Fetching search volume index...</div>
      </div>
    )
  }

  const keywordList = trends?.keywords || []

  // Geographic distribution of selected keyword
  const geoDistribution = selectedKeyword
    ? allTrends
        .filter(k => k.keyword.toLowerCase() === selectedKeyword.keyword.toLowerCase())
        .sort((a, b) => (b.normalized_score || 0) - (a.normalized_score || 0))
    : []

  const toggleCompare = (keywordText) => {
    if (comparisonList.includes(keywordText)) {
      setComparisonList(prev => prev.filter(k => k !== keywordText))
    } else {
      if (comparisonList.length >= 3) {
        alert("You can compare up to 3 terms simultaneously.")
        return
      }
      setComparisonList(prev => [...prev, keywordText])
    }
  }

  return (
    <div className="animate-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.7px', lineHeight: 1.1 }}>
            Google Trends Explorer
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text3)', marginTop: '5px' }}>
            Real-time public search queries tracking relative symptom search index
          </p>
        </div>
        <button 
          onClick={loadTrends} 
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
          <i className="ti ti-refresh" /> Refresh Trends
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--red)', borderRadius: '8px', padding: '12px 16px', color: 'var(--red)', fontSize: '13px' }}>
          {error}
        </div>
      )}

      {/* TOP METRIC: OVERALL SEARCH INTENSITY */}
      {trends && (
        <div className="glass-card" style={{
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'var(--card-bg)',
          border: '1px solid var(--border)',
          borderRadius: '16px',
          flexWrap: 'wrap',
          gap: '16px'
        }}>
          <div>
            <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Search Surveillance Index
            </span>
            <h2 style={{ color: 'var(--gold)', fontSize: '28px', fontWeight: 900, margin: '4px 0 0 0', letterSpacing: '-1px' }}>
              {trends.trends_score}
              <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text3)' }}> / 100 avg volume</span>
            </h2>
            <div style={{ fontSize: '11px', color: 'var(--text3)', marginTop: '4px' }}>
              Target: <strong>{trends.geo}</strong> • Data Source: {trends.source}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ background: 'var(--bg2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>ACTIVE QUERIES</div>
              <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text)' }}>{keywordList.length}</div>
            </div>
            <div style={{ background: 'var(--bg2)', padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border)', textAlign: 'center' }}>
              <div style={{ fontSize: '10px', color: 'var(--text3)', fontWeight: 600 }}>MAX VOL TERM</div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--gold)', marginTop: '4px', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {keywordList.length ? keywordList.sort((a,b) => b.search_index - a.search_index)[0].keyword : 'None'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON VISUALIZER PANEL */}
      {comparisonList.length > 0 && (
        <div className="glass-card animate-in" style={{ padding: '20px', background: 'var(--bg2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <span style={{ fontSize: '12px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              ⚖ Term Comparison Explorer
            </span>
            <button 
              onClick={() => setComparisonList([])}
              style={{ background: 'transparent', border: 'none', color: 'var(--red)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}
            >
              Clear Comparison
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${comparisonList.length}, 1fr)`, gap: '16px' }}>
            {comparisonList.map(kwText => {
              const matchedItems = allTrends.filter(k => k.keyword.toLowerCase() === kwText.toLowerCase())
              const matchedInDistrict = keywordList.find(k => k.keyword.toLowerCase() === kwText.toLowerCase())
              const avgScore = matchedItems.length 
                ? Math.round(matchedItems.reduce((sum, item) => sum + (item.normalized_score * 100), 0) / matchedItems.length)
                : 0

              return (
                <div key={kwText} style={{ background: 'var(--bg3)', border: '1px solid var(--border)', borderRadius: '10px', padding: '14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', marginBottom: '8px' }}>
                    "{kwText}"
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text3)' }}>District Index:</span>
                      <strong style={{ color: 'var(--gold)' }}>{matchedInDistrict ? Math.round(matchedInDistrict.normalized_score * 100) : '0'}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text3)' }}>National Avg:</span>
                      <strong>{avgScore}%</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text3)' }}>Surveillance Matches:</span>
                      <strong>{matchedItems.length} locations</strong>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* EXPLORER LAYOUT */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: '24px', alignItems: 'start' }}>
        
        {/* LEFT PANEL: KEYWORD LIST */}
        <div className="glass-card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '13px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Relative Symptom Interest In {district || 'All Districts'}
            </span>
          </div>

          {keywordList.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text3)' }}>
              No search volume data returned for this district.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {keywordList.map(item => {
                const isSelected = selectedKeyword && selectedKeyword.id === item.id
                const isComparing = comparisonList.includes(item.keyword)
                const pct = Math.round((item.normalized_score || 0) * 100)
                
                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedKeyword(item)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderBottom: '1px solid rgba(212, 175, 55, 0.05)',
                      background: isSelected ? 'rgba(212, 175, 55, 0.03)' : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={e => {
                      if (!isSelected) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'
                    }}
                    onMouseLeave={e => {
                      if (!isSelected) e.currentTarget.style.background = 'transparent'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleCompare(item.keyword)
                        }}
                        style={{
                          background: isComparing ? 'var(--gold)' : 'transparent',
                          border: '1px solid var(--gold)',
                          color: isComparing ? 'var(--bg)' : 'var(--gold)',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: 700,
                          cursor: 'pointer'
                        }}
                      >
                        {isComparing ? 'Comparing' : 'Compare'}
                      </button>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)' }}>
                          {item.keyword}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text3)' }}>
                          Related Pathogen: <strong style={{ color: 'var(--gold2)' }}>{item.related_disease}</strong>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', minWidth: '120px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text2)', fontWeight: 600 }}>
                          Search Index: {pct}%
                        </div>
                        <div style={{ height: '4px', width: '100%', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', background: 'var(--gold)', width: `${pct}%` }} />
                        </div>
                      </div>
                      <i className="ti ti-chevron-right" style={{ color: 'var(--text3)', fontSize: '14px' }} />
                    </div>

                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* RIGHT PANEL: GEOGRAPHIC BREAKDOWN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          
          <h3 style={{ fontSize: '15px', fontWeight: 800, color: 'var(--gold)', textTransform: 'uppercase', letterSpacing: '0.8px', margin: 0 }}>
            Geographic Interest Breakdown
          </h3>

          {selectedKeyword ? (
            <div className="glass-card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text3)', display: 'block', fontWeight: 600 }}>SELECTED QUERY TERM</span>
                <span style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text)' }}>"{selectedKeyword.keyword}"</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <span style={{ fontSize: '11px', color: 'var(--text3)', fontWeight: 600 }}>RELATIVITY REGIONS (TOP 5)</span>
                
                {geoDistribution.slice(0, 5).map((distItem, index) => {
                  const val = Math.round((distItem.normalized_score || 0) * 100)
                  return (
                    <div key={index} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                        <span style={{ color: 'var(--text2)' }}>{distItem.district}</span>
                        <strong style={{ color: 'var(--gold)' }}>{val}%</strong>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg3)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'var(--gold)', width: `${val}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div style={{
                background: 'rgba(212, 175, 55, 0.03)',
                border: '1px solid rgba(212, 175, 55, 0.1)',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '11px',
                color: 'var(--text3)',
                lineHeight: 1.4
              }}>
                <strong>💡 Real-time Surveillance</strong>
                We track search queries related to disease clusters to pinpoint community symptoms prior to official clinical diagnosis. High normalized scores are indicative of an incubation flare-up.
              </div>
            </div>
          ) : (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)' }}>
              Select a keyword on the left to see regional distribution.
            </div>
          )}

        </div>

      </div>

    </div>
  )
}
