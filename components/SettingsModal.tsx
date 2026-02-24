import React from 'react';
import { X, Moon, Sun, Save } from 'lucide-react';
import { AppSettings } from '../types';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSave: (settings: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, settings, onSave }) => {
  const [tempSettings, setTempSettings] = React.useState(settings);
  const [activeTab, setActiveTab] = React.useState('Geral');

  React.useEffect(() => {
    setTempSettings(settings);
  }, [settings, isOpen]);

  if (!isOpen) return null;

  const tabs = ['Geral', 'Personalização', 'Fala', 'Controles de dados', 'Builder profile', 'Segurança'];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#2f2f2f] w-full max-w-[800px] h-[500px] rounded-xl shadow-2xl border border-[#424242] flex overflow-hidden text-[#ececec]">
        
        {/* Sidebar Tabs */}
        <div className="w-1/3 bg-[#212121] border-r border-[#333] p-3 flex flex-col gap-1">
            <h2 className="text-lg font-semibold px-3 py-3 mb-2">Configurações</h2>
            {tabs.map(tab => (
                <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-2 rounded-lg text-sm text-left transition-colors ${activeTab === tab ? 'bg-[#2f2f2f] text-white' : 'text-[#b4b4b4] hover:bg-[#2f2f2f]'}`}
                >
                    {tab}
                </button>
            ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col relative">
            <div className="absolute top-4 right-4">
                 <button onClick={onClose} className="p-1 hover:bg-[#424242] rounded-lg transition-colors text-[#b4b4b4]">
                    <X size={20} />
                 </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 pt-16 space-y-8">
                {activeTab === 'Geral' && (
                    <div className="space-y-6">
                        <div className="flex items-center justify-between pb-4 border-b border-[#424242]">
                             <label className="text-sm font-medium">Tema</label>
                             <div className="bg-[#212121] border border-[#424242] rounded px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed">
                                 Escuro
                             </div>
                        </div>
                        <div className="flex flex-col gap-2 pb-4 border-b border-[#424242]">
                             <div className="flex items-center justify-between">
                                <label className="text-sm font-medium">Modelo Padrão</label>
                                <div className="bg-[#212121] border border-[#424242] rounded px-3 py-1.5 text-sm text-gray-400 cursor-not-allowed min-w-[120px] text-center">
                                    ZDB 1.0
                                </div>
                             </div>
                        </div>
                        
                         <div className="flex flex-col gap-2">
                             <div className="flex justify-between items-center">
                                <label className="text-sm font-medium">Instrução do Sistema (System Prompt)</label>
                                <span className="text-xs text-[#b4b4b4]">{tempSettings.systemInstruction?.length || 0}/2000</span>
                             </div>
                             <textarea 
                                value={tempSettings.systemInstruction}
                                onChange={(e) => {
                                    if (e.target.value.length <= 2000) {
                                        setTempSettings({...tempSettings, systemInstruction: e.target.value});
                                    }
                                }}
                                className="bg-[#212121] border border-[#424242] rounded p-2 text-sm focus:outline-none focus:border-gray-500 min-h-[120px] resize-none"
                                placeholder="Digite as instruções para a IA..."
                             />
                             <p className="text-xs text-[#b4b4b4]">
                                Defina como a IA deve se comportar. As alterações serão aplicadas nas próximas mensagens.
                             </p>
                        </div>
                    </div>
                )}
                {activeTab !== 'Geral' && (
                    <div className="flex items-center justify-center h-full text-[#b4b4b4] text-sm">
                        Opções de {activeTab} em breve.
                    </div>
                )}
            </div>
            
            <div className="p-4 border-t border-[#424242] flex justify-end">
                <button 
                    onClick={() => {
                        onSave(tempSettings);
                        onClose();
                    }} 
                    className="px-4 py-2 bg-white text-black rounded-full text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    Salvar
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};