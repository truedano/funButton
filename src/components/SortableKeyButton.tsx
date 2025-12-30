import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import KeyButton from './KeyButton';
import { KeyConfig, SoundType } from '../types';

interface SortableKeyButtonProps {
    id: string;
    config: KeyConfig;
    onClick: (config: KeyConfig) => void;
    isSelected: boolean;
    isActive: boolean;
    disabled?: boolean;
    isEditing: boolean;
    soundType?: SoundType;
}

const SortableKeyButton: React.FC<SortableKeyButtonProps> = ({
    id,
    config,
    onClick,
    isSelected,
    isActive,
    disabled,
    isEditing,
    soundType
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id,
        disabled: !isEditing // Only enable sortable features in edit mode
    });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
        touchAction: 'none', // Prevents browser scrolling while dragging
        zIndex: isDragging ? 999 : 'auto',
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="h-full w-full relative">
            <KeyButton
                config={config}
                onClick={onClick}
                isSelected={isSelected}
                isActive={isActive}
                disabled={disabled}
                soundType={soundType}
            />
            {/* Overlay hint for long-press in edit mode? Maybe not needed if behavior is intuitive */}
        </div>
    );
};

export default SortableKeyButton;
