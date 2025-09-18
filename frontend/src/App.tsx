import { useState, useEffect } from 'react'
import './App.css'
import TeamOfTheWeek from './components/TeamOfTheWeek'
import Papa from 'papaparse'

interface Player {
  name: string
  team: string
  position: string
  next_opponent: string
  fixture: string
  predicted_points: number
  now_cost: number
  points_per_game: number
  form: number
  expected_goals: number
  minutes: number
  assists: number
  goals_scored: number
  yellow_cards: number
  red_cards: number
  saves_per_90: number
  total_points: number
  clean_sheets: number
  opponent_difficulty: number
  is_home: boolean
  chance_of_playing_this_round: number
  // Image-related fields
  player_code?: number
  web_name?: string
  display_name?: string
  image_url_primary?: string
  image_url_secondary?: string
  image_url_tertiary?: string
  imageSources?: string[]
  currentImageIndex?: number
  imageError?: boolean
}

interface ApiResponse {
  gameweek: number
  csv_file: string
  total_players: number
  filtered_players: number
  players: Player[]
  last_updated?: string
}

type SortKey = keyof Player
type SortOrder = 'asc' | 'desc'

const columnConfig = [
  { key: 'name' as SortKey, label: 'Player', type: 'text', width: '200px' },
  { key: 'team' as SortKey, label: 'Team', type: 'text', width: '100px' },
  { key: 'position' as SortKey, label: 'Pos', type: 'text', width: '60px' },
  { key: 'next_opponent' as SortKey, label: 'Opponent', type: 'text', width: '100px' },
  { key: 'predicted_points' as SortKey, label: 'Pred Pts', type: 'number', width: '90px', decimals: 1 },
  { key: 'now_cost' as SortKey, label: 'Price', type: 'number', width: '70px', decimals: 1 },
  { key: 'points_per_game' as SortKey, label: 'PPG', type: 'number', width: '70px', decimals: 1 },
  { key: 'form' as SortKey, label: 'Form', type: 'number', width: '70px', decimals: 1 },
  { key: 'total_points' as SortKey, label: 'Total Pts', type: 'number', width: '90px' },
  { key: 'minutes' as SortKey, label: 'Minutes', type: 'number', width: '80px' },
  { key: 'goals_scored' as SortKey, label: 'Goals', type: 'number', width: '70px' },
  { key: 'assists' as SortKey, label: 'Assists', type: 'number', width: '70px' },
  { key: 'expected_goals' as SortKey, label: 'xG', type: 'number', width: '70px', decimals: 2 },
  { key: 'clean_sheets' as SortKey, label: 'CS', type: 'number', width: '60px' },
  { key: 'saves_per_90' as SortKey, label: 'Saves/90', type: 'number', width: '90px', decimals: 1 },
  { key: 'yellow_cards' as SortKey, label: 'YC', type: 'number', width: '50px' },
  { key: 'red_cards' as SortKey, label: 'RC', type: 'number', width: '50px' },
  { key: 'opponent_difficulty' as SortKey, label: 'Opp Diff', type: 'number', width: '80px' },
  { key: 'is_home' as SortKey, label: 'H/A', type: 'boolean', width: '60px' },
  { key: 'chance_of_playing_this_round' as SortKey, label: 'Play %', type: 'number', width: '80px' },
]

