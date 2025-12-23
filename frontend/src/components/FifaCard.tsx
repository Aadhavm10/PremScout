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

// Determine card rarity based on predicted points
const getCardRarity = (points: number): 'special' | 'gold' | 'silver' | 'bronze' => {
  if (points >= 8) return 'special'
  if (points >= 6) return 'gold'
  if (points >= 4) return 'silver'
  return 'bronze'
}

const rarityStyles = {
  special: {
    bg: 'bg-gradient-to-br from-purple-900 via-fuchsia-900 to-purple-900',
    border: 'border-purple-400/50',
    glow: 'shadow-[0_0_30px_rgba(168,85,247,0.4)]',
    text: 'text-purple-300',
    pointsColor: 'text-purple-200',
  },
  gold: {
    bg: 'bg-gradient-to-br from-yellow-900 via-amber-900 to-yellow-900',
    border: 'border-amber-400/50',
    glow: 'shadow-[0_0_20px_rgba(251,191,36,0.3)]',
    text: 'text-amber-300',
    pointsColor: 'text-amber-200',
  },
  silver: {
    bg: 'bg-gradient-to-br from-slate-700 via-slate-600 to-slate-700',
    border: 'border-slate-400/50',
    glow: 'shadow-[0_0_15px_rgba(148,163,184,0.2)]',
    text: 'text-slate-300',
    pointsColor: 'text-slate-200',
  },
  bronze: {
    bg: 'bg-gradient-to-br from-orange-950 via-stone-900 to-orange-950',
    border: 'border-orange-700/50',
    glow: 'shadow-[0_0_10px_rgba(234,88,12,0.2)]',
    text: 'text-orange-400',
    pointsColor: 'text-orange-300',
  },
}

const getPositionColor = (position: string) => {
  switch (position) {
    case 'GKP': return 'bg-red-600'
    case 'DEF': return 'bg-green-600'
    case 'MID': return 'bg-blue-600'
    case 'FWD': return 'bg-amber-600'
    default: return 'bg-gray-600'
  }
}

const FifaCard: React.FC<FifaCardProps> = ({ player, onClick }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [allImagesFailed, setAllImagesFailed] = useState(false)
  const [imageLoaded, setImageLoaded] = useState(false)

  const imageSources = player.imageSources || []
  const rarity = getCardRarity(player.predicted_points)
  const rarityStyle = rarityStyles[rarity]

  // Reset state when player changes and preload image
  useEffect(() => {
    setCurrentImageIndex(0)
    setAllImagesFailed(false)
    setImageLoaded(false)

    // Preload the first image
    if (imageSources.length > 0) {
      const firstImage = new Image()
      firstImage.onload = () => setImageLoaded(true)
      firstImage.onerror = () => {
        if (imageSources.length > 1) {
          setCurrentImageIndex(1)
        } else {
          setAllImagesFailed(true)
        }
      }
      firstImage.src = imageSources[0]
    }
  }, [player.name, imageSources])

  const handleImageLoad = () => {
    setImageLoaded(true)
  }

  const handleImageError = () => {
    // Try next image source
    if (currentImageIndex < imageSources.length - 1) {
      setCurrentImageIndex(prev => prev + 1)
    } else {
      setAllImagesFailed(true)
    }
  }

  const getCurrentImageUrl = () => {
    return imageSources[currentImageIndex] || ''
  }

  const shouldShowImage = imageSources.length > 0 && !allImagesFailed
  const currentImageUrl = getCurrentImageUrl()

  return (
    <div
      onClick={onClick}
      className={`
        group relative w-40 h-56 cursor-pointer rounded-2xl p-3
        border-2 backdrop-blur-sm
        transition-all duration-300 ease-out
        hover:scale-105 hover:-translate-y-2 hover:rotate-1
        ${rarityStyle.bg}
        ${rarityStyle.border}
        ${rarityStyle.glow}
        md:w-36 md:h-52
        sm:w-32 sm:h-48
      `}
    >
      {/* Shine effect on hover */}
      <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-tr from-transparent via-white/10 to-transparent pointer-events-none" />

      {/* Player Image */}
      <div className="relative h-32 mb-2 flex items-center justify-center overflow-hidden rounded-xl">
        {shouldShowImage && currentImageUrl ? (
          <>
            <img
              src={currentImageUrl}
              alt={player.name}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className="max-w-full max-h-full object-contain rounded-lg transition-opacity duration-300"
              style={{ opacity: imageLoaded ? 1 : 0 }}
            />
            {!imageLoaded && (
              <div className={`absolute inset-0 flex items-center justify-center ${getPositionColor(player.position)} text-white text-sm font-bold rounded-lg`}>
                <span>{player.position}</span>
              </div>
            )}
          </>
        ) : (
          <div className={`w-full h-full flex items-center justify-center ${getPositionColor(player.position)} text-white text-sm font-bold rounded-lg`}>
            <span>{player.position}</span>
          </div>
        )}
      </div>

      {/* Player Info */}
      <div className="relative z-10 space-y-1">
        <div className={`text-xs font-bold uppercase truncate text-center ${rarityStyle.text}`}>
          {player.name}
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/70">Pred Pts</span>
            <span className={`font-bold font-mono ${rarityStyle.pointsColor}`}>
              {player.predicted_points.toFixed(1)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-white/70">Price</span>
            <span className={`font-semibold font-mono ${rarityStyle.text}`}>
              £{player.now_cost.toFixed(1)}m
            </span>
          </div>
        </div>
      </div>

      {/* Rarity Badge - top right corner */}
      <div className="absolute top-2 right-2 opacity-60">
        <div className={`w-2 h-2 rounded-full ${rarityStyle.border.replace('border-', 'bg-')}`} />
      </div>
    </div>
  )
}

export default FifaCard
