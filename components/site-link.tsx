'use client';
import {localizedHref} from '@/lib/i18n/languages';
import {useLanguage} from '@/app/language';
import {usePathname} from 'next/navigation';
import type {ComponentProps} from 'react';
// Keep native URLs and modified-click behavior. Explicit same-origin navigation
// avoids renderer interception of links after a catalogue refresh.
export default function SiteLink({href,onClick,target,...props}:ComponentProps<'a'>){const {language}=useLanguage();const path=usePathname();let destination=path?.startsWith('/demo')&&href&&/^\/(catalogue|fabricants|produits)(\/|\?|$)/.test(href)?'/demo'+href:href;if(destination)destination=localizedHref(destination,language);return <a {...props} href={destination} target={target} onClick={event=>{onClick?.(event);if(!event.defaultPrevented&&destination?.startsWith('/')&&!destination.startsWith('//')&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&(!target||target==='_self')){event.preventDefault();event.stopPropagation();window.location.assign(destination)}}}/>}
