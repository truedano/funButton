import React from 'react';
import { KeyConfig, SoundType, GlowType } from '../types';
import { MousePointerClick } from 'lucide-react';
import { getDarkerColor, getContrastingTextColor, isValidColor } from '../utils/colorUtils';
import { playClickSound, playKeyboardSound } from '../utils/audio';

interface KeyButtonProps {
  config: KeyConfig;
  onClick: (config: KeyConfig) => void;
  disabled?: boolean;
  isSelected?: boolean;
  isActive?: boolean;
  progress?: number;
  soundType?: SoundType;
  glowType?: GlowType;
}

const KeyButton: React.FC<KeyButtonProps> = ({ config, onClick, disabled, isSelected, isActive, progress, soundType, glowType = 'none' }) => {
  const [isPressed, setIsPressed] = React.useState(false);
  const isPredefinedColor = ['white', 'yellow', 'blue', 'red', 'green', 'purple', 'orange'].includes(config.color);

  const getDynamicStyles = () => {
    if (isPredefinedColor) return {};

    // For custom hex codes, we generate the styles dynamically
    const bgColor = config.color;
    const borderColor = getDarkerColor(bgColor);
    const textColor = getContrastingTextColor(bgColor);

    return {
      backgroundColor: bgColor,
      borderColor: borderColor,
      color: textColor,
    };
  };

  const getPredefinedClassNames = (color: string) => {
    switch (color) {
      case 'yellow': return "bg-[#F3E388] border-[#D1C266] text-black";
      case 'blue': return "bg-[#A7C7E7] border-[#86A6C6] text-black";
      case 'red': return "bg-[#FFB7B2] border-[#DF9792] text-black";
      case 'green': return "bg-[#B4E4B4] border-[#94C494] text-black";
      case 'purple': return "bg-[#D1C4E9] border-[#B1A4C9] text-black";
      case 'orange': return "bg-[#FFCCBC] border-[#DFAC9C] text-black";
      case 'white': return "bg-[#F0F4F8] border-[#CED4DA] text-black";
      default: return ""; // Custom colors will use inline styles instead
    }
  };

  // Styles mimic a high-profile mechanical keycap with 3D depth
  const baseStyles = "relative w-full aspect-square rounded-xl transition-all duration-100 flex items-center justify-center select-none group active:scale-[0.98] border-b-4 border-r-2 border-l border-t overflow-hidden";

  // 3D effect using box-shadow and translation - adjusted to work with real borders
  const shadowStyles = "shadow-[0_4px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[4px]";

  const getGlowColor = () => {
    if (isPredefinedColor) {
      switch (config.color) {
        case 'yellow': return '#F3E388';
        case 'blue': return '#A7C7E7';
        case 'red': return '#FFB7B2';
        case 'green': return '#B4E4B4';
        case 'purple': return '#D1C4E9';
        case 'orange': return '#FFCCBC';
        default: return '#F0F4F8';
      }
    }
    return config.color;
  };

  const glowColor = getGlowColor();

  const getGlowStyles = () => {
    if (disabled) return {};

    switch (glowType) {
      case 'backlit':
        return {
          // Inner core glow (white) + outer color glow
          '--glow-shadow': `inset 0 0 15px white, inset 0 0 30px ${glowColor}, inset 0 0 50px ${glowColor}80`,
        };
      case 'bloom':
        return {
          '--glow-filter': `brightness(1.3) drop-shadow(0 0 15px ${glowColor}) drop-shadow(0 0 5px white)`,
        };
      case 'surface':
        return {
          '--glow-sheen': '1',
        };
      case 'aura':
        return {
          '--glow-aura': '1',
        };
      default:
        return {};
    }
  };

  return (
    <button
      className={`${baseStyles} ${getPredefinedClassNames(config.color)} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isSelected ? 'ring-4 ring-blue-400 ring-offset-4 scale-105' : ''} ${isActive ? 'translate-y-[2px] shadow-none ring-2 ring-white/50' : shadowStyles}`}
      style={{
        ...(!isPredefinedColor ? getDynamicStyles() : {}),
        ...(config.textColor ? { color: config.textColor } : {}),
        ...((isPressed || isActive) && !disabled ? getGlowStyles() : {}),
        // Fix intensity: use box-shadow with multiple layers
        ...((isPressed || isActive) && !disabled && glowType === 'backlit' ? { boxShadow: `var(--glow-shadow, none)`, border: `1px solid rgba(255,255,255,0.5)` } : {}),
        ...((isPressed || isActive) && !disabled && glowType === 'bloom' ? { filter: `var(--glow-filter, none)` } : {})
      }}
      onClick={() => !disabled && onClick(config)}
      onPointerDown={() => {
        if (!disabled) {
          setIsPressed(true);
          if (soundType === 'keyboard') {
            playKeyboardSound();
          } else {
            playClickSound();
          }
        }
      }}
      onPointerUp={() => setIsPressed(false)}
      onPointerLeave={() => setIsPressed(false)}
      disabled={disabled}
    >
      {/* Progress Bar Overlay - Bottom layer of content */}
      {isActive && progress !== undefined && (
        <div
          className="absolute left-0 top-0 bottom-0 bg-green-500/30 pointer-events-none z-[5]"
          style={{
            width: `${progress}%`,
            transition: progress === 0 ? 'none' : 'width 100ms linear'
          }}
        />
      )}

      {/* Glow Aura (Bottom Layer) */}
      {glowType === 'aura' && (
        <div
          className="absolute -inset-4 rounded-full blur-2xl opacity-0 transition-all duration-75 pointer-events-none"
          style={{
            backgroundColor: glowColor,
            opacity: (isPressed || isActive) ? 0.7 : 0,
            transform: (isPressed || isActive) ? 'scale(1.1)' : 'scale(0.9)'
          }}
        />
      )}

      {/* Selection Glow */}
      {isSelected && (
        <div className="absolute -inset-2 rounded-2xl bg-blue-400/20 blur-xl animate-pulse pointer-events-none" />
      )}


      {/* Image Texture (Top Layer Sticker) */}
      {config.imageUrl && (
        <div
          className="absolute inset-[4px] rounded-[10px] bg-cover bg-center pointer-events-none opacity-90 mixing-blend-multiply"
          style={{ backgroundImage: `url(${config.imageUrl})` }}
        />
      )}

      {/* Surface Glow Overlay (Specific for Surface effect) */}
      {glowType === 'surface' && (
        <div
          className="absolute inset-1 rounded-lg bg-white/40 blur-[2px] opacity-0 transition-opacity duration-75 z-[2] pointer-events-none"
          style={{ opacity: (isPressed || isActive) ? 0.8 : 0 }}
        />
      )}

      {/* Backlit Rim Glow (Specific for Backlit effect) */}
      {glowType === 'backlit' && (isPressed || isActive) && (
        <div className="absolute inset-0 rounded-xl border-2 border-white/80 blur-[1px] z-[2] pointer-events-none animate-pulse" />
      )}

      {/* Keycap Surface Texture/Sheen */}
      <div
        className="absolute inset-2 rounded-lg bg-gradient-to-br from-white/80 to-transparent pointer-events-none transition-all duration-100 z-[1]"
        style={{
          opacity: (isPressed || isActive) ? (glowType === 'surface' ? 1 : 0.7) : 0.4,
          filter: glowType === 'surface' && (isPressed || isActive) ? 'brightness(1.8) contrast(1.2)' : 'none'
        }}
      />

      {/* Text Content */}
      <div
        className="relative z-10 text-center font-bold text-lg sm:text-xl leading-tight whitespace-pre-line tracking-tight px-1 break-words w-full overflow-hidden"
        style={config.imageUrl ? { textShadow: '0 1px 3px rgba(0,0,0,0.8), 0 0 2px rgba(255,255,255,0.5)' } : {}}
      >
        {config.text}
      </div>

      {/* Hover Hint Icon */}
      <div className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-30 transition-opacity pointer-events-none">
        <MousePointerClick size={16} />
      </div>
    </button>
  );
};

export default KeyButton;