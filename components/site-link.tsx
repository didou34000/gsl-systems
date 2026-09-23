'use client';
import type {ComponentProps} from 'react';
// Keep native URLs and modified-click behavior. Explicit same-origin navigation
// avoids renderer interception of links after a catalogue refresh.
export default function SiteLink({href,onClick,target,...props}:ComponentProps<'a'>){return <a {...props} href={href} target={target} onClick={event=>{onClick?.(event);if(href?.startsWith('/')&&!href.startsWith('//')&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&(!target||target==='_self')){event.preventDefault();event.stopPropagation();window.location.assign(href)}}}/>}
