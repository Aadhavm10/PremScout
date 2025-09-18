import React from 'react'
import FifaCard from './FifaCard'

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
  image_url?: string
  player_code?: number
}

interface TeamOfTheWeekProps {
  players: Player[]
  onPlayerClick: (player: Player) => void
}

const TeamOfTheWeek: React.FC<TeamOfTheWeekProps> = ({ players, onPlayerClick }) => {
  const getBestEleven = (players: Player[]) => {
    // Filter by position and sort by predicted points
    const gkp = players.filter(p => p.position === 'GKP').sort((a, b) => b.predicted_points - a.predicted_points)
    const def = players.filter(p => p.position === 'DEF').sort((a, b) => b.predicted_points - a.predicted_points)
    const mid = players.filter(p => p.position === 'MID').sort((a, b) => b.predicted_points - a.predicted_points)
    const fwd = players.filter(p => p.position === 'FWD').sort((a, b) => b.predicted_points - a.predicted_points)

    // Valid FPL formations: [defenders, midfielders, forwards] (always 1 GKP)
    const validFormations = [
      { name: '3-4-3', def: 3, mid: 4, fwd: 3 },
      { name: '3-5-2', def: 3, mid: 5, fwd: 2 },
      { name: '4-3-3', def: 4, mid: 3, fwd: 3 },
      { name: '4-4-2', def: 4, mid: 4, fwd: 2 },
      { name: '4-5-1', def: 4, mid: 5, fwd: 1 },
      { name: '5-3-2', def: 5, mid: 3, fwd: 2 },
      { name: '5-4-1', def: 5, mid: 4, fwd: 1 }
    ]

    // Test each formation and find the one with highest total points
    let bestFormation = null
    let bestPoints = 0
    let bestTeam = null

    for (const formation of validFormations) {
      // Check if we have enough players for this formation
      if (gkp.length >= 1 && def.length >= formation.def && 
          mid.length >= formation.mid && fwd.length >= formation.fwd) {
        
        const team = {
          gkp: gkp.slice(0, 1),
          def: def.slice(0, formation.def),
          mid: mid.slice(0, formation.mid),
          fwd: fwd.slice(0, formation.fwd),
          formation: formation.name
        }

        // Calculate total points for this formation
        const totalPoints = [
          ...team.gkp,
          ...team.def,
          ...team.mid,
          ...team.fwd
        ].reduce((sum, player) => sum + player.predicted_points, 0)

        if (totalPoints > bestPoints) {
          bestPoints = totalPoints
          bestFormation = formation
          bestTeam = team
        }
      }
    }

    return bestTeam || {
      gkp: gkp.slice(0, 1),
      def: def.slice(0, 4),
      mid: mid.slice(0, 4),
      fwd: fwd.slice(0, 2),
      formation: '4-4-2'
    }
  }

  const bestEleven = getBestEleven(players)
  const totalPoints = [
    ...bestEleven.gkp,
    ...bestEleven.def,
    ...bestEleven.mid,
    ...bestEleven.fwd
  ].reduce((sum, player) => sum + player.predicted_points, 0)

  const totalCost = [
    ...bestEleven.gkp,
    ...bestEleven.def,
    ...bestEleven.mid,
    ...bestEleven.fwd
  ].reduce((sum, player) => sum + player.now_cost, 0)

  const averagePoints = totalPoints / 11

  return (
    <div className="team-of-the-week">
      <div className="totw-header">
        <div className="totw-stats-compact">
          <div className="totw-stat-compact">
            <span className="stat-value">{totalPoints.toFixed(1)}</span>
            <span className="stat-label">Points</span>
          </div>
          <div className="stat-separator">•</div>
          <div className="totw-stat-compact">
            <span className="stat-value">£{totalCost.toFixed(1)}m</span>
            <span className="stat-label">Cost</span>
          </div>
          <div className="stat-separator">•</div>
          <div className="totw-stat-compact">
            <span className="stat-value">{averagePoints.toFixed(1)}</span>
            <span className="stat-label">Avg</span>
          </div>
          <div className="stat-separator">•</div>
          <div className="totw-stat-compact">
            <span className="stat-value">{bestEleven.formation}</span>
            <span className="stat-label">Formation</span>
          </div>
        </div>
      </div>

      <div className="football-pitch">
        {/* Forwards */}
        <div className={`formation-line forwards forwards-${bestEleven.fwd.length}`}>
          {bestEleven.fwd.map((player, index) => (
            <div key={`fwd-${index}`} className="player-position">
              <FifaCard 
                player={player} 
                onClick={() => onPlayerClick(player)}
              />
            </div>
          ))}
        </div>

        {/* Midfielders */}
        <div className={`formation-line midfielders midfielders-${bestEleven.mid.length}`}>
          {bestEleven.mid.map((player, index) => (
            <div key={`mid-${index}`} className="player-position">
              <FifaCard 
                player={player} 
                onClick={() => onPlayerClick(player)}
              />
            </div>
          ))}
        </div>

        {/* Defenders */}
        <div className={`formation-line defenders defenders-${bestEleven.def.length}`}>
          {bestEleven.def.map((player, index) => (
            <div key={`def-${index}`} className="player-position">
              <FifaCard 
                player={player} 
                onClick={() => onPlayerClick(player)}
              />
            </div>
          ))}
        </div>

        {/* Goalkeeper */}
        <div className="formation-line goalkeeper">
          {bestEleven.gkp.map((player, index) => (
            <div key={`gkp-${index}`} className="player-position">
              <FifaCard 
                player={player} 
                onClick={() => onPlayerClick(player)}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="formation-label">
        <span>{bestEleven.formation} Formation (Optimized for Max Points)</span>
      </div>
    </div>
  )
}

export default TeamOfTheWeek
