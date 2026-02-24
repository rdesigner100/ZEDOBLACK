import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Trash2, Search, Settings, LogOut, PanelLeftClose, PanelLeftOpen, SquarePen, Sparkles, MoreHorizontal, Pin, PenLine, X, Infinity } from 'lucide-react';
import { db, deleteConversation, updateConversation } from '../services/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface SidebarProps {
  currentId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  onOpenSettings: () => void;
  onOpenStudio: () => void;
  isMobile: boolean;
  isStudioOpen: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentId, 
  onSelect, 
  onNew, 
  isOpen, 
  setIsOpen,
  onOpenSettings,
  onOpenStudio,
  isMobile,
  isStudioOpen
}) => {
  const conversations = useLiveQuery(() => 
    db.conversations.orderBy('updatedAt').reverse().toArray()
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [searchModalOpen, setSearchModalOpen] = useState(false);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const modalSearchInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const filteredConversations = conversations?.filter(c => 
    c.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group conversations
  const pinnedConversations = filteredConversations?.filter(c => c.pinned) || [];
  const unpinnedConversations = filteredConversations?.filter(c => !c.pinned) || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
      // Close context menu if clicking outside
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    
    // Handle scroll to close menu
    const handleScroll = () => {
        if (openMenuId) setOpenMenuId(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true); // Capture scroll events

    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (isSearching && searchInputRef.current) {
        searchInputRef.current.focus();
    }
  }, [isSearching]);

  useEffect(() => {
      if (searchModalOpen && modalSearchInputRef.current) {
          setTimeout(() => modalSearchInputRef.current?.focus(), 50);
      }
  }, [searchModalOpen]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('Tem certeza que deseja apagar esta conversa?')) {
      await deleteConversation(id);
      if (currentId === id) onNew();
    }
    setOpenMenuId(null);
  };

  const handlePin = async (e: React.MouseEvent, id: string, currentPinned: boolean) => {
      e.stopPropagation();
      await updateConversation(id, { pinned: !currentPinned });
      setOpenMenuId(null);
  };

  const handleRenameStart = (e: React.MouseEvent, id: string, currentTitle: string) => {
      e.stopPropagation();
      setEditingId(id);
      setEditTitle(currentTitle);
      setOpenMenuId(null);
  };

  const handleRenameSave = async (id: string) => {
      if (editTitle.trim()) {
          await updateConversation(id, { title: editTitle.trim() });
      }
      setEditingId(null);
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent, id: string) => {
      if (e.key === 'Enter') {
          handleRenameSave(id);
      } else if (e.key === 'Escape') {
          setEditingId(null);
      }
  };

  const handleMenuOpen = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      const rect = e.currentTarget.getBoundingClientRect();
      
      // Calculate position
      let top = rect.bottom + 5;
      let left = rect.left;

      // Adjust for mobile or if close to right edge
      const menuWidth = 192; // w-48 is 12rem = 192px
      if (left + menuWidth > window.innerWidth) {
          left = window.innerWidth - menuWidth - 10; // 10px padding from right
      }

      setMenuPosition({ top, left });
      setOpenMenuId(openMenuId === id ? null : id);
  };

  // If collapsed (and not mobile), render the mini sidebar with hover-to-open logic
  if (!isOpen && !isMobile) {
      return (
          <>
            <div className="w-[60px] bg-[#171717] flex flex-col items-center py-3 border-r border-[#333]/0 z-50 h-full justify-between">
                <div className="flex flex-col items-center w-full">
                    <div 
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#212121] cursor-pointer group relative transition-colors mb-2"
                        onClick={() => setIsOpen(true)}
                    >
                        <div className="relative w-8 h-8 flex items-center justify-center">
                                {/* Logo visible by default, hidden on group-hover */}
                                <img 
                                    src="https://central.daev.ca/wp-content/uploads/2026/01/ICON-ZDB.png" 
                                    alt="Logo" 
                                    className="w-7 h-7 object-contain opacity-100 group-hover:opacity-0 transition-opacity duration-200 absolute" 
                                />
                                {/* Open Icon hidden by default, visible on group-hover */}
                                <PanelLeftOpen className="text-[#b4b4b4] opacity-0 group-hover:opacity-100 transition-opacity duration-200 absolute" size={20} />
                        </div>
                        
                        <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-[60] shadow-lg border border-[#333]">
                            Abrir barra lateral
                        </div>
                    </div>
                    
                    <div 
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#212121] cursor-pointer group relative mb-2 transition-colors" 
                        onClick={onNew}
                    >
                        <SquarePen size={20} className="text-[#ececec]" />
                        <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-[60] shadow-lg border border-[#333]">
                            Novo chat
                        </div>
                    </div>

                    <div 
                        className={`w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#212121] cursor-pointer group relative mb-2 transition-colors ${isStudioOpen ? 'bg-[#212121]' : ''}`} 
                        onClick={onOpenStudio}
                    >
                        <Infinity size={20} className={isStudioOpen ? 'text-red-500' : 'text-[#ececec]'} />
                        <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-[60] shadow-lg border border-[#333]">
                            Estúdio de Criação
                        </div>
                    </div>

                    <div 
                        className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#212121] cursor-pointer group relative transition-colors" 
                        onClick={() => {
                            setSearchModalOpen(true);
                            setSearchTerm('');
                        }}
                    >
                        <Search size={20} className="text-[#ececec]" />
                        <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-[60] shadow-lg border border-[#333]">
                            Buscar em chats
                        </div>
                    </div>
                </div>

                <div 
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#212121] cursor-pointer group relative mb-2 transition-colors"
                    onClick={() => setIsOpen(true)} // Open sidebar to show user menu context
                >
                    <div className="w-8 h-8 rounded bg-green-700 flex items-center justify-center text-white font-medium text-xs">
                        ÉB
                    </div>
                    <div className="absolute left-14 bg-black text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none transition-opacity z-[60] shadow-lg border border-[#333]">
                        Perfil
                    </div>
                </div>
            </div>

            {/* Search Modal */}
            {searchModalOpen && createPortal(
                <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSearchModalOpen(false)}>
                    <div 
                        className="w-full max-w-2xl bg-[#1f1f1f] border border-[#333] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center px-4 py-3 border-b border-[#333]">
                            <Search className="text-[#b4b4b4] mr-3" size={20} />
                            <input 
                                ref={modalSearchInputRef}
                                className="flex-1 bg-transparent border-none outline-none text-[#ececec] placeholder-[#666] text-lg"
                                placeholder="Buscar em chats..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                            <button 
                                onClick={() => setSearchModalOpen(false)}
                                className="p-1 text-[#b4b4b4] hover:text-white rounded hover:bg-[#333] transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        
                        <div className="max-h-[60vh] overflow-y-auto p-2">
                             <button 
                                onClick={() => {
                                    onNew();
                                    setSearchModalOpen(false);
                                }}
                                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#2f2f2f] rounded-lg text-left transition-colors group mb-2"
                             >
                                <div className="p-2 bg-[#2f2f2f] group-hover:bg-[#3f3f3f] rounded-lg transition-colors">
                                    <SquarePen size={18} className="text-white" />
                                </div>
                                <span className="text-[#ececec] font-medium">Novo chat</span>
                             </button>

                             {searchTerm && (
                                <div className="px-4 py-2 text-xs font-semibold text-[#666] uppercase tracking-wider">
                                    Resultados
                                </div>
                             )}

                             {filteredConversations?.map(conv => (
                                 <button
                                    key={conv.id}
                                    onClick={() => {
                                        onSelect(conv.id);
                                        setSearchModalOpen(false);
                                    }}
                                    className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#2f2f2f] rounded-lg text-left transition-colors group"
                                 >
                                    <div className="p-2 bg-[#2f2f2f] group-hover:bg-[#3f3f3f] rounded-lg transition-colors text-[#b4b4b4] group-hover:text-white">
                                        {conv.pinned ? <Pin size={18} /> : <MoreHorizontal size={18} />}
                                    </div>
                                    <div className="flex flex-col overflow-hidden">
                                        <span className="text-[#ececec] truncate font-medium">{conv.title || 'Nova conversa'}</span>
                                        <span className="text-xs text-[#666] truncate">
                                            {new Date(conv.updatedAt).toLocaleDateString()}
                                        </span>
                                    </div>
                                 </button>
                             ))}

                             {searchTerm && filteredConversations?.length === 0 && (
                                 <div className="px-4 py-8 text-center text-[#666]">
                                     Nenhuma conversa encontrada para "{searchTerm}"
                                 </div>
                             )}
                        </div>
                    </div>
                </div>,
                document.body
            )}
          </>
      )
  }

  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-[260px] bg-[#171717] text-[#ececec] flex flex-col
        transform transition-transform duration-300 ease-in-out font-sans border-r border-[#212121]
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Top Header Section */}
        <div className="flex flex-col px-3 py-3 gap-2">
             <div className="flex items-center justify-between">
                 {/* Explicit Logo in Sidebar */}
                 <button onClick={onNew} className="hover:opacity-80 transition-opacity">
                     <img 
                        src="https://central.daev.ca/wp-content/uploads/2026/01/ICON-ZDB.png" 
                        alt="Logo" 
                        className="w-8 h-8 object-contain"
                    />
                 </button>
                 
                 <div className="flex items-center gap-1">
                     <button 
                        onClick={() => setIsOpen(false)}
                        className="p-2 text-[#b4b4b4] hover:text-white rounded-lg hover:bg-[#212121] transition-colors"
                        title="Fechar barra lateral"
                     >
                         <PanelLeftClose size={20} />
                     </button>
                 </div>
             </div>

             {/* New Chat Button */}
             <button 
                onClick={onNew}
                className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-white hover:bg-[#212121] rounded-lg transition-colors text-left"
             >
                 <SquarePen size={18} />
                 <span>Novo chat</span>
             </button>

              {/* Estúdio de Criação Button */}
             <button 
                onClick={onOpenStudio}
                className={`flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-[#212121] rounded-lg transition-colors text-left ${isStudioOpen ? 'bg-[#212121] text-red-500' : 'text-[#ececec]'}`}
             >
                  <Infinity size={18} className={isStudioOpen ? 'text-red-500' : 'text-[#b4b4b4]'} />
                  <span>Estúdio de Criação</span>
             </button>

             {/* Search Button/Input */}
             {!isSearching ? (
                 <button 
                    onClick={() => setIsSearching(true)}
                    className="flex items-center gap-3 px-3 py-2 text-sm font-medium text-[#b4b4b4] hover:bg-[#212121] rounded-lg transition-colors text-left"
                 >
                     <Search size={18} />
                     <span>Buscar em chats</span>
                 </button>
             ) : (
                 <div className="flex items-center gap-2 px-3 py-2 bg-[#212121] rounded-lg border border-[#333]">
                      <Search size={16} className="text-[#b4b4b4]" />
                      <input 
                        ref={searchInputRef}
                        className="bg-transparent border-none outline-none text-sm text-[#ececec] placeholder-[#b4b4b4] w-full"
                        placeholder="Buscar..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onBlur={() => !searchTerm && setIsSearching(false)}
                      />
                 </div>
             )}
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden px-2 py-2 space-y-1 scrollbar-thin">
          {conversations && conversations.length > 0 && (
             <div className="px-3 py-2 text-xs font-semibold text-[#b4b4b4] mt-1">Seus chats</div>
          )}
          
          {/* Pinned Conversations */}
          {pinnedConversations.map(conv => (
              <ConversationItem 
                key={conv.id}
                conv={conv}
                currentId={currentId}
                editingId={editingId}
                editTitle={editTitle}
                openMenuId={openMenuId}
                onSelect={onSelect}
                onMobileClose={() => isMobile && setIsOpen(false)}
                setEditTitle={setEditTitle}
                handleRenameSave={handleRenameSave}
                handleRenameKeyDown={handleRenameKeyDown}
                handleMenuOpen={handleMenuOpen}
              />
          ))}

          {/* Unpinned Conversations */}
          {unpinnedConversations.map(conv => (
              <ConversationItem 
                key={conv.id}
                conv={conv}
                currentId={currentId}
                editingId={editingId}
                editTitle={editTitle}
                openMenuId={openMenuId}
                onSelect={onSelect}
                onMobileClose={() => isMobile && setIsOpen(false)}
                setEditTitle={setEditTitle}
                handleRenameSave={handleRenameSave}
                handleRenameKeyDown={handleRenameKeyDown}
                handleMenuOpen={handleMenuOpen}
              />
          ))}

          {filteredConversations?.length === 0 && (
             <div className="px-4 py-4 text-xs text-[#b4b4b4] text-center">
               Nenhuma conversa encontrada.
             </div>
          )}
        </div>

        {/* Bottom User Section */}
        <div className="p-2 border-t border-[#2f2f2f]/0 relative" ref={userMenuRef}>
          {showUserMenu && (
             <div className="absolute bottom-full left-2 right-2 mb-2 bg-[#2f2f2f] rounded-xl shadow-2xl border border-[#424242] overflow-hidden py-1 z-50 transform origin-bottom animate-in fade-in zoom-in-95 duration-100">
                 <button className="flex items-center gap-3 w-full px-3 py-3 hover:bg-[#424242] text-sm text-left transition-colors">
                     <Sparkles size={16} className="text-white" />
                     <div className="flex flex-col">
                        <span className="text-white font-medium">Fazer upgrade do plano</span>
                        <span className="text-xs text-[#b4b4b4]">Obtenha GPT-4, DALL·E e mais</span>
                     </div>
                 </button>
                 <div className="h-px bg-[#424242] my-1 mx-2" />
                 <button 
                    onClick={() => {
                        onOpenSettings();
                        setShowUserMenu(false);
                    }}
                    className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#424242] text-sm text-left transition-colors text-white"
                >
                     <Settings size={16} />
                     <span>Configurações</span>
                 </button>
                 <div className="h-px bg-[#424242] my-1 mx-2" />
                 <button className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-[#424242] text-sm text-left transition-colors text-white">
                     <LogOut size={16} />
                     <span>Sair</span>
                 </button>
             </div>
          )}
        
          <button 
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-3 w-full px-2 py-2 rounded-lg hover:bg-[#212121] transition-colors text-sm text-[#ececec] group"
          >
            <div className="w-8 h-8 rounded bg-green-700 flex items-center justify-center text-white font-medium text-xs">
               ÉB
            </div>
            <div className="flex-1 text-left font-medium flex flex-col text-[13px]">
               <span className="text-white">És Borges</span>
               <span className="text-xs text-[#b4b4b4]">Plus</span>
            </div>
          </button>
        </div>
      </aside>

      {/* Portal for Context Menu */}
      {openMenuId && menuPosition && createPortal(
          <div 
            ref={menuRef}
            className="fixed w-48 bg-[#2f2f2f] border border-[#424242] rounded-lg shadow-2xl z-[9999] py-1 flex flex-col animate-in fade-in zoom-in-95 duration-100"
            style={{ 
                top: menuPosition.top, 
                left: menuPosition.left 
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {(() => {
                const conv = conversations?.find(c => c.id === openMenuId);
                if (!conv) return null;
                return (
                    <>
                        <button 
                            onClick={(e) => handlePin(e, conv.id, conv.pinned)}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-[#424242] w-full text-left transition-colors"
                        >
                            <Pin size={16} />
                            {conv.pinned ? 'Desafixar chat' : 'Fixar chat'}
                        </button>
                        <button 
                            onClick={(e) => handleRenameStart(e, conv.id, conv.title)}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-white hover:bg-[#424242] w-full text-left transition-colors"
                        >
                            <PenLine size={16} />
                            Renomear
                        </button>
                        <div className="h-px bg-[#424242] my-1 mx-2" />
                        <button 
                            onClick={(e) => handleDelete(e, conv.id)}
                            className="flex items-center gap-3 px-3 py-2.5 text-sm text-red-400 hover:bg-[#424242] w-full text-left transition-colors"
                        >
                            <Trash2 size={16} />
                            Excluir
                        </button>
                    </>
                );
            })()}
          </div>,
          document.body
      )}

      {/* Search Modal (Global) */}
      {searchModalOpen && createPortal(
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSearchModalOpen(false)}>
              <div 
                  className="w-full max-w-2xl bg-[#1f1f1f] border border-[#333] rounded-xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
                  onClick={e => e.stopPropagation()}
              >
                  <div className="flex items-center px-4 py-3 border-b border-[#333]">
                      <Search className="text-[#b4b4b4] mr-3" size={20} />
                      <input 
                          ref={modalSearchInputRef}
                          className="flex-1 bg-transparent border-none outline-none text-[#ececec] placeholder-[#666] text-lg"
                          placeholder="Buscar em chats..."
                          value={searchTerm}
                          onChange={(e) => setSearchTerm(e.target.value)}
                      />
                      <button 
                          onClick={() => setSearchModalOpen(false)}
                          className="p-1 text-[#b4b4b4] hover:text-white rounded hover:bg-[#333] transition-colors"
                      >
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="max-h-[60vh] overflow-y-auto p-2">
                       <button 
                          onClick={() => {
                              onNew();
                              setSearchModalOpen(false);
                          }}
                          className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#2f2f2f] rounded-lg text-left transition-colors group mb-2"
                       >
                          <div className="p-2 bg-[#2f2f2f] group-hover:bg-[#3f3f3f] rounded-lg transition-colors">
                              <SquarePen size={18} className="text-white" />
                          </div>
                          <span className="text-[#ececec] font-medium">Novo chat</span>
                       </button>

                       {searchTerm && (
                          <div className="px-4 py-2 text-xs font-semibold text-[#666] uppercase tracking-wider">
                              Resultados
                          </div>
                       )}

                       {filteredConversations?.map(conv => (
                           <button
                              key={conv.id}
                              onClick={() => {
                                  onSelect(conv.id);
                                  setSearchModalOpen(false);
                              }}
                              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-[#2f2f2f] rounded-lg text-left transition-colors group"
                           >
                              <div className="p-2 bg-[#2f2f2f] group-hover:bg-[#3f3f3f] rounded-lg transition-colors text-[#b4b4b4] group-hover:text-white">
                                  {conv.pinned ? <Pin size={18} /> : <MoreHorizontal size={18} />}
                              </div>
                              <div className="flex flex-col overflow-hidden">
                                  <span className="text-[#ececec] truncate font-medium">{conv.title || 'Nova conversa'}</span>
                                  <span className="text-xs text-[#666] truncate">
                                      {new Date(conv.updatedAt).toLocaleDateString()}
                                  </span>
                              </div>
                           </button>
                       ))}

                       {searchTerm && filteredConversations?.length === 0 && (
                           <div className="px-4 py-8 text-center text-[#666]">
                               Nenhuma conversa encontrada para "{searchTerm}"
                           </div>
                       )}
                  </div>
              </div>
          </div>,
          document.body
      )}
    </>
  );
};

// Extracted Component for Conversation Item to avoid clutter
const ConversationItem = ({ 
    conv, currentId, editingId, editTitle, openMenuId, 
    onSelect, onMobileClose, setEditTitle, handleRenameSave, handleRenameKeyDown, 
    handleMenuOpen
}: any) => {
    const isMenuOpen = openMenuId === conv.id;

    return (
        <div
            onClick={() => {
              onSelect(conv.id);
              onMobileClose();
            }}
            className={`
              group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer text-sm overflow-hidden relative
              ${currentId === conv.id ? 'bg-[#212121]' : 'hover:bg-[#212121]'}
            `}
        >
            {/* Editing Mode */}
            {editingId === conv.id ? (
                <input 
                    autoFocus
                    className="bg-[#2f2f2f] text-white text-sm rounded px-1 py-0.5 w-full outline-none border border-blue-500"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    onBlur={() => handleRenameSave(conv.id)}
                    onKeyDown={(e) => handleRenameKeyDown(e, conv.id)}
                    onClick={(e) => e.stopPropagation()}
                />
            ) : (
                <>
                    <div className="flex-1 truncate text-[#ececec] font-normal text-[13px] flex items-center gap-2">
                        {conv.pinned && <Pin size={12} className="text-gray-400 flex-shrink-0" fill="currentColor" />}
                        <span className="truncate">{conv.title || 'Nova conversa'}</span>
                    </div>
                    
                    {/* Menu Trigger (3 dots) */}
                    <div className={`absolute right-2 flex items-center bg-[#212121] pl-2 z-10 ${currentId === conv.id || isMenuOpen ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
                       <button
                        onClick={(e) => handleMenuOpen(e, conv.id)}
                        className={`text-[#b4b4b4] hover:text-white transition-colors p-1 rounded ${isMenuOpen ? 'bg-[#2f2f2f] text-white' : 'hover:bg-[#2f2f2f]'}`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                    </div>
                </>
            )}
             {/* Fade gradient for truncation if needed - hidden when menu is open */}
             {!editingId && !isMenuOpen && <div className={`absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#171717] to-transparent pointer-events-none group-hover:from-[#212121] ${currentId === conv.id ? 'from-[#212121]' : ''}`} />}
        </div>
    );
}
