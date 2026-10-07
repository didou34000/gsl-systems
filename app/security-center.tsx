'use client';

import {useEffect, useRef, useState, type FormEvent} from 'react';
import {useSearchParams} from 'next/navigation';
import {ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronDown, Copy, KeyRound, LoaderCircle, LockKeyhole, LogOut, MailCheck, RefreshCw, ShieldCheck, Smartphone, Trash2} from 'lucide-react';
import Link from '@/components/site-link';
import {localizedHref} from '@/lib/i18n/languages';
import {normalizeAuthenticatorCode} from '@/lib/security/code';
import {securityTranslate, type SecurityKey} from '@/lib/security/translations';
import {LanguageSelector, useLanguage} from './language';

type Factor = {id: string; name: string; status: 'verified' | 'unverified'};
type Snapshot = {email: string; factors: Factor[]; level: string; nextLevel: string};
type Enrollment = {factor: string; secret: string; qrCode: string};
const errorKeys: Record<string, SecurityKey> = {
  CODE_INVALID: 'invalidCode', RATE_LIMITED: 'rateLimited', RATE_LIMIT: 'rateLimited', LOGIN_REQUIRED: 'expired',
  FORBIDDEN: 'forbidden', ENROLLMENT_PENDING: 'enrollmentPending', ENROLLMENT_UNAVAILABLE: 'enrollmentUnavailable', MFA_REQUIRED: 'sessionNote',
};

async function readSecurity(signal?: AbortSignal): Promise<Snapshot> {
  const response = await fetch('/api/account/mfa', {cache: 'no-store', signal});
  const data = await response.json() as Snapshot & {error?: string};
  if (!response.ok) throw Error(data.error || 'UNAVAILABLE');
  return data as Snapshot;
}

