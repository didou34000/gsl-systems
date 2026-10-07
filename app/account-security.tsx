'use client';
import {ArrowRight, ShieldCheck} from 'lucide-react';
import Link from '@/components/site-link';
import {securityTranslate} from '@/lib/security/translations';
import {useLanguage} from './language';

export default function AccountSecurity() {
  const {language} = useLanguage();
  return <section id="security" className="security-entry">
    <ShieldCheck size={25} aria-hidden/>
    <div><h2>{securityTranslate(language, 'entryTitle')}</h2><p>{securityTranslate(language, 'entryNote')}</p>
      <Link href="/compte/securite">{securityTranslate(language, 'entryAction')}<ArrowRight size={16} aria-hidden/></Link>
    </div>
  </section>;
}
