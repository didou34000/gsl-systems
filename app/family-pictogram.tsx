import type {ReactNode} from 'react';

/** One optical grid and line weight for all eight generic component silhouettes. */
const drawings:Record<string,ReactNode>={
 'actionnement-transmission':<>
  <rect className="family-pictogram-fill" x="12" y="21" width="35" height="29" rx="4"/>
  <rect x="12" y="21" width="30" height="29" rx="4"/>
  <path d="M20 21v29m7-29v29M35 21v29"/>
  <rect x="42" y="18" width="9" height="35" rx="2"/>
  <path d="M51 32h8v7h-8"/>
  <rect x="20" y="11" width="16" height="10" rx="2"/>
  <path d="M46.5 23v2m0 21v2"/>
 </>,
 'transmissions-guidages':<>
  <circle className="family-pictogram-fill" cx="32" cy="32" r="24"/>
  <circle cx="32" cy="32" r="24"/><circle cx="32" cy="32" r="17"/>
  <circle cx="32" cy="32" r="7"/>
  <path d="M32 25v-3m7 10h3m-10 7v3m-7-10h-3"/>
  <circle cx="18" cy="18" r="2"/><circle cx="46" cy="18" r="2"/>
  <circle cx="18" cy="46" r="2"/><circle cx="46" cy="46" r="2"/>
 </>,
 'capteurs-vision':<>
  <rect className="family-pictogram-fill" x="8" y="18" width="48" height="29" rx="5"/>
  <rect x="8" y="18" width="48" height="29" rx="5"/>
  <circle cx="21" cy="32.5" r="8"/><circle cx="21" cy="32.5" r="3.5"/>
  <circle cx="43" cy="32.5" r="8"/><circle cx="43" cy="32.5" r="3.5"/>
  <path d="M22 18v-6h20v6M26 47v7h12v-7"/>
 </>,
 'commande-electronique':<>
  <rect className="family-pictogram-fill" x="8" y="10" width="48" height="44" rx="4"/>
  <rect x="8" y="10" width="48" height="44" rx="4"/>
  <rect x="23" y="23" width="18" height="18" rx="2"/>
  <path d="M27 23v-5m5 5v-5m5 5v-5M27 41v5m5-5v5m5-5v5M23 27h-5m5 5h-5m5 5h-5M41 27h5m-5 5h5m-5 5h5"/>
  <circle cx="14" cy="16" r="1.5"/><circle cx="50" cy="16" r="1.5"/>
  <circle cx="14" cy="48" r="1.5"/><circle cx="50" cy="48" r="1.5"/>
 </>,
 'cables-connecteurs':<>
  <rect className="family-pictogram-fill" x="34" y="10" width="20" height="17" rx="3"/>
  <rect x="34" y="10" width="20" height="17" rx="3"/>
  <path d="M39 10V7m5 3V7m5 3V7M34 16h-6v6h6"/>
  <path d="M28 16h-6c-9 0-14 8-14 16v8c0 8 5 14 13 14h9m-2-32h-6c-5 0-8 4-8 10v8c0 5 3 8 7 8h9"/>
  <rect className="family-pictogram-fill" x="30" y="43" width="24" height="13" rx="3"/>
  <rect x="30" y="43" width="24" height="13" rx="3"/>
  <path d="M48 43v13m-9-8v3m5-3v3"/>
 </>,
 'energie-batteries':<>
  <rect className="family-pictogram-fill" x="8" y="19" width="48" height="33" rx="4"/>
  <rect x="8" y="19" width="48" height="33" rx="4"/>
  <path d="M16 19v-7h9v7m14 0v-7h9v7M25 19v33m14-33v33"/>
  <path d="M14 35h6m-3-3v6m27-3h6"/>
 </>,
 prehension:<>
  <rect className="family-pictogram-fill" x="17" y="16" width="30" height="18" rx="3"/>
  <rect x="12" y="8" width="40" height="8" rx="2"/>
  <rect x="17" y="16" width="30" height="18" rx="3"/>
  <path d="M24 24h16M17 25h-5m35 0h5"/>
  <path d="M21 34v7L11 55h10l11-15m11-6v7l10 14H43L32 40"/>
 </>,
 'pieces-mecaniques':<>
  <path className="family-pictogram-fill" d="M12 10h14v28h28v16H12z"/>
  <path d="M12 10h14v28h28v16H12z"/>
  <path d="M26 10l7 7v14h14l7 7"/>
  <circle cx="19" cy="19" r="2.5"/><circle cx="19" cy="30" r="2.5"/>
  <circle cx="35" cy="46" r="2.5"/><circle cx="46" cy="46" r="2.5"/>
 </>,
};

export default function FamilyPictogram({family}:{family:string}){
 const drawing=drawings[family];
 if(!drawing)return null;
 return <svg className="family-pictogram" viewBox="0 0 64 64" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">{drawing}</svg>;
}
