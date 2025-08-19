import React from 'react'

interface Player {
  name: string
  team: string
  position: string
  predicted_points: number
  now_cost: number
  image_url?: string
}

interface FifaCardProps {
  player: Player
  onClick: () => void
}

const FifaCard: React.FC<FifaCardProps> = ({ player, onClick }) => {
  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GKP': return '#f56565' // Red
      case 'DEF': return '#38a169' // Green  
      case 'MID': return '#3182ce' // Blue
      case 'FWD': return '#d69e2e' // Gold
      default: return '#718096'    // Gray
    }
  }

  const getOverallRating = (points: number) => {
    // Convert predicted points to FIFA-style rating (50-99)
    const rating = Math.min(99, Math.max(50, Math.round(50 + (points * 4))))
    return rating
  }

  return (
    <div 
      className="fifa-card" 
      onClick={onClick}
    >
      <div className="fifa-player-image">
        {player.image_url ? (
          <img 
            src={player.image_url} 
            alt={player.name}
            onError={(e) => {
              e.currentTarget.style.display = 'none'
              e.currentTarget.nextElementSibling!.style.display = 'flex'
            }}
          />
        ) : null}
        <div className="fifa-placeholder" style={{ display: player.image_url ? 'none' : 'flex' }}>
          <span>⚽</span>
        </div>
      </div>
      
      <div className="fifa-player-info">
        <div className="fifa-player-name">{player.name}</div>
        <div className="fifa-stats">
          <div className="fifa-stat">
            <span className="fifa-stat-label">Points</span>
            <span className="fifa-stat-value">{player.predicted_points.toFixed(1)}</span>
          </div>
          <div className="fifa-stat">
            <span className="fifa-stat-label">Price</span>
            <span className="fifa-stat-value">£{player.now_cost.toFixed(1)}m</span>
          </div>
        </div>
      </div>
      
      <div className="fifa-shine"></div>
    </div>
  )
}

export default FifaCard
