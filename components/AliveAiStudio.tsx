import React, { useState, useEffect } from 'react';
import { X, Infinity, Image as ImageIcon, Loader2, Send, Download, User, Palette, ScanFace, ChevronDown, ChevronUp, Menu } from 'lucide-react';
import { aliveAiService } from '../services/aliveAiService';
import { Attachment } from '../types';
import { POSES_DATA } from '../posesData';

interface AliveAiStudioProps {
  isOpen: boolean;
  onClose: () => void;
  onSendToChat: (attachment: Attachment, text?: string) => void;
  onOpenSidebar?: () => void;
  isMobile?: boolean;
}

const MODELS = [
    { id: 'DEFAULT', name: 'Padrão (Default)' },
    { id: 'REALISM', name: 'Realismo' },
    { id: 'ANIME', name: 'Anime' },
    // { id: 'TEMPORARY', name: 'Temporary' }, // Probably not for user selection
];

const GENDERS = [
    { id: 'FEMALE', name: 'Feminino' },
    { id: 'MALE', name: 'Masculino' },
    { id: 'TRANS', name: 'Trans' },
];

export const AliveAiStudio: React.FC<AliveAiStudioProps> = ({ isOpen, onClose, onSendToChat, onOpenSidebar, isMobile }) => {
  const [prompt, setPrompt] = useState('');
  const [name, setName] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  
  // Resources
  const [faces, setFaces] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [poses, setPoses] = useState<any>({});
  
  // Selections
  const [selectedFace, setSelectedFace] = useState<string>('');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [selectedModel, setSelectedModel] = useState<string>('DEFAULT');
  const [selectedGender, setSelectedGender] = useState<string>('FEMALE');
  const [aspectRatio, setAspectRatio] = useState<'SQUARE' | 'PORTRAIT' | 'LANDSCAPE'>('SQUARE');
  
  // Pose Selection
  const [selectedPose, setSelectedPose] = useState<{ id: string, type: string, image: string } | null>(null);
  const [poseStrength, setPoseStrength] = useState(30);
  const [expandedPoseCategory, setExpandedPoseCategory] = useState<string | null>('posesStanding');

  const [statusMessage, setStatusMessage] = useState('');
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadResources();
    }
  }, [isOpen]);

  const loadResources = async () => {
    try {
      // Load resources independently to prevent one failure from blocking others
      const facesPromise = aliveAiService.getFaces().catch(e => {
          console.error("Failed to load faces:", e);
          return [];
      });
      
      const templatesPromise = aliveAiService.getTemplates().catch(e => {
          console.error("Failed to load templates:", e);
          return [];
      });

      const posesPromise = aliveAiService.getPoses().catch(e => {
          console.error("Failed to load poses:", e);
          return {};
      });

      const [loadedFaces, loadedTemplates, loadedPoses] = await Promise.all([
        facesPromise,
        templatesPromise,
        posesPromise
      ]);

      setFaces(loadedFaces);
      setTemplates(loadedTemplates);
      
      // Get token for image proxy
      const activeToken = await aliveAiService.getToken();
      setToken(activeToken);
      
      // Normalize poses data and merge with hardcoded POSES_DATA
      let finalPoses: any = { ...POSES_DATA };

      if (Array.isArray(loadedPoses)) {
          console.log("Poses received as array, normalizing...");
          loadedPoses.forEach((p: any) => {
              const cat = p.category || 'posesStanding';
              if (!finalPoses[cat]) finalPoses[cat] = { type: p.type || 'POSE', poses: [] };
              
              // Only add if not already in hardcoded data (to avoid duplicates)
              const exists = finalPoses[cat].poses.some((hp: any) => hp.id === p.id);
              if (!exists) {
                  finalPoses[cat].poses.push(p);
              }
          });
      } else if (loadedPoses && typeof loadedPoses === 'object') {
          Object.keys(loadedPoses).forEach(key => {
              if (!finalPoses[key]) {
                  finalPoses[key] = loadedPoses[key];
              } else {
                  // Merge poses within category
                  loadedPoses[key].poses.forEach((p: any) => {
                      const exists = finalPoses[key].poses.some((hp: any) => hp.id === p.id);
                      if (!exists) finalPoses[key].poses.push(p);
                  });
              }
          });
      }
      
      setPoses(finalPoses);
    } catch (error: any) {
      console.error("Critical error loading AliveAI resources:", error);
      setStatusMessage(`Erro crítico ao carregar recursos: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim() || !name.trim()) {
        setStatusMessage('Nome e Aparência são obrigatórios.');
        return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);
    setStatusMessage('Iniciando geração...');

    const selectedFaceObj = faces.find(f => f.id === selectedFace);

    try {
      const promptId = await aliveAiService.generateCharacterImage({
        prompt, // Appearance
        name,
        gender: selectedGender,
        model: selectedModel,
        faceMediaIds: selectedFaceObj?.mediaIds,
        templateId: selectedTemplate || undefined,
        aspectRatio,
        pose: selectedPose ? {
            id: selectedPose.id,
            type: selectedPose.type,
            strength: poseStrength
        } : undefined
      });

      setStatusMessage('Processando imagem...');
      
      const pollInterval = setInterval(async () => {
        try {
          const statusData = await aliveAiService.getPromptStatus(promptId);
          console.log("Poll status:", statusData);
          
          if (statusData.status === 'COMPLETED' || statusData.status === 'SUCCESS' || (statusData.images && statusData.images.length > 0) || (statusData.medias && statusData.medias.length > 0)) {
             clearInterval(pollInterval);
             const imageUrl = statusData.url || (statusData.images && statusData.images[0]?.url) || statusData.resultUrl || (statusData.medias && statusData.medias[0]?.mediaUrl);
             
             if (imageUrl) {
                 setGeneratedImage(imageUrl);
                 setStatusMessage('Concluído!');
             } else {
                 setStatusMessage('Erro: Imagem não encontrada na resposta.');
             }
             setIsGenerating(false);
          } else if (statusData.status === 'FAILED') {
             clearInterval(pollInterval);
             setStatusMessage('Falha na geração.');
             setIsGenerating(false);
          }
        } catch (e) {
            console.error("Polling error", e);
        }
      }, 2000);

      setTimeout(() => {
          clearInterval(pollInterval);
          if (isGenerating) {
              setIsGenerating(false);
              setStatusMessage('Tempo limite excedido.');
          }
      }, 120000); 

    } catch (error) {
      console.error("Generation error:", error);
      setStatusMessage('Erro ao iniciar geração.');
      setIsGenerating(false);
    }
  };

  const handleSend = async () => {
    if (!generatedImage) return;

    try {
        const response = await fetch(generatedImage);
        const blob = await response.blob();
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64data = reader.result as string;
            const base64Raw = base64data.split(',')[1];
            
            const attachment: Attachment = {
                id: crypto.randomUUID(),
                type: 'image',
                mimeType: blob.type,
                data: base64Raw,
                name: `${name.replace(/\s+/g, '-').toLowerCase()}.png`
            };
            
            onSendToChat(attachment, `**Personagem:** ${name}\n**Modelo:** ${selectedModel}\n**Prompt:** ${prompt}`);
            onClose();
        };
        reader.readAsDataURL(blob);
    } catch (e) {
        console.error("Error preparing image for chat:", e);
        setStatusMessage("Erro ao enviar imagem.");
    }
  };

  if (!isOpen) return null;

  const renderPoseCategory = (key: string, label: string) => {
      const categoryData = poses[key];
      if (!categoryData || !categoryData.poses) return null;

      const isExpanded = expandedPoseCategory === key;
      
      const translatedLabels: { [key: string]: string } = {
          'posesStanding': 'Em Pé',
          'posesLying': 'Deitada',
          'posesAllFours': 'Quatro Apoios',
          'posesKneeling': 'Ajoelhada',
          'posesSitting': 'Sentada',
          'posesSquatting': 'Agachada',
          'posesSuspended': 'Suspensa',
          'posesPorn': 'Conteúdo Adulto'
      };

      const getImageUrl = (url: string) => {
          if (!url) return '';
          // Use our backend proxy to add Auth header to image requests
          return `/api/aliveai-image?url=${encodeURIComponent(url)}${token ? `&token=${token}` : ''}`;
      };

      return (
          <div key={key} className="border-b border-[#333] last:border-0">
              <button 
                onClick={() => setExpandedPoseCategory(isExpanded ? null : key)}
                className="flex items-center justify-between w-full py-2 px-1 text-xs font-medium text-gray-400 hover:text-white transition-colors uppercase tracking-wider"
              >
                  <span>{translatedLabels[key] || key.replace('poses', '')}</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </button>
              
              {isExpanded && (
                  <div className="grid grid-cols-3 gap-2 pb-3 pt-1">
                      {categoryData.poses.map((pose: any) => (
                          <button
                            key={pose.id}
                            onClick={() => setSelectedPose({ id: pose.id, type: categoryData.type, image: pose.image })}
                            className={`relative aspect-[3/4] rounded-md overflow-hidden border-2 transition-all ${selectedPose?.id === pose.id ? 'border-red-500 ring-2 ring-red-500/30' : 'border-transparent hover:border-gray-600'}`}
                          >
                              <img 
                                src={getImageUrl(pose.image)} 
                                alt="Pose" 
                                className="w-full h-full object-cover" 
                                onError={(e) => {
                                    // Fallback if proxy fails
                                    const img = e.target as HTMLImageElement;
                                    if (!img.src.includes('picsum')) {
                                        img.src = 'https://picsum.photos/seed/pose/300/400';
                                    }
                                }}
                              />
                          </button>
                      ))}
                  </div>
              )}
          </div>
      );
  };

  return (
    <div className="flex-1 flex flex-col bg-[#1a1a1a] h-full overflow-hidden animate-in fade-in duration-200">
      <div className={`flex-1 flex ${isMobile ? 'flex-col' : 'flex-row'} overflow-hidden`}>
        
        {/* Left Sidebar: Controls */}
        <div className={`${isMobile ? 'w-full h-[60%]' : 'w-80 md:w-96'} bg-[#212121] border-r border-[#333] flex flex-col shrink-0`}>
            <div className="p-5 border-b border-[#333] flex items-center justify-between text-white font-semibold text-lg bg-[#212121]">
                <div className="flex items-center gap-2">
                    <Infinity className="text-red-500" />
                    <span>Estúdio de Criação</span>
                </div>
                <div className="flex items-center gap-1">
                    {isMobile && onOpenSidebar && (
                        <button 
                            onClick={onOpenSidebar}
                            className="p-2 text-[#b4b4b4] hover:text-white transition-colors"
                            title="Abrir menu"
                        >
                            <Menu size={20} />
                        </button>
                    )}
                    <button 
                        onClick={onClose}
                        className="p-2 text-[#b4b4b4] hover:text-white transition-colors"
                        title="Fechar estúdio"
                    >
                        <X size={20} />
                    </button>
                </div>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
                
                {/* Basic Info */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <User size={12} /> Info do Personagem
                    </h3>
                    
                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs text-gray-400 mb-1">Nome *</label>
                            <input 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500 transition-colors"
                                placeholder="Ex: Marcielle Strongmaid"
                            />
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Gênero *</label>
                                <select 
                                    value={selectedGender}
                                    onChange={(e) => setSelectedGender(e.target.value)}
                                    className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                >
                                    {GENDERS.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Modelo *</label>
                                <select 
                                    value={selectedModel}
                                    onChange={(e) => setSelectedModel(e.target.value)}
                                    className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                                >
                                    {MODELS.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="h-px bg-[#333]" />

                {/* Appearance */}
                <div className="space-y-4">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                        <Palette size={12} /> Aparência
                    </h3>
                    
                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Descrição (Prompt) *</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Descreva a aparência, roupas, cenário..."
                            className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:border-red-500 transition-all resize-none h-24 scrollbar-thin"
                        />
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Rosto (Opcional)</label>
                        <select 
                            value={selectedFace}
                            onChange={(e) => setSelectedFace(e.target.value)}
                            className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                        >
                            <option value="">Nenhum (Genérico)</option>
                            {faces.map((face: any) => (
                                <option key={face.id} value={face.id}>{face.name || `Face ${face.id.substr(0,6)}`}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs text-gray-400 mb-1">Estilo / Template</label>
                        <select 
                            value={selectedTemplate}
                            onChange={(e) => setSelectedTemplate(e.target.value)}
                            className="w-full bg-[#2f2f2f] border border-[#424242] rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                        >
                            <option value="">Padrão</option>
                            {templates.map((tmpl: any) => (
                                <option key={tmpl.id} value={tmpl.id}>{tmpl.name || tmpl.id}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="h-px bg-[#333]" />

                {/* Poses */}
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                            <ScanFace size={12} /> Poses
                        </h3>
                        {selectedPose && (
                            <button onClick={() => setSelectedPose(null)} className="text-[10px] text-red-400 hover:text-red-300">
                                Remover
                            </button>
                        )}
                    </div>

                    {selectedPose && (
                        <div className="mb-2">
                             <label className="block text-xs text-gray-400 mb-1">Força da Pose: {poseStrength}%</label>
                             <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                value={poseStrength} 
                                onChange={(e) => setPoseStrength(parseInt(e.target.value))}
                                className="w-full h-1 bg-[#424242] rounded-lg appearance-none cursor-pointer accent-red-500"
                             />
                        </div>
                    )}

                    <div className="space-y-1">
                        {Object.keys(poses).length > 0 ? (
                            Object.keys(poses).map(key => renderPoseCategory(key, key))
                        ) : (
                            <div className="py-4 text-center">
                                <p className="text-xs text-gray-500 mb-2">Nenhuma pose carregada</p>
                                <button 
                                    onClick={loadResources}
                                    className="text-[10px] text-red-500 hover:underline"
                                >
                                    Tentar novamente
                                </button>
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="h-px bg-[#333]" />

                {/* Format */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wider">Formato</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['SQUARE', 'PORTRAIT', 'LANDSCAPE'].map((ratio) => (
                        <button
                            key={ratio}
                            onClick={() => setAspectRatio(ratio as any)}
                            className={`px-2 py-2 rounded-lg text-xs font-medium border transition-all ${
                                aspectRatio === ratio 
                                ? 'bg-red-500/20 border-red-500 text-red-300' 
                                : 'bg-[#2f2f2f] border-[#424242] text-gray-400 hover:bg-[#383838]'
                            }`}
                        >
                            {ratio === 'SQUARE' ? '1:1' : ratio === 'PORTRAIT' ? '9:16' : '16:9'}
                        </button>
                    ))}
                  </div>
                </div>

            </div>
            
            <div className="p-5 border-t border-[#333] bg-[#212121]">
                <button
                    onClick={handleGenerate}
                    disabled={isGenerating || !prompt.trim() || !name.trim()}
                    className="w-full h-12 bg-red-600 hover:bg-red-700 disabled:bg-[#333] disabled:text-gray-500 disabled:cursor-not-allowed text-white font-medium rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-red-900/20"
                >
                    {isGenerating ? <Loader2 size={20} className="animate-spin" /> : <Infinity size={20} />}
                    <span>Gerar Imagem</span>
                </button>
            </div>
        </div>

        {/* Main Area: Preview */}
        <div className={`flex-1 flex flex-col bg-[#121212] relative ${isMobile ? 'h-[40%]' : 'h-full'}`}>
            {/* Preview Area */}
            <div className="flex-1 flex items-center justify-center p-4 md:p-8 overflow-hidden bg-[url('https://grainy-gradients.vercel.app/noise.svg')] bg-opacity-5">
                {isGenerating ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <div className="absolute inset-0 bg-red-500 blur-xl opacity-20 animate-pulse"></div>
                            <Loader2 size={64} className="text-red-500 animate-spin relative z-10" />
                        </div>
                        <p className="text-gray-400 animate-pulse font-medium">{statusMessage}</p>
                    </div>
                ) : generatedImage ? (
                    <div className="relative group h-full w-full flex items-center justify-center">
                        <div className="relative h-full w-full flex items-center justify-center">
                            <img 
                                src={generatedImage} 
                                alt="Generated" 
                                className="max-h-full max-w-full object-contain shadow-2xl rounded-lg border border-[#333]"
                            />
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 gap-4 rounded-lg">
                                <button 
                                    onClick={() => window.open(generatedImage, '_blank')}
                                    className="p-3 bg-white/10 backdrop-blur-md rounded-full text-white hover:bg-white/20 transition-colors border border-white/10"
                                    title="Abrir original"
                                >
                                    <Download size={24} />
                                </button>
                                <button 
                                    onClick={handleSend}
                                    className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-full transition-all flex items-center gap-2 shadow-lg"
                                >
                                    <Send size={20} />
                                    <span>Enviar para Chat</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-6 text-[#333]">
                        <div className="w-32 h-32 rounded-2xl bg-[#1a1a1a] border-2 border-dashed border-[#333] flex items-center justify-center">
                            <ImageIcon size={48} className="opacity-50" />
                        </div>
                        <div className="text-center">
                            <p className="text-xl font-medium text-gray-500">Seu personagem aparecerá aqui</p>
                            <p className="text-sm text-gray-600 mt-2">Configure os detalhes ao lado e clique em Gerar</p>
                            {statusMessage && <p className="text-xs text-red-500 mt-4">{statusMessage}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
      </div>
    </div>
  );
};
