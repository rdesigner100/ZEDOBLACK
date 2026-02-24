import React from 'react';
import { X, ExternalLink, Globe } from 'lucide-react';
import { GroundingMetadata } from '../types';

interface SourceSidebarProps {
  metadata: GroundingMetadata | null;
  isOpen: boolean;
  onClose: () => void;
}

export const SourceSidebar: React.FC<SourceSidebarProps> = ({ metadata, isOpen, onClose }) => {
  if (!isOpen) return null;

  const sources = metadata?.groundingChunks?.map((chunk, index) => {
    if (chunk.web) {
      return {
        id: index,
        title: chunk.web.title,
        uri: chunk.web.uri,
        type: 'web'
      };
    }
    return null;
  }).filter(Boolean) || [];

  return (
    <div className="fixed inset-y-0 right-0 w-full md:w-80 bg-[#1a1a1a] border-l border-[#333] shadow-xl z-50 flex flex-col">
      <div className="flex items-center justify-between p-4 border-b border-[#333]">
        <h3 className="text-lg font-semibold text-white">Fontes</h3>
        <button onClick={onClose} className="p-1 hover:bg-[#333] rounded-full text-gray-400 hover:text-white">
          <X size={20} />
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1">
        {sources.length === 0 ? (
          <p className="text-gray-400 text-sm">Nenhuma fonte encontrada.</p>
        ) : (
          <div className="space-y-3">
            {sources.map((source: any) => (
              <a 
                key={source.id} 
                href={source.uri} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-3 bg-[#262626] rounded-lg hover:bg-[#333] transition-colors group"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-1 p-1.5 bg-[#333] rounded text-blue-400 group-hover:text-blue-300">
                    <Globe size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-gray-200 line-clamp-2 group-hover:text-white">
                      {source.title}
                    </h4>
                    <p className="text-xs text-gray-500 mt-1 truncate flex items-center gap-1">
                      {new URL(source.uri).hostname}
                      <ExternalLink size={10} />
                    </p>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
