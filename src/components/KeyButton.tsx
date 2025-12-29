import React from 'react';
import { KeyConfig } from '../types';
import { MousePointerClick } from 'lucide-react';
import { getDarkerColor, getContrastingTextColor, isValidColor } from '../utils/colorUtils';
import { playClickSound } from '../utils/audio';

interface KeyButtonProps {
  config: KeyConfig;
  onClick: (config: KeyConfig) => void;
  disabled?: boolean;
  isSelected?: boolean;
  isActive?: boolean;
}

const KeyButton: React.FC<KeyButtonProps> = ({ config, onClick, disabled, isSelected, isActive }) => {
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
  const baseStyles = "relative w-full aspect-square rounded-xl transition-all duration-100 flex items-center justify-center select-none group active:scale-[0.98] border-b-4 border-r-2 border-l border-t";

  // 3D effect using box-shadow and translation - adjusted to work with real borders
  const shadowStyles = "shadow-[0_4px_0_rgba(0,0,0,0.1)] active:shadow-none active:translate-y-[4px]";

  return (
    <button
      className={`${baseStyles} ${getPredefinedClassNames(config.color)} ${shadowStyles} ${disabled ? 'opacity-50 cursor-not-allowed' : ''} ${isSelected ? 'ring-4 ring-blue-400 ring-offset-4 scale-105' : ''} ${isActive ? 'animate-pulse' : ''}`}
      style={!isPredefinedColor ? getDynamicStyles() : {}}
      onClick={() => !disabled && onClick(config)}
      onPointerDown={() => !disabled && playClickSound()}
      disabled={disabled}
    >
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

      {/* Keycap Surface Texture/Sheen */}
      <div className="absolute inset-2 rounded-lg bg-gradient-to-br from-white/40 to-transparent pointer-events-none opacity-50 z-[1]" />

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