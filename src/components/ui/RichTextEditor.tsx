
'use client';

import React, { useEffect } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Button } from '@/components/ui/button';
import { Bold, Italic, Strikethrough, List, ListOrdered, Heading1, Heading2, Heading3, Pilcrow, Quote, Code, Undo, Redo } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

const TipTapToolbar = ({ editor }: { editor: Editor | null }) => {
  if (!editor) {
    return null;
  }

  const toggleBold = () => editor.chain().focus().toggleBold().run();
  const toggleItalic = () => editor.chain().focus().toggleItalic().run();
  const toggleStrike = () => editor.chain().focus().toggleStrike().run();
  const toggleCode = () => editor.chain().focus().toggleCode().run();
  const toggleH1 = () => editor.chain().focus().toggleHeading({ level: 1 }).run();
  const toggleH2 = () => editor.chain().focus().toggleHeading({ level: 2 }).run();
  const toggleH3 = () => editor.chain().focus().toggleHeading({ level: 3 }).run();
  const toggleParagraph = () => editor.chain().focus().setParagraph().run();
  const toggleBulletList = () => editor.chain().focus().toggleBulletList().run();
  const toggleOrderedList = () => editor.chain().focus().toggleOrderedList().run();
  const toggleCodeBlock = () => editor.chain().focus().toggleCodeBlock().run();
  const toggleBlockquote = () => editor.chain().focus().toggleBlockquote().run();
  const undo = () => editor.chain().focus().undo().run();
  const redo = () => editor.chain().focus().redo().run();

  return (
    <div className="border border-input bg-transparent rounded-t-md p-2 flex flex-wrap gap-1">
      <Button type="button" variant={editor.isActive('bold') ? 'secondary' : 'ghost'} size="sm" onClick={toggleBold} disabled={!editor.can().toggleBold()} title="Bold"><Bold /></Button>
      <Button type="button" variant={editor.isActive('italic') ? 'secondary' : 'ghost'} size="sm" onClick={toggleItalic} disabled={!editor.can().toggleItalic()} title="Italic"><Italic /></Button>
      <Button type="button" variant={editor.isActive('strike') ? 'secondary' : 'ghost'} size="sm" onClick={toggleStrike} disabled={!editor.can().toggleStrike()} title="Strikethrough"><Strikethrough /></Button>
      <Button type="button" variant={editor.isActive('code') ? 'secondary' : 'ghost'} size="sm" onClick={toggleCode} disabled={!editor.can().toggleCode()} title="Inline Code"><Code /></Button>
      <Button type="button" variant={editor.isActive('heading', { level: 1 }) ? 'secondary' : 'ghost'} size="sm" onClick={toggleH1} title="Heading 1"><Heading1 /></Button>
      <Button type="button" variant={editor.isActive('heading', { level: 2 }) ? 'secondary' : 'ghost'} size="sm" onClick={toggleH2} title="Heading 2"><Heading2 /></Button>
      <Button type="button" variant={editor.isActive('heading', { level: 3 }) ? 'secondary' : 'ghost'} size="sm" onClick={toggleH3} title="Heading 3"><Heading3 /></Button>
      <Button type="button" variant={editor.isActive('paragraph') ? 'secondary' : 'ghost'} size="sm" onClick={toggleParagraph} title="Paragraph"><Pilcrow /></Button>
      <Button type="button" variant={editor.isActive('bulletList') ? 'secondary' : 'ghost'} size="sm" onClick={toggleBulletList} title="Bullet List"><List /></Button>
      <Button type="button" variant={editor.isActive('orderedList') ? 'secondary' : 'ghost'} size="sm" onClick={toggleOrderedList} title="Ordered List"><ListOrdered /></Button>
      <Button type="button" variant={editor.isActive('codeBlock') ? 'secondary' : 'ghost'} size="sm" onClick={toggleCodeBlock} title="Code Block"><Code /></Button>
      <Button type="button" variant={editor.isActive('blockquote') ? 'secondary' : 'ghost'} size="sm" onClick={toggleBlockquote} title="Blockquote"><Quote /></Button>
      <Button type="button" variant="ghost" size="sm" onClick={undo} disabled={!editor.can().undo()} title="Undo"><Undo /></Button>
      <Button type="button" variant="ghost" size="sm" onClick={redo} disabled={!editor.can().redo()} title="Redo"><Redo /></Button>
    </div>
  );
};

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // Configure StarterKit extensions as needed
        // For example, disable some if you don't want them:
        // heading: { levels: [1, 2, 3] },
        // codeBlock: false, // if you want to disable code blocks from starter kit
      }),
    ],
    content: value,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-xl focus:outline-none p-4 min-h-[150px] border border-input border-t-0 rounded-b-md bg-background text-foreground',
      },
    },
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
  });

  // Update editor content when the `value` prop changes externally
  useEffect(() => {
    if (editor && editor.getHTML() !== value) {
      editor.commands.setContent(value, false); // `false` to not emit update event
    }
  }, [value, editor]);
  
  // Add placeholder functionality (TipTap doesn't have a built-in placeholder prop like Quill)
  // This is a common pattern, but might need refinement based on user experience.
  useEffect(() => {
    if (editor && placeholder) {
      if (editor.isEmpty) {
        editor.chain().focus().insertContent(`<p class="is-editor-empty">${placeholder}</p>`).run();
      }
      editor.on('focus', ({ editor: currentEditor }) => {
        if (currentEditor.getText() === placeholder && currentEditor.isEmpty) {
          currentEditor.chain().clearContent().run();
        }
      });
      editor.on('blur', ({ editor: currentEditor }) => {
        if (currentEditor.isEmpty) {
          currentEditor.chain().insertContent(`<p class="is-editor-empty">${placeholder}</p>`).run();
        }
      });
    }
  }, [editor, placeholder]);


  return (
    <div className="tiptap-editor-wrapper">
      <TipTapToolbar editor={editor} />
      <EditorContent editor={editor} />
      <style jsx global>{`
        .tiptap-editor-wrapper .ProseMirror {
          min-height: 150px; /* Or your desired min height */
          outline: none;
        }
        .tiptap-editor-wrapper .ProseMirror p.is-editor-empty:first-child::before {
          content: attr(data-placeholder);
          float: left;
          color: #adb5bd; /* Muted color for placeholder */
          pointer-events: none;
          height: 0;
        }
      `}</style>
    </div>
  );
}
