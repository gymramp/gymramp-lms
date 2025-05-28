
'use client';

import React, { useState, useEffect } from 'react';
import 'react-quill/dist/quill.snow.css'; // Import Quill styles
import { Loader2 } from 'lucide-react';

// Dynamically import ReactQuill only on the client side
const ReactQuill = dynamic(() => import('react-quill'), {
  ssr: false, // Ensure it's not server-side rendered
  // We'll handle loading state within the component itself
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
    // This effect runs only on the client side, after the initial render.
    setIsClient(true);
  }, []);

  if (!isClient) {
    // Render a placeholder or loading state on the server and initial client render.
    // This must be consistent between server and initial client.
    return (
        <div className="flex items-center justify-center h-32 border rounded-md bg-muted">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <p className="ml-2 text-muted-foreground">Loading editor...</p>
        </div>
    );
  }

  // ReactQuill is now guaranteed to only render on the client after mounting.
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
