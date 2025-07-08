
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { User as UserIcon, Loader2, HelpCircle, Send, MessageCircleQuestion } from 'lucide-react';
import { askSiteSupport } from '@/ai/flows/site-support';
import type { User } from '@/types/user';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getUserByEmail } from '@/lib/user-data';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function AiChatAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser?.email) {
        const userDetails = await getUserByEmail(firebaseUser.email);
        setCurrentUser(userDetails);
      } else {
        setCurrentUser(null);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load chat history from localStorage when the component mounts or the user changes.
  useEffect(() => {
    if (currentUser) {
      try {
        const key = `chatHistory_${currentUser.id}`;
        const savedMessages = localStorage.getItem(key);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          // If no history, start with a welcome message.
          setMessages([
            { role: 'assistant', content: `Hello ${currentUser.name}! I'm your AI support assistant. How can I help you today?` }
          ]);
        }
      } catch (error) {
        console.error("Failed to load chat history from localStorage:", error);
        // On error, start with a fresh welcome message.
        setMessages([
          { role: 'assistant', content: `Hello ${currentUser.name}! I'm your AI support assistant. How can I help you today?` }
        ]);
      }
    } else {
      // Clear messages if there's no user.
      setMessages([]);
    }
  }, [currentUser]); // This effect depends on the user object.

  // Save chat history to localStorage whenever messages change.
  useEffect(() => {
    if (currentUser && messages.length > 0) {
      try {
        const key = `chatHistory_${currentUser.id}`;
        localStorage.setItem(key, JSON.stringify(messages));
      } catch (error) {
        console.error("Failed to save chat history to localStorage:", error);
      }
    }
  }, [messages, currentUser]);


  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({
        top: scrollAreaRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim() || !currentUser) return;

    const userMessage: Message = { role: 'user', content: inputValue };
    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    try {
      const result = await askSiteSupport({
        query: inputValue,
        userRole: currentUser.role,
      });
      const assistantMessage: Message = { role: 'assistant', content: result.response };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error asking site support:", error);
      const errorMessage: Message = { role: 'assistant', content: "Sorry, I encountered an error. Please try again." };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSheetOpenChange = (open: boolean) => {
    setIsOpen(open);
  };
  
  if (!currentUser) {
    return null;
  }

  return (
    <Sheet open={isOpen} onOpenChange={handleSheetOpenChange}>
      <SheetTrigger asChild>
        <Button
          variant="default"
          size="icon"
          title="Help and Support"
          className="fixed bottom-6 right-6 h-16 w-16 rounded-full shadow-lg z-50 animate-in fade-in-0 zoom-in-95 duration-500 bg-primary hover:bg-primary/90"
        >
          <MessageCircleQuestion className="h-10 w-10" />
          <span className="sr-only">Open Help and Support</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Gymramp Help and Support
          </SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1 p-4" ref={scrollAreaRef as any}>
          <div className="space-y-6">
            {messages.map((message, index) => (
              <div key={index} className={cn("flex items-start gap-3", message.role === 'user' ? 'justify-end' : '')}>
                {message.role === 'assistant' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                )}
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-4 py-2 text-sm",
                    message.role === 'assistant'
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-primary text-primary-foreground"
                  )}
                >
                  <ReactMarkdown
                    className="prose prose-sm dark:prose-invert max-w-none"
                    components={{
                        p: ({node, ...props}) => <p className="mb-2 last:mb-0" {...props} />,
                        a: ({node, ...props}) => <a className="text-accent underline" {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                </div>
                 {message.role === 'user' && (
                  <div className="flex-shrink-0 h-8 w-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                    <UserIcon className="h-5 w-5" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex items-start gap-3">
                 <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                    <HelpCircle className="h-5 w-5" />
                  </div>
                <div className="bg-secondary rounded-lg px-4 py-3 flex items-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-background">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Ask a question about the site..."
              className="flex-1"
              disabled={isLoading}
              autoComplete="off"
            />
            <Button type="submit" size="icon" disabled={isLoading || !inputValue.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Send</span>
            </Button>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  );
}
