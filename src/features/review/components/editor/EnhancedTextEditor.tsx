import React, { useState, useCallback, useRef, useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import CharacterCount from '@tiptap/extension-character-count';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon, 
  Link as LinkIcon, 
  List, 
  ListOrdered, 
  Quote, 
  Minus,
  Undo,
  Redo,
  Type,
  Sparkles,
  Loader2,
  Copy,
  Check,
  Wand2,
  FileText,
  Lightbulb
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

interface EnhancedTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  aiContext?: {
    author?: string;
    articleDate?: string;
    matchType?: string;
  };
}

interface AiSuggestion {
  id: string;
  type: 'improve' | 'summarize' | 'expand' | 'tone';
  title: string;
  content: string;
  loading?: boolean;
}

const AI_PROMPTS = {
  improve: "Migliora questo testo rendendolo più professionale e preciso per un contesto di compliance AML. Mantieni tutti i fatti e le informazioni specifiche.",
  summarize: "Riassumi questo testo in modo conciso mantenendo tutti i dettagli importanti per un adverse media check.",
  expand: "Espandi questo testo aggiungendo dettagli professionali rilevanti per un'analisi AML, mantenendo un tono formale.",
  tone: "Rendi questo testo più formale e professionale, adatto a un documento di compliance aziendale."
};

