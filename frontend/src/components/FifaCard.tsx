import React, { useState, useEffect } from 'react'

interface Player {
  name: string
  team: string
  position: string
  predicted_points: number
  now_cost: number
  imageSources?: string[]
  currentImageIndex?: number
  imageError?: boolean
  player_code?: number
}

interface FifaCardProps {
  player: Player
  onClick: () => void
}

const FifaCard: React.FC<FifaCardProps> = ({ player, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [imageLoading, setImageLoading] = useState(true)
  const [allImagesFailed, setAllImagesFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const imageSources = player.imageSources || []

  // Reset state when player changes and preload image
  useEffect(() => {
    setCurrentImageIndex(0)
    setImageLoading(true)
    setAllImagesFailed(false)
    setImageLoaded(false)

    // Preload the first image to reduce flash
    if (imageSources.length > 0) {
      const firstImage = new Image()
      firstImage.onload = () => setImageLoaded(true)
      firstImage.onerror = () => {
        // If first image fails, try next one
        if (imageSources.length > 1) {
          setCurrentImageIndex(1)
          setImageLoading(true)
        } else {
          setAllImagesFailed(true)
          setImageLoading(false)
        }
      }
      firstImage.src = imageSources[0]
    }
  }, [player.name, imageSources])

  const handleImageLoad = () => {
    setImageLoading(false)
    setImageLoaded(true)
  }

  const handleImageError = () => {
    console.log(`Image failed for ${player.name}, trying next source...`, {
      currentIndex: currentImageIndex,
      totalSources: imageSources.length,
      failedUrl: imageSources[currentImageIndex]
    })

    // Try next image source
    if (currentImageIndex < imageSources.length - 1) {
      setCurrentImageIndex(prev => prev + 1)
      setImageLoading(true)
    } else {
      // All images failed, show placeholder
      setAllImagesFailed(true)
      setImageLoading(false)
    }
  }

  const getCurrentImageUrl = () => {
    return imageSources[currentImageIndex] || ''
  }

  const getPositionColor = (position: string) => {
    switch (position) {
      case 'GKP': return '#f56565' // Red
      case 'DEF': return '#38a169' // Green
      case 'MID': return '#3182ce' // Blue
      case 'FWD': return '#d69e2e' // Gold
      default: return '#718096'    // Gray
    }
  }

  const shouldShowImage = imageSources.length > 0 && !allImagesFailed
  const currentImageUrl = getCurrentImageUrl()

  return (
    <div
      className="fifa-card"
      onClick={onClick}
    >
      <div className="fifa-player-image" style={{ position: 'relative' }}>
        {shouldShowImage && currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt={player.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                borderRadius: '8px',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.3s ease-in-out'
              }}
            />
            {!imageLoaded && (
              <div className="fifa-placeholder" style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: getPositionColor(player.position),
                color: 'white',
                fontSize: '14px',
                fontWeight: 'bold'
              }}>
                <span>{player.position}</span>
              </div>
            )}
          </>
        ) : (
          <div
            className="fifa-placeholder"
            style={{
              display: 'flex',
              backgroundColor: getPositionColor(player.position),
              color: 'white',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            <span>{player.position}</span>
          </div>
        )}

        {/* Debug info - remove in production */}
        {imageSources.length > 0 && (
          <div style={{
            position: 'absolute',
            bottom: '2px',
            left: '2px',
            fontSize: '8px',
            opacity: 0.7,
            background: 'rgba(0,0,0,0.5)',
            color: 'white',
            padding: '1px 3px',
            borderRadius: '2px'
          }}>
            {allImagesFailed ? 'No img' : `${currentImageIndex + 1}/${imageSources.length}`}
          </div>
        )}
      </div>

      <div className="fifa-player-info">
        <div className="fifa-player-name">{player.name}</div>
        <div className="fifa-stats">
          <div className="fifa-stat">
            <span className="fifa-stat-label">Predicted Points</span>
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
