'use client';
import {useLanguage} from '@/app/language';
import {usePathname} from 'next/navigation';
import type {ComponentProps} from 'react';
// Keep native URLs and modified-click behavior. Explicit same-origin navigation
// avoids renderer interception of links after a catalogue refresh.
export default function SiteLink({href,onClick,target,...props}:ComponentProps<'a'>){const {language}=useLanguage();const path=usePathname();let destination=path?.startsWith('/demo')&&href&&/^\/(catalogue|fabricants|produits)(\/|\?|$)/.test(href)?'/demo'+href:href;if(language==='fr'&&destination?.startsWith('/')&&!destination.startsWith('//')&&!destination.startsWith('/api/')){const url=new URL(destination,'https://gsl.invalid');url.searchParams.set('lang','fr');destination=url.pathname+url.search+url.hash}return <a {...props} href={destination} target={target} onClick={event=>{onClick?.(event);if(destination?.startsWith('/')&&!destination.startsWith('//')&&event.button===0&&!event.metaKey&&!event.ctrlKey&&!event.shiftKey&&!event.altKey&&(!target||target==='_self')){event.preventDefault();event.stopPropagation();window.location.assign(destination)}}}/>}
