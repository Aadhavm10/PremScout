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

  const stats = [
    { label: 'Total Points', value: totalPoints.toFixed(1) },
    { label: 'Team Cost', value: `£${totalCost.toFixed(1)}m` },
    { label: 'Avg Points', value: averagePoints.toFixed(1) },
    { label: 'Formation', value: bestEleven.formation },
  ]

  return (
    <div className="relative mb-8 w-full overflow-hidden py-12">
      {/* Pitch Background Image */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-30"
        style={{ backgroundImage: 'url(/FplPitch.jpg)' }}
      />
      {/* Dark overlay for better contrast */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-slate-950/80" />

      <div className="relative z-10 mx-auto w-full px-4">
        {/* Stats Display */}
        <div className="mb-12 flex flex-wrap items-center justify-center gap-4">
          {stats.map((stat, index) => (
            <div
              key={index}
              className="group relative overflow-hidden rounded-2xl border border-primary-400/30 bg-slate-800/50 px-6 py-4 backdrop-blur-xl transition-all hover:scale-105 hover:border-primary-400/50 hover:shadow-xl hover:shadow-primary-500/20"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-primary-500/5 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
              <div className="relative">
                <div className="font-mono text-3xl font-bold text-primary-300">
                  {stat.value}
                </div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wider text-text-tertiary">
                  {stat.label}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Formation Display */}
        <div className="space-y-8">
          {/* Forwards */}
          <div className={`flex items-center justify-center gap-4 ${bestEleven.fwd.length === 1 ? 'gap-0' : bestEleven.fwd.length === 2 ? 'gap-8' : 'gap-4'}`}>
            {bestEleven.fwd.map((player, index) => (
              <div key={`fwd-${index}`} className="animate-float" style={{ animationDelay: `${index * 100}ms` }}>
                <FifaCard
                  player={player}
                  onClick={() => onPlayerClick(player)}
                />
              </div>
            ))}
          </div>

          {/* Midfielders */}
          <div className={`flex items-center justify-center gap-4 ${bestEleven.mid.length >= 5 ? 'gap-2' : 'gap-4'}`}>
            {bestEleven.mid.map((player, index) => (
              <div key={`mid-${index}`} className="animate-float" style={{ animationDelay: `${(index + bestEleven.fwd.length) * 100}ms` }}>
                <FifaCard
                  player={player}
                  onClick={() => onPlayerClick(player)}
                />
              </div>
            ))}
          </div>

          {/* Defenders */}
          <div className={`flex items-center justify-center gap-4 ${bestEleven.def.length >= 5 ? 'gap-2' : 'gap-4'}`}>
            {bestEleven.def.map((player, index) => (
              <div key={`def-${index}`} className="animate-float" style={{ animationDelay: `${(index + bestEleven.fwd.length + bestEleven.mid.length) * 100}ms` }}>
                <FifaCard
                  player={player}
                  onClick={() => onPlayerClick(player)}
                />
              </div>
            ))}
          </div>

          {/* Goalkeeper */}
          <div className="flex items-center justify-center">
            {bestEleven.gkp.map((player, index) => (
              <div key={`gkp-${index}`} className="animate-float" style={{ animationDelay: `${(bestEleven.fwd.length + bestEleven.mid.length + bestEleven.def.length) * 100}ms` }}>
                <FifaCard
                  player={player}
                  onClick={() => onPlayerClick(player)}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Formation Label */}
        <div className="mt-8 text-center">
          <span className="inline-block rounded-full border border-primary-400/30 bg-slate-800/50 px-6 py-2 text-sm font-medium text-text-secondary backdrop-blur-xl">
            {bestEleven.formation} Formation (Optimized for Max Points)
          </span>
        </div>
      </div>
    </div>
  )
}

export default TeamOfTheWeek
