import React from 'react';
import { X } from 'lucide-react';

interface LightboxProps {
  isOpen: boolean;
  imageSrc: string | null;
  onClose: () => void;
}

export const Lightbox: React.FC<LightboxProps> = ({ isOpen, imageSrc, onClose }) => {
  if (!isOpen || !imageSrc) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <button 
        onClick={onClose}
        className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 rounded-full transition-colors"
      >
        <X size={32} />
      </button>
      
      <img 
        src={imageSrc} 
        alt="Full size preview" 
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()} // Prevent closing when clicking the image
      />
    </div>
  );
};