function App() {
  const [data, setData] = useState<ApiResponse | null>(null)
  const [teams, setTeams] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Filters
  const [teamFilter, setTeamFilter] = useState('')
  const [positionFilter, setPositionFilter] = useState('')
  const [searchFilter, setSearchFilter] = useState('')
  
  // Sorting
  const [sortKey, setSortKey] = useState<SortKey>('predicted_points')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  
  // Visible columns - start with key columns visible
  const [visibleColumns, setVisibleColumns] = useState<Set<SortKey>>(
    new Set([
      'name', 'team', 'position', 'next_opponent', 'predicted_points', 
      'now_cost', 'points_per_game', 'form', 'total_points', 'minutes'
    ])
  )

  // Modal state
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [showModal, setShowModal] = useState(false)

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('[fetchData] start', { teamFilter, positionFilter, searchFilter, sortKey, sortOrder })
      // Try local static predictions.json first (served with the build), fallback to GitHub raw CSV
      let players: Player[] = []
      let meta: Partial<ApiResponse> = {}
      try {
        // Try local API first (development mode)
        const apiUrl = `http://localhost:5000/api/predictions?t=${Date.now()}`
        console.log('[fetchData] requesting local API', apiUrl)
        const apiResp = await fetch(apiUrl)
        console.log('[fetchData] local API response', { ok: apiResp.ok, status: apiResp.status })
        if (apiResp.ok) {
          const json = await apiResp.json()
          console.log('[fetchData] local API parsed', { count: (json?.players || []).length })
          meta = {
            gameweek: json.gameweek,
            csv_file: json.csv_file,
            total_players: json.total_players,
            filtered_players: json.filtered_players,
            last_updated: json.last_updated,
            players: []
          }
          players = json.players || []
        } else {
          console.warn('[fetchData] local API not available, trying static JSON')

          // Fallback to local static predictions.json
          const localUrl = `/predictions.json?t=${Date.now()}`
          console.log('[fetchData] requesting local JSON', localUrl)
          const local = await fetch(localUrl)
          console.log('[fetchData] local JSON response', { ok: local.ok, status: local.status })
          if (local.ok) {
            const json = await local.json()
            console.log('[fetchData] local JSON parsed', { count: (json?.players || []).length })
            meta = {
              gameweek: json.gameweek,
              csv_file: json.csv_file,
              total_players: json.total_players,
              filtered_players: json.filtered_players,
              last_updated: json.last_updated,
              players: []
            }
            players = json.players || []
          } else {
            const txt = await local.text().catch(() => '')
            console.warn('[fetchData] local JSON not available; body=', txt.slice(0,200))
            throw new Error('local sources not available')
          }
        }
      } catch {
        const RAW_CSV_URL = `https://raw.githubusercontent.com/Aadhavm10/PremScout/main/latest.csv?t=${Date.now()}`
        console.log('[fetchData] requesting RAW CSV', RAW_CSV_URL)
        const resp = await fetch(RAW_CSV_URL)
        console.log('[fetchData] RAW CSV response', { ok: resp.ok, status: resp.status })
        if (!resp.ok) throw new Error('Failed to fetch predictions (raw)')
        const csvText = await resp.text()
        console.log('[fetchData] RAW CSV length', csvText.length)
        const parsed = Papa.parse(csvText, { header: true, dynamicTyping: true }) as any
        if (parsed?.errors?.length) console.warn('[fetchData] papa errors', parsed.errors)
        players = (parsed.data as any[]).filter(Boolean) as Player[]
        meta = { gameweek: 0, csv_file: 'latest.csv', total_players: players.length, filtered_players: players.length }
      }

      // Enhanced image handling: CSV now includes pre-calculated image URLs
      console.log('[fetchData] processing image data from CSV')
      players = players.map((p: any) => {
        // Generate fallback avatar if no player code or image URLs
        const generateFallbackAvatar = () => {
          const nameParts = (p.name || '').split(' ')
          const initials = nameParts.length > 1
            ? `${nameParts[0][0]}${nameParts[nameParts.length - 1][0]}`.toUpperCase()
            : (nameParts[0] || '?').substring(0, 2).toUpperCase()

          const getPositionColor = (position: string) => {
            switch (position) {
              case 'GKP': return { bg: 'f56565', text: 'ffffff' }
              case 'DEF': return { bg: '38a169', text: 'ffffff' }
              case 'MID': return { bg: '3182ce', text: 'ffffff' }
              case 'FWD': return { bg: 'd69e2e', text: 'ffffff' }
              default: return { bg: '718096', text: 'ffffff' }
            }
          }

          const colors = getPositionColor(p.position)
          return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.name)}&backgroundColor=${colors.bg}&textColor=${colors.text}&fontSize=40`
        }

        // Create image sources array in order of preference
        const imageSources = []

        // Add primary image URL if available
        if (p.image_url_primary) {
          imageSources.push(p.image_url_primary)
        }

        // Add secondary image URL if available
        if (p.image_url_secondary) {
          imageSources.push(p.image_url_secondary)
        }

        // Add tertiary image URL if available
        if (p.image_url_tertiary) {
          imageSources.push(p.image_url_tertiary)
        }

        // If we have a player code but no pre-calculated URLs, generate them
        if (p.player_code && imageSources.length === 0) {
          imageSources.push(
            `https://images.weserv.nl/?url=resources.premierleague.com/premierleague/photos/players/250x250/p${p.player_code}.png&w=250&h=250&fit=cover&a=attention`,
            `https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.player_code}.png`,
            `https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_${p.player_code}.png`
          )
        }

        // Add fallback avatar as final option
        imageSources.push(generateFallbackAvatar())

        return {
          ...p,
          imageSources,
          currentImageIndex: 0,
          imageError: false
        }
      })

      console.log('[fetchData] prepared image sources for', players.length, 'players')

      // Filters
      const before = players.length
      if (teamFilter) players = players.filter(p => p.team?.toLowerCase().includes(teamFilter.toLowerCase()))
      if (positionFilter) players = players.filter(p => p.position === positionFilter)
      if (searchFilter) players = players.filter(p => (p.name || '').toLowerCase().includes(searchFilter.toLowerCase()))
      console.log('[fetchData] filtered', { before, after: players.length })

      // Sorting
      players.sort((a: any, b: any) => {
        const av = a[sortKey] ?? 0
        const bv = b[sortKey] ?? 0
        if (av < bv) return sortOrder === 'asc' ? -1 : 1
        if (av > bv) return sortOrder === 'asc' ? 1 : -1
        return 0
      })
      console.log('[fetchData] sorted', { sortKey, sortOrder })

      // Derive gameweek from CSV header (optional) or leave unknown
      const teamsSet = Array.from(new Set(players.map(p => p.team))).filter(Boolean).sort()

      setData({
        gameweek: meta.gameweek ?? 0,
        csv_file: meta.csv_file ?? 'latest.csv',
        total_players: meta.total_players ?? players.length,
        filtered_players: players.length,
        players,
        last_updated: meta.last_updated
      })
      setTeams(teamsSet)
      console.log('[fetchData] done setData', { total: players.length })
    } catch (err: any) {
      console.error('[fetchData] error', err)
      setError(err?.message || String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [teamFilter, positionFilter, searchFilter, sortKey, sortOrder])

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortOrder('desc')
    }
  }

  const handleFilter = () => {
    fetchData()
  }

  const formatValue = (value: any, column: typeof columnConfig[0]) => {
    if (value === null || value === undefined || value === '') return '-'
    
    if (column.type === 'number') {
      const num = Number(value)
      if (isNaN(num)) return '-'
      if (column.decimals !== undefined) {
        return num.toFixed(column.decimals)
      }
      return num.toString()
    }
    
    if (column.type === 'boolean' || column.key === 'is_home') {
      return value ? 'H' : 'A'
    }
    
    return value.toString()
  }

  const toggleColumn = (key: SortKey) => {
    const newVisible = new Set(visibleColumns)
    if (newVisible.has(key)) {
      // Don't allow hiding name column
      if (key === 'name') return
      newVisible.delete(key)
    } else {
      newVisible.add(key)
    }
    setVisibleColumns(newVisible)
  }

  const visibleColumnConfig = columnConfig.filter(col => visibleColumns.has(col.key))

  const openPlayerModal = (player: Player) => {
    setSelectedPlayer(player)
    setShowModal(true)
  }

  const closeModal = () => {
    setShowModal(false)
    setSelectedPlayer(null)
  }

  if (loading) {
    return (
      <div className="app">
        <div className="loading">📊 Loading FPL predictions...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="app">
        <div className="error">
          <div>❌ Error: {error}</div>
          <button onClick={fetchData}>🔄 Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="app-wrapper">
      {data && (
        <div className="info-overlay">
          <p>
            📅 Gameweek {data.gameweek} • 👥 {data.filtered_players} of {data.total_players} players
            <br />
            📁 Source: {data.csv_file}
          </p>
        </div>
      )}

      {/* Team of the Week - Full Width */}
      {data && (
        <TeamOfTheWeek 
          players={data.players} 
          onPlayerClick={openPlayerModal}
        />
      )}

      <div className="app">
        <div className="controls">
        <div className="filters">
          <input
            type="text"
            placeholder="🔍 Search players..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />
          
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">🏟️ All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>
          
          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            <option value="">👤 All Positions</option>
            <option value="GKP">🥅 Goalkeeper</option>
            <option value="DEF">🛡️ Defender</option>
            <option value="MID">⚡ Midfielder</option>
            <option value="FWD">🎯 Forward</option>
          </select>
          
          <button onClick={handleFilter}>🔍 Apply Filters</button>
        </div>

        <div className="column-toggles">
          <details>
            <summary>📋 Show/Hide Columns ({visibleColumns.size}/{columnConfig.length})</summary>
            <div className="column-grid">
              {columnConfig.map(col => (
                <label key={col.key} className="column-toggle">
                  <input
                    type="checkbox"
                    checked={visibleColumns.has(col.key)}
                    onChange={() => toggleColumn(col.key)}
                    disabled={col.key === 'name'}
                  />
                  {col.label}
                </label>
              ))}
            </div>
          </details>
        </div>
      </div>

      {data && (
        <div className="table-container">
          <table className="players-table">
            <thead>
              <tr>
                {visibleColumnConfig.map(col => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`sortable ${sortKey === col.key ? 'sorted' : ''}`}
                    onClick={() => handleSort(col.key)}
                    title={`Click to sort by ${col.label}`}
                  >
                    {col.label}
                    {sortKey === col.key && (
                      <span className="sort-indicator">
                        {sortOrder === 'asc' ? ' ↑' : ' ↓'}
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.players.map((player, index) => (
                <tr key={`${player.name}-${index}`}>
                  {visibleColumnConfig.map(col => (
                    <td key={col.key} className={col.type === 'number' ? 'number' : ''}>
                      {col.key === 'name' ? (
                        <button 
                          className="player-name-button" 
                          onClick={() => openPlayerModal(player)}
                          title="Click to view player details"
                        >
                          {formatValue(player[col.key], col)}
                        </button>
                      ) : (
                        formatValue(player[col.key], col)
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Player Modal */}
      {showModal && selectedPlayer && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div className="player-info">
                {selectedPlayer.image_url && (
                  <img
                    src={selectedPlayer.image_url}
                    alt={selectedPlayer.name}
                    className="player-image"
                    onError={(e) => {
                      e.currentTarget.style.display = 'none'
                    }}
                  />
                )}
                <div className="player-details">
                  <h2>{selectedPlayer.name}</h2>
                  <p className="team-position">{selectedPlayer.team} • {selectedPlayer.position}</p>
                  <p className="next-fixture">Next: vs {selectedPlayer.next_opponent}</p>
                </div>
              </div>
              <button className="close-button" onClick={closeModal}>×</button>
            </div>
            
            <div className="modal-body">
              <div className="stats-grid">
                <div className="stat-group">
                  <h3>🎯 Predictions</h3>
                  <div className="stat-item">
                    <span>Predicted Points</span>
                    <strong>{selectedPlayer.predicted_points.toFixed(1)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Opponent Difficulty</span>
                    <strong>{selectedPlayer.opponent_difficulty}/5</strong>
                  </div>
                  <div className="stat-item">
                    <span>Home/Away</span>
                    <strong>{selectedPlayer.is_home ? 'Home' : 'Away'}</strong>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>💰 Value</h3>
                  <div className="stat-item">
                    <span>Current Price</span>
                    <strong>£{selectedPlayer.now_cost.toFixed(1)}m</strong>
                  </div>
                  <div className="stat-item">
                    <span>Points per Game</span>
                    <strong>{selectedPlayer.points_per_game.toFixed(1)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Total Points</span>
                    <strong>{selectedPlayer.total_points}</strong>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>📈 Performance</h3>
                  <div className="stat-item">
                    <span>Form</span>
                    <strong>{selectedPlayer.form.toFixed(1)}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Minutes Played</span>
                    <strong>{selectedPlayer.minutes}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Expected Goals</span>
                    <strong>{selectedPlayer.expected_goals.toFixed(2)}</strong>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>⚽ Season Stats</h3>
                  <div className="stat-item">
                    <span>Goals Scored</span>
                    <strong>{selectedPlayer.goals_scored}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Assists</span>
                    <strong>{selectedPlayer.assists}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Clean Sheets</span>
                    <strong>{selectedPlayer.clean_sheets}</strong>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>🟨 Discipline</h3>
                  <div className="stat-item">
                    <span>Yellow Cards</span>
                    <strong>{selectedPlayer.yellow_cards}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Red Cards</span>
                    <strong>{selectedPlayer.red_cards}</strong>
                  </div>
                  <div className="stat-item">
                    <span>Saves per 90</span>
                    <strong>{selectedPlayer.saves_per_90.toFixed(1)}</strong>
                  </div>
                </div>

                <div className="stat-group">
                  <h3>🎲 Availability</h3>
                  <div className="stat-item">
                    <span>Chance of Playing</span>
                    <strong>{selectedPlayer.chance_of_playing_this_round || 'Unknown'}%</strong>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

        <footer style={{ textAlign: 'center', marginTop: '20px', color: '#718096' }}>
          <div style={{ marginBottom: '10px' }}>
            <p>📊 Data refreshes automatically from the latest gameweek predictions</p>
          </div>
          {data?.last_updated && (
            <div style={{ 
              fontSize: '0.85rem', 
              opacity: 0.8,
              background: '#2d3748',
              padding: '8px 16px',
              borderRadius: '20px',
              display: 'inline-block',
              border: '1px solid #4a5568'
            }}>
              🕐 Last updated: {data.last_updated}
            </div>
          )}
          <div style={{ marginTop: '10px', fontSize: '0.8rem', opacity: 0.6 }}>
            🤖 Updates automatically daily at 9:00 AM UTC
          </div>
          <div style={{
            marginTop: '20px',
            fontSize: '1rem',
            opacity: 1,
            padding: '15px',
            background: 'rgba(66, 153, 225, 0.1)',
            borderRadius: '8px',
            border: '1px solid rgba(66, 153, 225, 0.2)'
          }}>
            <a
              href="https://github.com/Aadhavm10/PremScout"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#4299e1',
                textDecoration: 'none',
                marginRight: '30px',
                fontWeight: '500',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = '#63b3ed'}
              onMouseLeave={(e) => e.target.style.color = '#4299e1'}
            >
              GitHub: PremScout
            </a>
            <a
              href="https://aadhavmani.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                color: '#4299e1',
                textDecoration: 'none',
                fontWeight: '500',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.target.style.color = '#63b3ed'}
              onMouseLeave={(e) => e.target.style.color = '#4299e1'}
            >
              Check out my other projects
            </a>
          </div>
        </footer>
      </div>
    </div>
  )
}

export default App