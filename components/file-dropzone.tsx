'use client';

import {useId, useRef, useState} from 'react';
import {UploadCloud} from 'lucide-react';

/** One selection path for native picker, keyboard and dropped files. */
export default function FileDropzone({label, hint, accept, multiple = false, disabled = false, onFiles, className = ''}: {
  label: string;
  hint: string;
  accept: string;
  multiple?: boolean;
  disabled?: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const depth = useRef(0);
  const [dragging, setDragging] = useState(false);
  function select(files: FileList | null) {
    if (disabled || input.current?.matches(':disabled') || !files?.length) return;
    onFiles(multiple ? Array.from(files) : [files[0]]);
  }
  return <div className={`gsl-file-drop ${dragging ? 'is-dragging' : ''} ${disabled ? 'is-disabled' : ''} ${className}`}
    onDragEnter={event => {event.preventDefault(); if (!disabled && !input.current?.matches(':disabled') && event.dataTransfer.types.includes('Files')) {depth.current++; setDragging(true);}}}
    onDragOver={event => {event.preventDefault(); event.dataTransfer.dropEffect = disabled || input.current?.matches(':disabled') ? 'none' : 'copy';}}
    onDragLeave={event => {event.preventDefault(); depth.current = Math.max(0, depth.current - 1); if (!depth.current) setDragging(false);}}
    onDrop={event => {event.preventDefault(); event.stopPropagation(); depth.current = 0; setDragging(false); select(event.dataTransfer.files);}}>
    <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={`${id}-hint`}>
      <UploadCloud size={28} aria-hidden="true"/>
      <strong>{label}</strong>
      <span id={`${id}-hint`}>{hint}</span>
    </button>
    <input ref={input} id={id} type="file" accept={accept} multiple={multiple} disabled={disabled} aria-label={label} tabIndex={-1} hidden
      onChange={event => {select(event.target.files); event.target.value = '';}}/>
  </div>;
}
