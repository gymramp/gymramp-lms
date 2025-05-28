
'use client';

import React, { useState, useEffect, useMemo } from 'react';
import 'react-quill/dist/quill.snow.css'; // or 'quill.bubble.css' for a different theme
import type { Value } from 'react-quill';
import { Loader2 } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const ReactQuill = useMemo(
    () => dynamic(() => import('react-quill'), { 
        ssr: false,
        loading: () => (
            <div className="flex items-center justify-center h-32 border rounded-md bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <p className="ml-2 text-muted-foreground">Loading editor...</p>
            </div>
        )
    }),
    []
  );
  
  const modules = {
    toolbar: [
      [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
      ['bold', 'italic', 'underline', 'strike'],        // toggled buttons
      ['blockquote', 'code-block'],
      [{ 'list': 'ordered'}, { 'list': 'bullet' }],
      [{ 'script': 'sub'}, { 'script': 'super' }],      // superscript/subscript
      [{ 'indent': '-1'}, { 'indent': '+1' }],          // outdent/indent
      [{ 'direction': 'rtl' }],                         // text direction
      [{ 'color': [] }, { 'background': [] }],          // dropdown with defaults from theme
      [{ 'font': [] }],
      [{ 'align': [] }],
      ['link', 'image', 'video'],                      // link, image, video
      ['clean']                                         // remove formatting button
    ],
  };

  const formats = [
    'header', 'font', 'color', 'background',
    'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
    'list', 'bullet', 'script', 'indent', 'direction', 'align',
    'link', 'image', 'video'
  ];

  if (!isClient) {
    // Render a placeholder or skeleton while waiting for client-side mount
    // This matches what the dynamic import's loading() would show if it was part of a Suspense boundary
    return (
        <div className="flex items-center justify-center h-32 border rounded-md bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Initializing editor...</p>
        </div>
    );
  }

  return (
    <ReactQuill
      theme="snow"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      modules={modules}
      formats={formats}
      className="bg-background" // Ensure editor background matches theme
    />
  );
}

// Need to import dynamic separately if not already available globally
// This line is usually not needed if using Next.js >= 10 as `dynamic` is built-in
import dynamic from 'next/dynamic';
