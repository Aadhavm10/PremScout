import { useState, useEffect, Fragment } from 'react'
import './App.css'
import TeamOfTheWeek from './components/TeamOfTheWeek'
import Papa from 'papaparse'
import { Dialog, Transition } from '@headlessui/react'
import { XMarkIcon } from '@heroicons/react/24/outline'

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
  const [filteredData, setFilteredData] = useState<ApiResponse | null>(null)
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
        // Check if we're in development (localhost) vs production
        const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'

        if (isDevelopment) {
          // Try local API first (development mode only)
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
            throw new Error('local API not available')
          }
        } else {
          // Production mode - try static predictions.json
          const localUrl = `/predictions.json?t=${Date.now()}`
          console.log('[fetchData] requesting static JSON', localUrl)
          const local = await fetch(localUrl)
          console.log('[fetchData] static JSON response', { ok: local.ok, status: local.status })
          if (local.ok) {
            const json = await local.json()
            console.log('[fetchData] static JSON parsed', { count: (json?.players || []).length })
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
            console.warn('[fetchData] static JSON not available; body=', txt.slice(0,200))
            throw new Error('static JSON not available')
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

      // Derive teams list from unfiltered data
      const teamsSet = Array.from(new Set(players.map(p => p.team))).filter(Boolean).sort()

      // Store unfiltered data for Team of the Week
      const unfilteredData = {
        gameweek: meta.gameweek ?? 0,
        csv_file: meta.csv_file ?? 'latest.csv',
        total_players: meta.total_players ?? players.length,
        filtered_players: players.length,
        players,
        last_updated: meta.last_updated
      }

      setData(unfilteredData)
      setTeams(teamsSet)

      // Apply initial filters to create filtered data for table
      applyFiltersToData(unfilteredData)
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
  }, [])

  const handleSort = (key: SortKey) => {
    let newSortOrder = sortOrder
    if (sortKey === key) {
      newSortOrder = sortOrder === 'asc' ? 'desc' : 'asc'
      setSortOrder(newSortOrder)
    } else {
      setSortKey(key)
      newSortOrder = 'desc'
      setSortOrder('desc')
    }

    // Re-apply filters with new sort after state updates
    if (data) {
      setTimeout(() => applyFiltersToData(data), 0)
    }
  }

  const applyFiltersToData = (sourceData: ApiResponse) => {
    let filteredPlayers = [...sourceData.players]

    // Apply filters
    if (teamFilter) {
      filteredPlayers = filteredPlayers.filter(p => p.team?.toLowerCase().includes(teamFilter.toLowerCase()))
    }
    if (positionFilter) {
      filteredPlayers = filteredPlayers.filter(p => p.position === positionFilter)
    }
    if (searchFilter) {
      filteredPlayers = filteredPlayers.filter(p => (p.name || '').toLowerCase().includes(searchFilter.toLowerCase()))
    }

    // Apply sorting
    filteredPlayers.sort((a: any, b: any) => {
      const av = a[sortKey] ?? 0
      const bv = b[sortKey] ?? 0
      if (av < bv) return sortOrder === 'asc' ? -1 : 1
      if (av > bv) return sortOrder === 'asc' ? 1 : -1
      return 0
    })

    // Set filtered data for table
    setFilteredData({
      ...sourceData,
      filtered_players: filteredPlayers.length,
      players: filteredPlayers
    })
  }

  const handleFilter = () => {
    if (data) {
      applyFiltersToData(data)
    }
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
    <div className="min-h-screen w-full bg-slate-950">
      {/* Main Title */}
      <div className="relative mx-auto mb-8 w-full overflow-hidden border-y border-primary-400/20 bg-gradient-to-br from-slate-900 via-slate-850 to-slate-900 py-10 shadow-2xl shadow-primary-500/10 backdrop-blur-xl">
        {/* Animated gradient overlay */}
        <div className="absolute inset-0 animate-gradient-x bg-gradient-to-r from-primary-500/10 via-accent-400/10 to-primary-500/10 bg-200% opacity-50" />

        {/* Mesh gradient background */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(20,184,166,0.1),transparent)]" />

        <div className="relative z-10 text-center">
          <h1 className="mb-2 font-display text-6xl font-black tracking-tight">
            <span className="text-gradient drop-shadow-2xl">
              PremScout
            </span>
          </h1>
          <p className="text-lg font-medium tracking-wide text-text-secondary">
            Fantasy Premier League Points Predictor
          </p>
        </div>
      </div>

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
            placeholder="Search players..."
            value={searchFilter}
            onChange={(e) => setSearchFilter(e.target.value)}
          />

          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
            <option value="">All Teams</option>
            {teams.map(team => (
              <option key={team} value={team}>{team}</option>
            ))}
          </select>

          <select value={positionFilter} onChange={(e) => setPositionFilter(e.target.value)}>
            <option value="">All Positions</option>
            <option value="GKP">Goalkeeper</option>
            <option value="DEF">Defender</option>
            <option value="MID">Midfielder</option>
            <option value="FWD">Forward</option>
          </select>

          <button onClick={handleFilter}>Apply Filters</button>
        </div>

        <div className="column-toggles">
          <details>
            <summary>Show/Hide Columns ({visibleColumns.size}/{columnConfig.length})</summary>
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

      {filteredData && (
        <div className="table-container" style={{ maxHeight: '60vh', overflow: 'auto' }}>
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
              {filteredData.players.map((player, index) => (
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
      <Transition show={showModal} as={Fragment}>
        <Dialog onClose={closeModal} className="relative z-50">
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transition-all">
                  {selectedPlayer && (
                    <>
                      {/* Header */}
                      <div className="border-b border-slate-700 bg-slate-850 p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-4">
                            {selectedPlayer.image_url && (
                              <div className="h-20 w-20 overflow-hidden rounded-xl border-2 border-slate-700 bg-slate-800">
                                <img
                                  src={selectedPlayer.image_url}
                                  alt={selectedPlayer.name}
                                  className="h-full w-full object-cover"
                                  onError={(e) => {
                                    e.currentTarget.style.display = 'none'
                                  }}
                                />
                              </div>
                            )}
                            <div>
                              <Dialog.Title className="font-display text-3xl font-bold text-text-primary">
                                {selectedPlayer.name}
                              </Dialog.Title>
                              <p className="mt-1 text-lg text-text-secondary">
                                {selectedPlayer.team} • {selectedPlayer.position}
                              </p>
                              <p className="mt-1 text-sm text-text-tertiary">
                                Next: vs {selectedPlayer.next_opponent} ({selectedPlayer.is_home ? 'H' : 'A'})
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={closeModal}
                            className="rounded-lg p-2 text-text-tertiary transition-colors hover:bg-slate-800 hover:text-text-primary"
                            aria-label="Close"
                          >
                            <XMarkIcon className="h-6 w-6" />
                          </button>
                        </div>
                      </div>

                      {/* Body */}
                      <div className="p-6">
                        {/* Card Rarity Legend */}
                        <div className="mb-6 rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                          <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                            Card Rarity Guide
                          </h3>
                          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded border-2 border-purple-400/50 bg-gradient-to-br from-purple-900 via-fuchsia-900 to-purple-900" />
                              <span className="text-sm text-text-secondary">Special (8+ pts)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded border-2 border-amber-400/50 bg-gradient-to-br from-yellow-900 via-amber-900 to-yellow-900" />
                              <span className="text-sm text-text-secondary">Gold (6-7.9 pts)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded border-2 border-slate-400/50 bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700" />
                              <span className="text-sm text-text-secondary">Silver (4-5.9 pts)</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="h-4 w-4 rounded border-2 border-orange-700/50 bg-gradient-to-br from-orange-950 via-stone-900 to-orange-950" />
                              <span className="text-sm text-text-secondary">Bronze (&lt;4 pts)</span>
                            </div>
                          </div>
                        </div>

                        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                          {/* Predictions */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Predictions
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Predicted Points</span>
                                <span className="font-mono text-lg font-bold text-primary-400">
                                  {selectedPlayer.predicted_points.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Opponent Difficulty</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.opponent_difficulty}/5
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Home/Away</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.is_home ? 'Home' : 'Away'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Value */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Value
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Current Price</span>
                                <span className="font-mono text-lg font-bold text-success-400">
                                  £{selectedPlayer.now_cost.toFixed(1)}m
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Points per Game</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.points_per_game.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Total Points</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.total_points}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Performance */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Performance
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Form</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.form.toFixed(1)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Minutes Played</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.minutes}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Expected Goals</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.expected_goals.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Season Stats */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Season Stats
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Goals Scored</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.goals_scored}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Assists</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.assists}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Clean Sheets</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.clean_sheets}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Discipline */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Discipline
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Yellow Cards</span>
                                <span className="font-mono text-lg font-semibold text-warning-400">
                                  {selectedPlayer.yellow_cards}
                                </span>
                              </div>
                              <div className="flex items-center justify-between border-b border-slate-700/50 pb-2">
                                <span className="text-sm text-text-secondary">Red Cards</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.red_cards}
                                </span>
                              </div>
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Saves per 90</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.saves_per_90.toFixed(1)}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Availability */}
                          <div className="rounded-xl border-2 border-slate-700 bg-slate-850 p-4 shadow-lg">
                            <h3 className="mb-3 border-b border-slate-700 pb-2 text-sm font-semibold uppercase tracking-wider text-text-tertiary">
                              Availability
                            </h3>
                            <div className="space-y-3">
                              <div className="flex items-center justify-between">
                                <span className="text-sm text-text-secondary">Chance of Playing</span>
                                <span className="font-mono text-lg font-semibold text-text-primary">
                                  {selectedPlayer.chance_of_playing_this_round || 'Unknown'}%
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

        <footer style={{ textAlign: 'center', marginTop: '20px', color: '#718096' }}>
          {data && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{
                fontSize: '0.9rem',
                background: '#2d3748',
                padding: '10px 16px',
                borderRadius: '8px',
                display: 'inline-block',
                marginBottom: '10px',
                border: '1px solid #4a5568'
              }}>
                Gameweek {data.gameweek} • {filteredData?.filtered_players || 0} of {data.total_players} players
              </div>
              {data?.last_updated && (
                <div style={{
                  fontSize: '0.8rem',
                  opacity: 0.7,
                  marginTop: '5px'
                }}>
                  Last updated: {data.last_updated}
                </div>
              )}
            </div>
          )}
          <div style={{ marginBottom: '10px', fontSize: '0.8rem', opacity: 0.6 }}>
            Updates automatically daily at 9:00 AM UTC
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