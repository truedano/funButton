import React from 'react';
import { KeyConfig } from '../types';
import { MousePointerClick } from 'lucide-react';

interface KeyButtonProps {
  config: KeyConfig;
  onClick: (config: KeyConfig) => void;
  disabled?: boolean;
}

const KeyButton: React.FC<KeyButtonProps> = ({ config, onClick, disabled }) => {
  const getColorStyles = (color: string) => {
    switch (color) {
      case 'yellow':
        return "bg-[#F3E388] border-[#DNC666] text-black";
      case 'blue':
        return "bg-[#A7C7E7] border-[#86A6C6] text-black";
      case 'red':
        return "bg-[#FFB7B2] border-[#DF9792] text-black";
      case 'white':
      default:
        return "bg-[#F0F4F8] border-[#CED4DA] text-black";
    }
  };

  // Styles mimic a high-profile mechanical keycap with 3D depth
  const baseStyles = "relative w-full aspect-square rounded-xl transition-all duration-100 flex items-center justify-center select-none group active:scale-[0.98]";
  
  // 3D effect using box-shadow and translation
  const shadowStyles = "shadow-[0_8px_0_rgb(0,0,0,0.15)] active:shadow-none active:translate-y-[8px]";

  return (
    <button
      className={`${baseStyles} ${getColorStyles(config.color)} ${shadowStyles} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      onClick={() => !disabled && onClick(config)}
      disabled={disabled}
    >
      {/* Keycap Surface Texture/Sheen */}
      <div className="absolute inset-2 rounded-lg bg-gradient-to-br from-white/40 to-transparent pointer-events-none opacity-50" />
      
      {/* Text Content */}
      <div className="relative z-10 text-center font-bold text-lg sm:text-xl leading-tight whitespace-pre-line tracking-tight px-1 break-words w-full overflow-hidden">
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