export default function SecurityCenter() {
  const {language} = useLanguage();
  const t = (key: SecurityKey) => securityTranslate(language, key);
  const query = useSearchParams();
  // Only known workspace destinations are offered after the security check.
  const next = query.get('next');
  const destination = next === '/administration' || next === '/administration/revue' ? next : '/compte';
  const continueKey = destination === '/administration' ? 'continueAdmin' : destination === '/administration/revue' ? 'continueReviews' : 'continueAccount';
  const loginHref = '/connexion?next=' + encodeURIComponent('/compte/securite?next=' + encodeURIComponent(destination));
  const [data, setData] = useState<Snapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [confirmStep, setConfirmStep] = useState(false);
  const [selectedFactor, setSelectedFactor] = useState('');
  const [code, setCode] = useState('');
  const [copyState, setCopyState] = useState<'copied' | 'failed' | ''>('');
  const actionLock = useRef(false);
  const actionController = useRef<AbortController | null>(null);
  const codeInput = useRef<HTMLInputElement>(null);
  const stepHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    readSecurity(controller.signal).then(snapshot => {
      setData(snapshot); setError('');
    }).catch(caught => {
      if (!controller.signal.aborted) { setData(null); setError(caught instanceof Error ? caught.message : 'UNAVAILABLE'); }
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => actionController.current?.abort(), []);

  const verifiedFactors = data?.factors.filter(factor => factor.status === 'verified') ?? [];
  const pendingFactors = data?.factors.filter(factor => factor.status === 'unverified') ?? [];
  const choices = verifiedFactors.length ? verifiedFactors : pendingFactors;
  const factorId = enrollment?.factor || (choices.some(factor => factor.id === selectedFactor) ? selectedFactor : choices[0]?.id) || '';
  const isVerified = data?.level === 'aal2';
  const stage = isVerified ? 'success' : enrollment ? (confirmStep ? 'code' : 'scan') : verifiedFactors.length ? 'session' : pendingFactors.length ? 'resume' : 'prepare';
  const codeVisible = stage === 'code' || stage === 'session' || stage === 'resume';
  useEffect(() => {
    if (loading || !data || busy) return;
    if (codeVisible) codeInput.current?.focus();
    else if (stage === 'scan' || stage === 'success') stepHeading.current?.focus();
  }, [stage, codeVisible, loading, data, busy]);

  function clearSetup() {
    setEnrollment(null); setConfirmStep(false); setCopyState(''); setCode(''); setSelectedFactor('');
  }
  function refresh() {
    if (actionLock.current) return;
    clearSetup(); setLoading(true); setError(''); setAttempt(value => value + 1);
  }

  async function run(action: 'enroll' | 'verify' | 'discard' | 'logout', factor = factorId) {
    if (actionLock.current) return;
    actionLock.current = true;
    const controller = new AbortController();
    actionController.current = controller;
    setBusy(action); setError('');
    try {
      const payload = action === 'enroll' || action === 'logout' ? {action} : action === 'verify' ? {action, factor, code} : {action, factor};
      const response = await fetch(action === 'logout' ? '/api/auth' : '/api/account/mfa', {
        method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload), signal: controller.signal,
      });
      const result = await response.json() as Enrollment & {error?: string};
      if (!response.ok) throw Error(result.error || 'UNAVAILABLE');
      if (action === 'logout') {
        clearSetup(); setData(null);
        window.location.assign(localizedHref('/connexion', language));
      } else if (action === 'enroll') {
        setEnrollment(result as Enrollment); setConfirmStep(false); setCopyState(''); setCode('');
      } else {
        clearSetup();
        // Only the server can confirm that the updated cookie/session is really AAL2.
        try { setData(await readSecurity(controller.signal)); }
        catch (caught) { setData(null); throw caught; }
      }
    } catch (caught) {
      if (!controller.signal.aborted) {
        const reason = caught instanceof Error ? caught.message : 'UNAVAILABLE';
        setError(reason);
        if (reason === 'LOGIN_REQUIRED') { clearSetup(); setData(null); }
        if (action === 'verify') { setCode(''); codeInput.current?.focus(); }
      }
    } finally {
      actionLock.current = false;
      if (!controller.signal.aborted) setBusy('');
    }
  }

  async function copyKey() {
    if (!enrollment) return;
    try { await navigator.clipboard.writeText(enrollment.secret); setCopyState('copied'); }
    catch { setCopyState('failed'); }
  }
  function submitCode(event: FormEvent) {
    event.preventDefault();
    if (/^\d{6}$/.test(code)) void run('verify');
  }

  const titleKey = stage === 'prepare' ? 'introTitle' : stage === 'scan' ? 'scanTitle' : stage === 'resume' ? 'resumeTitle' : stage === 'session' ? 'sessionTitle' : stage === 'success' ? 'successTitle' : 'codeTitle';
  const noteKey = stage === 'prepare' ? 'introNote' : stage === 'scan' ? 'scanNote' : stage === 'resume' ? 'resumeNote' : stage === 'session' ? 'sessionNote' : stage === 'success' ? 'successNote' : 'codeNote';
  const stepIndex = stage === 'prepare' ? 0 : stage === 'scan' ? 1 : 2;
  const setupFlow = !verifiedFactors.length && !isVerified;
  const qrSource = enrollment?.qrCode.startsWith('data:image/') ? enrollment.qrCode : enrollment?.qrCode ? 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(enrollment.qrCode) : '';

  return <div className="security-shell">
    <header className="security-topbar">
      <Link href="/" className="security-brand" aria-label="GSL systems"><svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path d="m13 20-2 2a6 6 0 0 1-8-8l6-6a6 6 0 0 1 8 0M19 12l2-2a6 6 0 0 1 8 8l-6 6a6 6 0 0 1-8 0M11 21l10-10" stroke="currentColor" strokeWidth="3.3" strokeLinecap="round"/></svg><span>GSL <b>systems</b></span></Link>
      <div><LanguageSelector/><Link className="security-back" href="/compte"><ArrowLeft size={16} aria-hidden/>{t('back')}</Link></div>
    </header>
    <main className="security-main">
      <header className="security-heading"><span className="security-eyebrow"><ShieldCheck size={15} aria-hidden/>GSL SYSTEMS</span><h1>{t('title')}</h1><p>{t('subtitle')}</p></header>
      {loading ? <div className="security-gate" role="status"><LoaderCircle className="security-spinner" size={28}/><p>{t('loading')}</p></div> : !data ? <section className="security-gate">
        <span className="security-large-icon"><LockKeyhole size={30} aria-hidden/></span>
        <h2>{t(error === 'LOGIN_REQUIRED' ? 'signInTitle' : 'entryTitle')}</h2>
        <p role={error === 'LOGIN_REQUIRED' ? undefined : 'alert'}>{t(error === 'LOGIN_REQUIRED' ? 'signInNote' : errorKeys[error] || 'unavailable')}</p>
        {error === 'LOGIN_REQUIRED' ? <Link className="security-button primary" href={loginHref}>{t('signIn')}<ArrowRight size={17} aria-hidden/></Link> : <button className="security-button primary" onClick={refresh}><RefreshCw size={17} aria-hidden/>{t('retry')}</button>}
      </section> : <>
        <div className="security-status-grid">
          <div className="security-status-card"><MailCheck size={20} aria-hidden/><div><span>{t('account')}</span><strong><bdi>{data.email}</bdi></strong><small>{t('emailVerified')}</small></div></div>
          <div className="security-status-card"><Smartphone size={20} aria-hidden/><div><span>{t('protection')}</span><strong className={verifiedFactors.length ? 'security-green' : ''}>{t(verifiedFactors.length ? 'active' : 'inactive')}</strong><small>{t(verifiedFactors.length ? 'savedApp' : 'stepApp')}</small></div></div>
          <div className="security-status-card"><ShieldCheck size={20} aria-hidden/><div><span>{t('session')}</span><strong className={isVerified ? 'security-green' : ''}>{t(isVerified ? 'verified' : 'verificationNeeded')}</strong><small>{t('protection')}</small></div></div>
        </div>
        <div className="security-columns"><div className="security-primary-column">
          <section className={'security-panel security-flow' + (isVerified ? ' security-complete' : '')} aria-labelledby="security-step-title" aria-busy={Boolean(busy)}>
            {setupFlow && <ol className="security-steps" aria-label={t('protection')}>{(['stepApp', 'stepScan', 'stepVerify'] as const).map((key, index) => <li key={key} className={index < stepIndex ? 'done' : index === stepIndex ? 'current' : ''} aria-current={index === stepIndex ? 'step' : undefined}><span>{index < stepIndex ? <Check size={14} aria-hidden/> : index + 1}</span>{t(key)}</li>)}</ol>}
            <div className={'security-large-icon' + (isVerified ? ' success' : '')}>{isVerified ? <ShieldCheck size={32} aria-hidden/> : stage === 'scan' ? <Smartphone size={29} aria-hidden/> : <LockKeyhole size={29} aria-hidden/>}</div>
            <h2 id="security-step-title" tabIndex={-1} ref={stepHeading}>{t(titleKey)}</h2><p className="security-flow-note">{t(noteKey)}</p>
            {error && <div className="security-alert" role="alert"><p>{t(errorKeys[error] || 'unavailable')}</p>{['FORBIDDEN', 'ENROLLMENT_PENDING', 'MFA_REQUIRED'].includes(error) && <button disabled={Boolean(busy)} onClick={refresh}>{t('refresh')}</button>}</div>}
            {stage === 'prepare' && <>
              <div className="security-app-guide"><Smartphone size={26} aria-hidden/><div><h3>{t('appTitle')}</h3><p>{t('appNote')}</p><small>{t('appHint')}</small></div></div>
              <button className="security-button primary" disabled={Boolean(busy)} onClick={() => void run('enroll')}>{busy ? t('working') : t('start')}<ArrowRight size={17} aria-hidden/></button>
            </>}
            {stage === 'scan' && enrollment && <>
              <div className="security-qr">{qrSource && <img src={qrSource} alt={t('qrAlt')} width={200} height={200}/>}</div>
              <details className="security-manual"><summary>{t('manual')}<ChevronDown size={16} aria-hidden/></summary><p>{t('manualNote')}</p><code dir="ltr">{enrollment.secret}</code><button className="security-button" onClick={() => void copyKey()}><Copy size={15} aria-hidden/>{t(copyState === 'copied' ? 'copied' : 'copy')}</button><p role="status">{copyState === 'failed' ? t('copyError') : copyState === 'copied' ? t('copied') : t('privateKey')}</p></details>
              <div className="security-actions"><button className="security-button primary" disabled={Boolean(busy)} onClick={() => {setConfirmStep(true); setError('');}}>{t('scanned')}<ArrowRight size={17} aria-hidden/></button><button className="security-text-button" disabled={Boolean(busy)} onClick={() => void run('discard')}>{busy ? t('working') : t('cancel')}</button></div>
            </>}
            {codeVisible && <form className="security-code-form" onSubmit={submitCode}>
              {!enrollment && choices.length > 1 && <label htmlFor="security-factor">{t('selectApp')}<select id="security-factor" value={factorId} disabled={Boolean(busy)} onChange={event => {setSelectedFactor(event.target.value); setCode(''); setError('');}}>{choices.map(factor => <option key={factor.id} value={factor.id}>{factor.name}</option>)}</select></label>}
              <label htmlFor="security-code">{t('codeLabel')}</label>
              <input ref={codeInput} id="security-code" name="code" className="security-code" type="text" dir="ltr" inputMode="numeric" autoComplete="one-time-code" required pattern="[0-9]{6}" placeholder="000000" value={code} disabled={Boolean(busy)} aria-invalid={error === 'CODE_INVALID'} aria-describedby="security-code-hint" onChange={event => {setCode(normalizeAuthenticatorCode(event.target.value)); if (error === 'CODE_INVALID') setError('');}}/>
              <p id="security-code-hint">{t('codeHint')}</p>
              <button className="security-button primary" type="submit" disabled={Boolean(busy) || code.length !== 6}>{busy ? <><LoaderCircle className="security-spinner" size={17} aria-hidden/>{t('verifying')}</> : <><ShieldCheck size={17} aria-hidden/>{t('verify')}</>}</button>
              {stage === 'code' && <button className="security-text-button" type="button" disabled={Boolean(busy)} onClick={() => {setConfirmStep(false); setError(''); setCode('');}}>{t('backToScan')}</button>}
              {stage === 'resume' && <button className="security-text-button" type="button" disabled={Boolean(busy)} onClick={() => void run('discard')}>{t('restart')}</button>}
            </form>}
            {isVerified && <><div className="security-confirmation"><CheckCircle2 size={18} aria-hidden/>{t('verified')} · <bdi>{data.email}</bdi></div><Link className="security-button primary" href={destination}>{t(continueKey)}<ArrowRight size={17} aria-hidden/></Link><p className="security-access-note">{t('accessNote')}</p></>}
          </section>
          {pendingFactors.length > 0 && verifiedFactors.length > 0 && <details className="security-panel security-pending"><summary>{t('pendingTitle')}<ChevronDown size={17} aria-hidden/></summary><p>{t('pendingNote')}</p>{pendingFactors.map(factor => <div key={factor.id}><span>{factor.name}</span><button disabled={Boolean(busy)} className="security-text-button" onClick={() => void run('discard', factor.id)}><Trash2 size={15} aria-hidden/>{t('removePending')}</button></div>)}</details>}
          <section className="security-panel security-options"><h2>{t('otherTitle')}</h2><div><KeyRound size={21} aria-hidden/><div><h3>{t('password')}</h3><p>{t('passwordNote')}</p><Link href={'/mot-de-passe-oublie?next=' + encodeURIComponent('/compte/securite?next=' + encodeURIComponent(destination))}>{t('passwordAction')}<ArrowRight size={15} aria-hidden/></Link></div></div><div><LogOut size={21} aria-hidden/><div><h3>{t('signOut')}</h3><p>{t('signOutNote')}</p><button disabled={Boolean(busy)} onClick={() => void run('logout')}>{busy === 'logout' ? t('working') : t('signOut')}<ArrowRight size={15} aria-hidden/></button></div></div></section>
        </div><aside className="security-help"><div className="security-help-heading"><ShieldCheck size={24} aria-hidden/><h2>{t('helpTitle')}</h2></div>{(['helpCode', 'helpPhone', 'helpPrivacy'] as const).map((key, index) => <details key={key} open={index === 0 ? true : undefined}><summary>{t(key)}<ChevronDown size={16} aria-hidden/></summary><p>{t((key + 'Note') as SecurityKey)}</p>{key === 'helpPhone' && <Link href="/contact">{t('contact')}<ArrowRight size={15} aria-hidden/></Link>}</details>)}<p className="security-help-footer"><LockKeyhole size={14} aria-hidden/>{t('privateKey')}</p></aside></div>
      </>}
    </main>
  </div>;
}
