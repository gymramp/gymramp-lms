
'use client';

import React, { useState, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css';
import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic'; // Moved to top

// Dynamically import ReactQuill at the module level
const ReactQuill = dynamic(() => import('react-quill'), {
    ssr: false,
    loading: () => (
        <div className="flex items-center justify-center h-32 border rounded-md bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Loading editor...</p>
        </div>
    ),
});

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

// Standard toolbar modules for ReactQuill
const modules = {
  toolbar: [
    [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
    ['bold', 'italic', 'underline', 'strike'],
    ['blockquote', 'code-block'],
    [{ 'list': 'ordered'}, { 'list': 'bullet' }],
    [{ 'script': 'sub'}, { 'script': 'super' }],
    [{ 'indent': '-1'}, { 'indent': '+1' }],
    [{ 'direction': 'rtl' }],
    [{ 'color': [] }, { 'background': [] }],
    [{ 'font': [] }],
    [{ 'align': [] }],
    ['link', 'image', 'video'], // Note: image/video might need custom handlers for uploads
    ['clean']
  ],
};

const formats = [
  'header', 'font', 'color', 'background',
  'bold', 'italic', 'underline', 'strike', 'blockquote', 'code-block',
  'list', 'bullet', 'script', 'indent', 'direction', 'align',
  'link', 'image', 'video'
];

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) {
    // This fallback can be the same as the loading state of dynamic import
    // or a simpler one if preferred.
    return (
        <div className="flex items-center justify-center h-32 border rounded-md bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Initializing editor...</p>
        </div>
    );
  }

  // Ensure ReactQuill is only rendered on the client and when it's ready
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