export default function EnhancedTextEditor({ 
  value, 
  onChange, 
  placeholder = "Inizia a scrivere...",
  className = "",
  aiContext 
}: EnhancedTextEditorProps) {
  const [aiSuggestions, setAiSuggestions] = useState<AiSuggestion[]>([]);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const linkInputRef = useRef<HTMLInputElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        bulletList: { keepMarks: true },
        orderedList: { keepMarks: true },
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      CharacterCount.configure({
        limit: 10000,
      }),
      Link.configure({
        autolink: true,
        linkOnPaste: true,
        openOnClick: false,
        HTMLAttributes: { 
          rel: 'noreferrer noopener', 
          target: '_blank', 
          class: 'text-blue-600 underline hover:text-blue-800 transition-colors' 
        },
        validate: href => /^https?:\/\//i.test(href),
      }),
    ],
    content: value || '',
    onUpdate({ editor }) { 
      onChange(editor.getHTML()); 
    },
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none focus:outline-none min-h-[200px] p-4',
      },
    },
  });

  const setLink = useCallback(() => {
    if (!editor) return;
    const previousUrl = editor.getAttributes('link').href || '';
    const url = window.prompt('Inserisci URL (https://...)', previousUrl);
    
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().unsetLink().run();
      return;
    }
    
    if (!/^https?:\/\//i.test(url)) {
      toast({
        title: "URL non valido",
        description: "L'URL deve iniziare con http:// o https://",
        variant: "destructive"
      });
      return;
    }
    
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  }, [editor]);

  const generateAiSuggestion = async (type: keyof typeof AI_PROMPTS, customText?: string) => {
    if (!editor) return;
    
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    
    const textToProcess = selectedText || editor.getText();
    
    if (!textToProcess.trim()) {
      toast({
        title: "Nessun testo selezionato",
        description: "Seleziona del testo o scrivi qualcosa prima di usare l'AI",
        variant: "destructive"
      });
      return;
    }

    const suggestionId = Math.random().toString(36).substring(7);
    const newSuggestion: AiSuggestion = {
      id: suggestionId,
      type,
      title: type === 'improve' ? 'Migliora testo' : 
             type === 'summarize' ? 'Riassumi' :
             type === 'expand' ? 'Espandi' : 'Cambia tono',
      content: '',
      loading: true
    };

    setAiSuggestions(prev => [newSuggestion, ...prev]);
    setIsGenerating(true);

    try {
      const prompt = customText || AI_PROMPTS[type];
      const contextPrefix = aiContext ? 
        `Contesto: Articolo di ${aiContext.author || 'N/A'} del ${aiContext.articleDate || 'N/A'} con ${aiContext.matchType || 'corrispondenza'}.\n\n` : '';
      
      const response = await fetch('/.netlify/functions/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `${contextPrefix}${prompt}\n\nTesto da elaborare:\n${textToProcess}`,
          language: 'it',
          model: 'anthropic/claude-3-haiku',
          temperature: 0.3,
          max_tokens: 800
        })
      });

      if (!response.ok) {
        throw new Error(`Errore API: ${response.status}`);
      }

      const data = await response.json();
      const aiContent = data.summary || 'Nessuna risposta dall\'AI';

      setAiSuggestions(prev => 
        prev.map(s => 
          s.id === suggestionId 
            ? { ...s, content: aiContent, loading: false }
            : s
        )
      );
    } catch (error) {
      console.error('AI generation error:', error);
      setAiSuggestions(prev => 
        prev.map(s => 
          s.id === suggestionId 
            ? { ...s, content: 'Errore nella generazione AI', loading: false }
            : s
        )
      );
      toast({
        title: "Errore AI",
        description: "Impossibile generare il suggerimento. Riprova.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const generateCustomSuggestion = async () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Prompt vuoto",
        description: "Inserisci una richiesta per l'AI",
        variant: "destructive"
      });
      return;
    }

    await generateAiSuggestion('improve', customPrompt);
    setCustomPrompt('');
  };

  const applySuggestion = (suggestion: AiSuggestion) => {
    if (!editor || !suggestion.content) return;
    
    const selectedText = editor.state.doc.textBetween(
      editor.state.selection.from,
      editor.state.selection.to
    );
    
    if (selectedText) {
      // Replace selected text
      editor.chain().focus().deleteSelection().insertContent(suggestion.content).run();
    } else {
      // Replace all content
      editor.chain().focus().selectAll().deleteSelection().insertContent(suggestion.content).run();
    }
    
    toast({
      title: "Suggerimento applicato",
      description: "Il testo è stato aggiornato con il suggerimento AI"
    });
  };

  const copySuggestion = async (suggestion: AiSuggestion) => {
    try {
      await navigator.clipboard.writeText(suggestion.content);
      setCopiedId(suggestion.id);
      setTimeout(() => setCopiedId(null), 2000);
      toast({
        title: "Copiato",
        description: "Suggerimento copiato negli appunti"
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive"
      });
    }
  };

  const clearSuggestions = () => {
    setAiSuggestions([]);
  };

  if (!editor) {
    return (
      <div className={`border rounded-lg p-4 min-h-[200px] bg-muted animate-pulse ${className}`}>
        <div className="h-4 bg-muted-foreground/20 rounded w-3/4 mb-2"></div>
        <div className="h-4 bg-muted-foreground/20 rounded w-1/2"></div>
      </div>
    );
  }

  return (
    <div className={`border rounded-lg bg-white shadow-sm ${className}`}>
      {/* Toolbar */}
      <div className="border-b p-3 bg-muted/30">
        <div className="flex items-center gap-1 flex-wrap">
          {/* Text Formatting */}
          <div className="flex items-center gap-1">
            <Button
              variant={editor.isActive('bold') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleBold().run()}
              className="h-8 w-8 p-0"
            >
              <Bold className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive('italic') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className="h-8 w-8 p-0"
            >
              <Italic className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive('underline') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleUnderline().run()}
              className="h-8 w-8 p-0"
            >
              <UnderlineIcon className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Lists and Quotes */}
          <div className="flex items-center gap-1">
            <Button
              variant={editor.isActive('bulletList') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className="h-8 w-8 p-0"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive('orderedList') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className="h-8 w-8 p-0"
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
            <Button
              variant={editor.isActive('blockquote') ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
              className="h-8 w-8 p-0"
            >
              <Quote className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Headings */}
          <div className="flex items-center gap-1">
            <Button
              variant={editor.isActive('heading', { level: 1 }) ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className="h-8 px-2 text-xs font-bold"
            >
              H1
            </Button>
            <Button
              variant={editor.isActive('heading', { level: 2 }) ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className="h-8 px-2 text-xs font-bold"
            >
              H2
            </Button>
            <Button
              variant={editor.isActive('heading', { level: 3 }) ? 'default' : 'ghost'}
              size="sm"
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className="h-8 px-2 text-xs font-bold"
            >
              H3
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Link and HR */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={setLink}
              className="h-8 w-8 p-0"
            >
              <LinkIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().setHorizontalRule().run()}
              className="h-8 w-8 p-0"
            >
              <Minus className="h-4 w-4" />
            </Button>
          </div>

          <Separator orientation="vertical" className="h-6" />

          {/* Undo/Redo */}
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().undo().run()}
              disabled={!editor.can().undo()}
              className="h-8 w-8 p-0"
            >
              <Undo className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => editor.chain().focus().redo().run()}
              disabled={!editor.can().redo()}
              className="h-8 w-8 p-0"
            >
              <Redo className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1" />

          {/* AI Assistant */}
          <Popover open={isAiPanelOpen} onOpenChange={setIsAiPanelOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="h-8 gap-2 bg-gradient-to-r from-purple-50 to-blue-50 border-purple-200 hover:from-purple-100 hover:to-blue-100"
              >
                <Sparkles className="h-4 w-4 text-purple-600" />
                <span className="text-purple-700 font-medium">AI Assistant</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-96 p-0" align="end">
              <Card className="border-0 shadow-lg">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Wand2 className="h-5 w-5 text-purple-600" />
                    Assistente AI
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Quick Actions */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Azioni rapide</h4>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAiSuggestion('improve')}
                        disabled={isGenerating}
                        className="justify-start gap-2"
                      >
                        <Lightbulb className="h-4 w-4" />
                        Migliora
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAiSuggestion('summarize')}
                        disabled={isGenerating}
                        className="justify-start gap-2"
                      >
                        <FileText className="h-4 w-4" />
                        Riassumi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAiSuggestion('expand')}
                        disabled={isGenerating}
                        className="justify-start gap-2"
                      >
                        <Type className="h-4 w-4" />
                        Espandi
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateAiSuggestion('tone')}
                        disabled={isGenerating}
                        className="justify-start gap-2"
                      >
                        <Wand2 className="h-4 w-4" />
                        Formalizza
                      </Button>
                    </div>
                  </div>

                  <Separator />

                  {/* Custom Prompt */}
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-muted-foreground">Richiesta personalizzata</h4>
                    <div className="space-y-2">
                      <Textarea
                        placeholder="Descrivi cosa vuoi che faccia l'AI con il testo..."
                        value={customPrompt}
                        onChange={(e) => setCustomPrompt(e.target.value)}
                        className="min-h-[80px] text-sm"
                      />
                      <Button
                        onClick={generateCustomSuggestion}
                        disabled={isGenerating || !customPrompt.trim()}
                        className="w-full gap-2"
                        size="sm"
                      >
                        {isGenerating ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                        Genera
                      </Button>
                    </div>
                  </div>

                  {/* AI Suggestions */}
                  {aiSuggestions.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium text-muted-foreground">Suggerimenti AI</h4>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSuggestions}
                            className="h-6 px-2 text-xs"
                          >
                            Pulisci
                          </Button>
                        </div>
                        <div className="max-h-64 overflow-y-auto space-y-3">
                          {aiSuggestions.map((suggestion) => (
                            <div key={suggestion.id} className="border rounded-lg p-3 space-y-2">
                              <div className="flex items-center justify-between">
                                <Badge variant="secondary" className="text-xs">
                                  {suggestion.title}
                                </Badge>
                                {suggestion.loading && (
                                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                                )}
                              </div>
                              {suggestion.content && (
                                <>
                                  <p className="text-sm text-muted-foreground line-clamp-3">
                                    {suggestion.content}
                                  </p>
                                  <div className="flex gap-2">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => applySuggestion(suggestion)}
                                      className="flex-1 gap-1"
                                    >
                                      <Check className="h-3 w-3" />
                                      Applica
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => copySuggestion(suggestion)}
                                      className="gap-1"
                                    >
                                      {copiedId === suggestion.id ? (
                                        <Check className="h-3 w-3 text-green-600" />
                                      ) : (
                                        <Copy className="h-3 w-3" />
                                      )}
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Editor Content */}
      <div className="relative">
        <EditorContent 
          editor={editor} 
          className="min-h-[200px] focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 rounded-b-lg"
        />
        {editor.isEmpty && (
          <div className="absolute top-4 left-4 text-muted-foreground pointer-events-none">
            {placeholder}
          </div>
        )}
      </div>

      {/* Word Count */}
      <div className="border-t px-4 py-2 bg-muted/20">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {editor.storage.characterCount?.characters() || 0} caratteri, {editor.storage.characterCount?.words() || 0} parole
          </span>
          {aiContext && (
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {aiContext.author || 'N/A'}
              </Badge>
              {aiContext.articleDate && (
                <Badge variant="outline" className="text-xs">
                  {new Date(aiContext.articleDate).toLocaleDateString('it-IT')}
                </Badge>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Custom Styles */}
      <style jsx>{`
        .ProseMirror {
          outline: none;
        }
        .ProseMirror a {
          color: #2563eb;
          text-decoration: underline;
        }
        .ProseMirror a:hover {
          color: #1d4ed8;
        }
        .ProseMirror blockquote {
          border-left: 4px solid #e5e7eb;
          padding-left: 1rem;
          margin: 1rem 0;
          font-style: italic;
        }
        .ProseMirror hr {
          border: none;
          border-top: 2px solid #e5e7eb;
          margin: 1.5rem 0;
        }
        .ProseMirror h1 {
          font-size: 1.5rem;
          font-weight: bold;
          margin: 1rem 0 0.5rem 0;
        }
        .ProseMirror h2 {
          font-size: 1.25rem;
          font-weight: bold;
          margin: 1rem 0 0.5rem 0;
        }
        .ProseMirror h3 {
          font-size: 1.125rem;
          font-weight: bold;
          margin: 1rem 0 0.5rem 0;
        }
        .ProseMirror ul, .ProseMirror ol {
          padding-left: 1.5rem;
          margin: 0.5rem 0;
        }
        .ProseMirror li {
          margin: 0.25rem 0;
        }
      `}</style>
    </div>
  );
}