'use client';
import {useId, useRef, useState} from 'react';
import {ImagePlus} from 'lucide-react';

/** Square drop or click zone for one logo image; the picker stays on the page. */
export default function LogoDrop({label, hint, disabled = false, onFile}: {label: string; hint: string; disabled?: boolean; onFile: (file: File) => void}) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const take = (files: FileList | null) => {if (!disabled && files?.[0]) onFile(files[0]);};
  return <div className={'logo-drop' + (dragging ? ' is-dragging' : '') + (disabled ? ' is-disabled' : '')}
    onDragOver={e => {e.preventDefault(); if (!disabled) {e.dataTransfer.dropEffect = 'copy'; setDragging(true);}}}
    onDragLeave={() => setDragging(false)}
    onDrop={e => {e.preventDefault(); setDragging(false); take(e.dataTransfer.files);}}>
    <button type="button" disabled={disabled} onClick={() => input.current?.click()} aria-describedby={id + '-hint'}>
      <ImagePlus size={28} aria-hidden/>
      <strong>{label}</strong>
      <span id={id + '-hint'}>{hint}</span>
    </button>
    <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden tabIndex={-1} disabled={disabled} aria-label={label} onChange={e => {take(e.target.files); e.target.value = '';}}/>
  </div>;
}
