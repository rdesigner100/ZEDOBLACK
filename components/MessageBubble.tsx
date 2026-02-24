import React from 'react';
import ReactMarkdown from 'react-markdown';
import { Copy, RefreshCw, AlertCircle, FileText, Globe } from 'lucide-react';
import { Message, Role, GroundingMetadata } from '../types';

interface MessageBubbleProps {
  message: Message;
  onCopy: (text: string) => void;
  onRegenerate?: () => void;
  onImageClick?: (src: string) => void;
  onSourceClick?: (metadata: GroundingMetadata) => void;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCopy, onRegenerate, onImageClick, onSourceClick }) => {
  const isUser = message.role === Role.User;
  const isError = message.error;

  // Render attachments if any
  const renderAttachments = () => {
    if (!message.attachments || message.attachments.length === 0) return null;

    return (
      <div className="flex flex-wrap gap-3 mb-3 justify-end">
        {message.attachments.map(att => (
          <div key={att.id} className="relative overflow-hidden rounded-xl border border-[#424242] bg-[#212121]">
            {att.type === 'image' ? (
              <img 
                src={`data:${att.mimeType};base64,${att.data}`} 
                alt="attachment" 
                className="max-w-[200px] max-h-[200px] object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onImageClick && onImageClick(`data:${att.mimeType};base64,${att.data}`)}
              />
            ) : (
               <div className="flex items-center gap-2 p-3 min-w-[150px]">
                  <div className="p-2 bg-[#2f2f2f] rounded-lg">
                    <FileText size={24} className="text-[#ececec]" />
                  </div>
                  <div className="flex flex-col overflow-hidden">
                      <span className="text-sm text-[#ececec] truncate max-w-[120px]">{att.name}</span>
                      <span className="text-xs text-[#b4b4b4] uppercase">{att.mimeType.split('/')[1] || 'FILE'}</span>
                  </div>
               </div>
            )}
          </div>
        ))}
      </div>
    );
  };

  if (isUser) {
    return (
      <div className="w-full flex flex-col items-end mb-6 px-4 md:px-0 max-w-3xl mx-auto">
        {renderAttachments()}
        {message.content && (
            <div className="bg-[#2f2f2f] text-[#ececec] px-5 py-2.5 rounded-[26px] max-w-[85%] md:max-w-[70%] break-words leading-7">
              {message.content}
            </div>
        )}
      </div>
    );
  }

  return (
    <div className="w-full flex justify-start mb-6 px-4 md:px-0 max-w-3xl mx-auto group">
      <div className="relative w-full overflow-hidden">
        {isError ? (
          <div className="text-red-500 flex items-center gap-2">
            <AlertCircle size={16} />
            <span>{message.content}</span>
          </div>
        ) : (
          <div className="prose prose-invert max-w-none break-words leading-7 text-[#ececec]">
            {message.isStreaming && !message.content && (
                <div className="flex items-center gap-2 text-gray-400 animate-pulse">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    <span className="text-sm font-medium ml-2">ZDB PENSANDO...</span>
                </div>
            )}
            <ReactMarkdown 
               components={{
                code({node, className, children, ...props}) {
                  return (
                      <code className={`${className} bg-[#2f2f2f] rounded px-1 py-0.5`} {...props}>
                        {children}
                      </code>
                  )
                },
                pre({node, children, ...props}) {
                    return (
                        <pre className="bg-[#0d0d0d] border border-[#2f2f2f] text-gray-200 p-4 rounded-md overflow-x-auto my-4" {...props}>
                            {children}
                        </pre>
                    )
                }
               }}
            >
              {message.content}
            </ReactMarkdown>

            {/* Source Button */}
            {message.groundingMetadata && message.groundingMetadata.groundingChunks?.some(c => c.web) && (
               <div className="mt-3 flex flex-wrap gap-2">
                  <button 
                    onClick={() => onSourceClick && onSourceClick(message.groundingMetadata!)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#2f2f2f] hover:bg-[#383838] rounded-full text-xs text-gray-300 transition-colors border border-[#424242]"
                  >
                    <Globe size={12} />
                    <span>
                      {message.groundingMetadata.groundingChunks.filter(c => c.web).length} Fontes
                    </span>
                  </button>
               </div>
            )}
          </div>
        )}

        {!message.isStreaming && !isError && (
           <div className="flex items-center gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <button 
                onClick={() => onCopy(message.content)}
                className="p-1 text-gray-500 hover:text-gray-300"
                title="Copiar"
              >
                <Copy size={16} />
              </button>
              {onRegenerate && (
                <button 
                  onClick={onRegenerate}
                  className="p-1 text-gray-500 hover:text-gray-300"
                  title="Regenerar"
                >
                  <RefreshCw size={16} />
                </button>
              )}
           </div>
        )}
      </div>
    </div>
  );
};