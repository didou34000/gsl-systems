'use client';
import RoboticsProductSummary from './robotics-product-summary';

import {ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, CalendarDays, ChevronDown, ClipboardList, FileText, Globe2, MessageSquare, Package, Settings2} from 'lucide-react';
import Link from '@/components/site-link';
import CountryFlag from '@/components/country-flag';
import {countryName} from '@/lib/country-names';
import {companyResearch, safeSourceUrl, type CompanyResearch, type ProductResearch, type ResearchSource} from '@/lib/catalogue-research';
import {gslContactHref, publishedPrice, researchDate, researchValue} from '@/lib/catalogue-display';
import {useLanguage} from './language';
import {CategoryIcon, CompanyMark, ProductCard, ProductVisual, ResearchLabel, useCategoryLabel} from './catalogue-cards';
import {SaveProduct} from './saved-selection';
import {CompareProduct} from './compare-product';
import type {PublicProduct, PublicSupplier} from './public-profiles';
import './research-profile-sections.css';

type Fact = [string, unknown];

function Facts({rows}: {rows: Fact[]}) {
  const {l} = useLanguage();
  return <dl className="catalogue-spec-table research-facts">{rows.map(([label, value], index) => {
    const text = researchValue(value);
    return <div key={label + index}><dt>{label}</dt><dd dir="auto" className={text === null ? 'research-missing' : undefined}>{text ?? l('Not disclosed', 'Non communiqué')}</dd></div>;
  })}</dl>;
}

function Sources({sources, compact = false}: {sources: ResearchSource[]; compact?: boolean}) {
  const {l} = useLanguage();
  const seen = new Set<string>();
  const safe = sources.flatMap(source => {
    const url = safeSourceUrl(source.url);
    if (!url || seen.has(url)) return [];
    seen.add(url);
    return [{...source, url}];
  });
  if (!safe.length) return <p className="research-missing">{l('No public source linked.', 'Aucune source publique liée.')}</p>;
  const list = <ol className="research-sources">{safe.map(source => <li key={source.url}>
    <a href={source.url} target="_blank" rel="noopener noreferrer"><FileText size={16} aria-hidden/><span>{source.title || new URL(source.url).hostname}</span><ArrowUpRight size={15} aria-hidden/></a>
    <small>{new URL(source.url).hostname.replace(/^www\./, '')}</small>
    {source.supports && <p dir="auto">{source.supports}</p>}
  </li>)}</ol>;
  return compact ? <details className="research-source-disclosure"><summary><BookOpen size={15} aria-hidden/>{l('Consult the sources', 'Consulter les sources')}<span>{safe.length}</span><ChevronDown size={15} aria-hidden/></summary>{list}</details> : list;
}

function Checked({date, reference}: {date: string; reference: string}) {
  const {l, language} = useLanguage();
  return <div className="research-checked"><span><CalendarDays size={14} aria-hidden/>{l('Documentation checked on', 'Documentation consultée le')} <time dateTime={date}>{researchDate(date, language)}</time></span><span>{l('GSL reference', 'Référence GSL')} · {reference}</span></div>;
}

function Evidence({research}: {research: CompanyResearch}) {
  const {l} = useLanguage();
  const labels = {
    D: l('Document inspected', 'Document consulté'),
    R: l('Official third-party register inspected', 'Registre tiers officiel consulté'),
    F: l('Manufacturer statement', 'Déclaration du fabricant'),
    H: l('Historical or expired evidence', 'Preuves historiques ou expirées'),
    N: l('No public evidence found', 'Aucune preuve publique retrouvée'),
  };
  return <section className="catalogue-panel research-evidence" id="certifications">
    <div className="research-section-heading"><span className="research-section-icon"><ClipboardList size={23} aria-hidden/></span><div><p className="eyebrow">{l('Documentary evidence', 'Preuves documentaires')}</p><h2>{l('Certifications, labels and scope', 'Certifications, labels et périmètre')}</h2></div></div>
    <span className="research-evidence-level" data-level={research.evidenceLevel}>{labels[research.evidenceLevel]}</span>
    <p className="research-certification-status" dir="auto">{research.certificationStatus || l('Status not disclosed', 'Statut non communiqué')}</p>
    <Facts rows={[[l('Documents and precise scope', 'Documents et périmètre précis'), research.certifications], [l('Dates and validity shown', 'Dates et validité indiquées'), research.certificationDates]]}/>
    <p className="research-context-note">{l('The statement above distinguishes inspected documents from manufacturer claims. It does not certify every product or confirm that a document has never been suspended.', 'Le statut ci-dessus distingue les documents consultés des déclarations du fabricant. Il ne certifie pas tous les produits et ne confirme pas l’absence de suspension d’un document.')}</p>
    <a className="research-inline-link" href="#sources">{l('View the company’s sources', 'Voir les sources de la fiche')}<ArrowRight size={15} aria-hidden/></a>
  </section>;
}

function TradeContext({research, product = false}: {research: CompanyResearch; product?: boolean}) {
  const {l} = useLanguage();
  const agreement = research.agreement;
  return <>
    {agreement && <section className="catalogue-panel research-trade" id="trade">
      <div className="research-section-heading"><span className="research-section-icon"><Globe2 size={23} aria-hidden/></span><div><p className="eyebrow">{l('Trade with the European Union', 'Échanges avec l’Union européenne')}</p><h2>{l('Customs and trade framework', 'Cadre douanier et commercial')}</h2></div></div>
      {product && <p className="research-context-note">{l('Country-level context inherited from the manufacturer’s profile. Applicability to this product, its origin and tariff code must be confirmed.', 'Contexte du pays repris de la fiche fabricant. L’applicabilité à ce produit, à son origine et à son classement douanier reste à confirmer.')}</p>}
      <h3 className="research-agreement-title">{agreement.agreement}</h3>
      <Facts rows={[[l('Framework reference', 'Référence du cadre'), agreement.code], [l('Dates and milestones', 'Dates et repères'), agreement.date], [l('Potential benefit', 'Avantage possible'), agreement.benefit], [l('Required evidence', 'Justificatifs nécessaires'), agreement.proof], [l('Conditions and exclusions', 'Conditions et exclusions'), agreement.limits]]}/>
      <Sources sources={agreement.sources || []} compact/>
    </section>}
    {research.regulations?.length > 0 && <section className="catalogue-panel research-regulations" id="regulations">
      <div className="research-section-heading"><span className="research-section-icon"><FileText size={23} aria-hidden/></span><div><p className="eyebrow">{l('Requirements by use', 'Exigences selon l’usage')}</p><h2>{l('Rules to assess for your project', 'Règles à examiner pour votre projet')}</h2></div></div>
      <p>{l('These rules are conditional on the product, its intended use and the destination market. Listing them does not establish this manufacturer’s or this product’s compliance.', 'Ces règles dépendent du produit, de son usage et du marché de destination. Leur présence sur cette fiche ne démontre pas la conformité du fabricant ou du produit.')}</p>
      <div className="research-rule-list">{research.regulations.map(rule => <details key={rule.id} className="research-rule">
        <summary><span><small>{rule.type}</small><strong>{rule.title}</strong></span><ChevronDown size={19} aria-hidden/></summary>
        <div className="research-rule-body"><Facts rows={[[l('When it applies', 'Champ d’application'), rule.scope], [l('Requirements and evidence', 'Exigences et preuves'), rule.requirements], [l('Limits and points to confirm', 'Limites et points à confirmer'), rule.limits]]}/><Sources sources={rule.sources || []}/></div>
      </details>)}</div>
    </section>}
  </>;
}

function GslContact({supplier, product}: {supplier: PublicSupplier; product?: PublicProduct}) {
  const {l, language} = useLanguage();
  const website = supplier.public_details?.website ? safeSourceUrl(supplier.public_details.website) : null;
  return <>
    <section className="catalogue-panel company-contact-card research-contact" id="contact">
      <p className="eyebrow">GSL SYSTEMS</p><h2>{l('Discuss your requirement', 'Précisons votre besoin')}</h2>
      <p>{l('Your enquiry is handled by the GSL team. Specify the product, quantities, drawings and delivery destination so the team can help qualify the requirement.', 'Votre demande est traitée par l’équipe GSL. Précisez le produit, les quantités, les plans et la destination de livraison pour préparer sa qualification.')}</p>
      <Link className="catalogue-primary" href={gslContactHref(supplier.organization_id, product?.product_id)}><MessageSquare size={17} aria-hidden/>{product ? l('Contact GSL about this product', 'Contacter GSL pour ce produit') : l('Contact GSL about this manufacturer', 'Contacter GSL pour ce fabricant')}</Link>
      <Link className="catalogue-secondary" href={product ? '/operations?supplier=' + supplier.organization_id + '&product=' + product.product_id : '/decrire-mon-besoin?supplier=' + supplier.organization_id}>{l('Prepare my enquiry', 'Préparer ma demande')}<ArrowRight size={17} aria-hidden/></Link>
      <div className="company-contact-details"><span>{l('Published location', 'Localisation indiquée')}</span><p><CountryFlag code={supplier.country_code}/>{[supplier.city, countryName(supplier.country_code, language)].filter(Boolean).join(' · ')}</p>{website && <a href={website} target="_blank" rel="noopener noreferrer">{l('Company website', 'Site de l’entreprise')}<ArrowUpRight size={14} aria-hidden/></a>}</div>
    </section>
    <section className="company-review-note research-editorial-note"><BookOpen size={19} aria-hidden/><h3>{l('Documented by GSL', 'Fiche documentée par GSL')}</h3><p>{l('GSL compiled this profile from public sources. The manufacturer has not necessarily registered on the platform or approved this profile. No partnership is implied.', 'GSL a rédigé cette fiche à partir de sources publiques. Le fabricant n’est pas nécessairement inscrit sur la plateforme et n’a pas nécessairement validé cette fiche. Aucun partenariat n’est présumé.')}</p><Link href="/notre-methode">{l('Our documentation method', 'Notre méthode de documentation')}<ArrowRight size={14} aria-hidden/></Link></section>
  </>;
}

export function ResearchSupplierProfile({supplier: s, products, research}: {supplier: PublicSupplier; products: PublicProduct[]; research: CompanyResearch}) {
  const {l, language} = useLanguage();
  const categoryLabel = useCategoryLabel();
  return <main className="container catalogue-profile company-profile research-profile">
    <nav className="catalogue-breadcrumb"><Link href="/fabricants"><ArrowLeft size={16} aria-hidden/>{l('Manufacturers', 'Fabricants')}</Link><span aria-hidden>/</span><span>{s.display_name}</span></nav>
    <header className="research-company-hero"><div className="research-company-title"><CompanyMark supplier={s}/><div><p className="eyebrow">{l('Industrial manufacturer · Research profile', 'Fabricant industriel · Fiche documentaire')}</p><h1>{s.display_name}</h1><p className="catalogue-location"><CountryFlag code={s.country_code}/>{[s.city, countryName(s.country_code, language)].filter(Boolean).join(' · ')}</p></div></div><div className="research-hero-footer"><div><ResearchLabel/><Checked date={research.checkedAt} reference={research.sourceId}/></div><Link className="catalogue-primary" href={gslContactHref(s.organization_id)}><MessageSquare size={17} aria-hidden/>{l('Contact the GSL team', 'Contacter l’équipe GSL')}</Link></div></header>
    {research.categories.length > 0 && <nav className="research-category-links" aria-label={l('Manufacturing specialities', 'Spécialités de fabrication')}>{research.categories.map(category => <Link key={category} href={'/fabricants?category=' + encodeURIComponent(category)}><CategoryIcon category={category} size={16}/>{categoryLabel(category)}<ArrowUpRight size={13} aria-hidden/></Link>)}</nav>}
    <nav className="company-section-nav" aria-label={l('Company sections', 'Rubriques de l’entreprise')}>{[['overview', l('Activities', 'Activités')], ['products', l('Products', 'Produits')], ['certifications', l('Certifications', 'Certifications')], ...(research.agreement ? [['trade', l('Trade framework', 'Échanges UE')]] : []), ...(research.regulations.length ? [['regulations', l('Requirements', 'Exigences')]] : []), ['sources', l('Sources', 'Sources')]].map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}</nav>
    <div className="company-profile-layout"><div>
      <section className="catalogue-panel" id="overview"><div className="research-section-heading"><span className="research-section-icon"><Settings2 size={23} aria-hidden/></span><div><p className="eyebrow">{l('Activities and know-how', 'Activités et savoir-faire')}</p><h2>{l('What the manufacturer offers', 'Ce que propose le fabricant')}</h2></div></div><p className="catalogue-long-copy" dir="auto">{s.description}</p><Facts rows={[[l('Industry', 'Secteur d’activité'), research.sector], [l('Main activity', 'Activité principale'), research.family], [l('Product families', 'Familles de produits'), research.productFamilies], [l('Manufacturing processes', 'Procédés de fabrication'), research.processes], [l('Published materials', 'Matières publiées'), s.materials.length ? s.materials : null], [l('Evidence of European market activity', 'Éléments publics sur le marché européen'), research.europeanMarket]]}/></section>
      <section className="company-products-section" id="products"><div className="catalogue-section-heading"><h2>{l('Products and manufacturing services', 'Produits et prestations de fabrication')}</h2><span>{products.length}</span></div>{products.length ? <div className="catalogue-grid">{products.map(product => <ProductCard key={product.product_id} product={product}/>)}</div> : <div className="catalogue-empty"><Package size={28} aria-hidden/><p>{l('No product family has been documented yet. The GSL team can help clarify your requirement.', 'Aucune famille de produits n’est encore documentée. L’équipe GSL peut vous aider à préciser votre besoin.')}</p><Link href={gslContactHref(s.organization_id)} className="catalogue-secondary">{l('Contact GSL', 'Contacter GSL')}</Link></div>}</section>
      <Evidence research={research}/><TradeContext research={research}/>
      <section className="catalogue-panel" id="sources"><div className="research-section-heading"><span className="research-section-icon"><BookOpen size={23} aria-hidden/></span><div><p className="eyebrow">{l('Traceable information', 'Informations traçables')}</p><h2>{l('Company sources', 'Sources de la fiche entreprise')}</h2></div></div><Checked date={research.checkedAt} reference={research.sourceId}/><Sources sources={research.sources}/></section>
    </div><aside className="company-contact-column"><GslContact supplier={s}/></aside></div>
  </main>;
}

function CommercialDetails({research}: {research: ProductResearch}) {
  const {l, language} = useLanguage();
  const commercial = research.commercial;
  const price = publishedPrice(commercial, language);
  const mainKeys = new Set(['price_min', 'price_max', 'currency', 'unit', 'moq', 'lead_time', 'terms', 'status']);
  const tiers = Array.isArray(commercial.price_tiers) ? commercial.price_tiers.filter((tier): tier is {quantity: number; price: number} => !!tier && typeof tier === 'object' && typeof tier.quantity === 'number' && Number.isFinite(tier.quantity) && typeof tier.price === 'number' && Number.isFinite(tier.price)) : [];
  const extras = Object.entries(commercial).filter(([key, value]) => !mainKeys.has(key) && !(key === 'price_tiers' && tiers.length) && researchValue(value) !== null);
  const publishedTerms = commercial.status === 'terms_only' || commercial.terms || extras.length;
  return <section className="catalogue-panel research-commercial" id="commercial">
    <div className="research-section-heading"><span className="research-section-icon"><ClipboardList size={23} aria-hidden/></span><div><p className="eyebrow">{l('Published information', 'Informations publiées')}</p><h2>{l('Price, quantities and delivery', 'Prix, quantités et livraison')}</h2></div></div>
    {!price && <p className="research-context-note">{publishedTerms ? l('Some commercial conditions are public; no priced offer is published in the sources below.', 'Certaines conditions commerciales sont publiques ; aucune offre chiffrée n’est publiée dans les sources ci-dessous.') : l('The sources consulted do not publish commercial terms for this offer. The GSL team can help you specify the quantity and delivery requirement.', 'Les sources consultées ne publient pas de conditions commerciales pour cette offre. L’équipe GSL peut vous aider à préciser la quantité et la livraison souhaitées.')}</p>}
    <Facts rows={[[l('Published price', 'Prix publié'), price], [l('Currency', 'Devise'), commercial.currency], [l('Price unit', 'Unité de prix'), commercial.unit], [l('Minimum order quantity', 'Quantité minimale de commande'), commercial.moq], [l('Published lead time', 'Délai publié'), commercial.lead_time], [l('Commercial conditions', 'Conditions commerciales'), commercial.terms], ...extras.map(([key, value]): Fact => [commercialFieldLabel(key, l), value])]}/>
    {tiers.length > 0 && <div className="research-tier-scroll"><table className="research-tier-table"><caption>{l('Published price tiers', 'Paliers de prix publiés')}</caption><thead><tr><th scope="col">{l('Tier quantity', 'Quantité du palier')}</th><th scope="col">{l('Unit price', 'Prix unitaire')}{commercial.currency ? ` (${commercial.currency}${commercial.unit ? ' / ' + commercial.unit : ''})` : ''}</th></tr></thead><tbody>{tiers.map((tier, index) => <tr key={index}><td>{new Intl.NumberFormat(language).format(tier.quantity)}</td><td>{new Intl.NumberFormat(language, {minimumFractionDigits: commercial.currency ? 2 : 0, maximumFractionDigits: 8}).format(tier.price)}</td></tr>)}</tbody></table></div>}
    <a className="research-inline-link" href="#product-sources">{l('Consult the product sources', 'Consulter les sources du produit')}<ArrowRight size={15} aria-hidden/></a>
  </section>;
}

function commercialFieldLabel(key: string, l: (en: string, fr: string) => string) {
  const labels: Record<string, string> = {
    additional: l('Additional published conditions', 'Conditions complémentaires publiées'), availability: l('Published availability', 'Disponibilité publiée'),
    price_tiers: l('Published price tiers', 'Paliers de prix publiés'), tiers: l('Published tiers', 'Paliers publiés'), incoterm: l('Published Incoterm', 'Incoterm publié'),
    incoterms: l('Published Incoterms', 'Incoterms publiés'), payment_terms: l('Payment terms', 'Conditions de paiement'), packaging: l('Packaging', 'Conditionnement'),
    price_basis: l('Price basis', 'Base du prix'), price_note: l('Price details', 'Précisions sur le prix'), valid_until: l('Offer validity', 'Validité de l’offre'),
    minimum_price_quantity: l('Quantity for the lowest published price', 'Quantité pour le prix minimal publié'),
  };
  return labels[key] || key.replace(/_/g, ' ');
}

export function ResearchProductProfile({product: p, similar, manufacturer, research}: {product: PublicProduct; similar: PublicProduct[]; manufacturer?: PublicSupplier | null; research: ProductResearch}) {
  const {l, language} = useLanguage();
  const categoryLabel = useCategoryLabel();
  const parent = manufacturer ? companyResearch(manufacturer.public_details) : null;
  const price = publishedPrice(research.commercial, language);
  const specs = Object.entries(research.specifications || {});
  const company = manufacturer || {organization_id: p.organization_id, display_name: l('Manufacturer profile', 'Fiche fabricant'), country_code: p.specifications.manufacturing_country || '', city: '', description: '', processes: [], materials: [], published_at: ''};
  return <main className="container catalogue-profile product-profile research-profile">
    <nav className="catalogue-breadcrumb"><Link href="/catalogue"><ArrowLeft size={16} aria-hidden/>{l('Catalogue', 'Catalogue')}</Link><span aria-hidden>/</span><Link href={'/catalogue?category=' + encodeURIComponent(p.category)}>{categoryLabel(p.category)}</Link></nav>
    <header className="research-product-heading"><p className="eyebrow"><CategoryIcon category={p.category} size={18}/>{categoryLabel(p.category)}</p><h1 dir="auto">{p.name}</h1><div className="research-product-byline"><ResearchLabel/><Checked date={research.checkedAt} reference={research.sourceId}/><Link className="catalogue-primary" href={gslContactHref(p.organization_id, p.product_id)}><MessageSquare size={17} aria-hidden/>{l('Contact the GSL team', 'Contacter l’équipe GSL')}</Link></div></header>
    <RoboticsProductSummary specifications={p.specifications} family={p.category}/><nav className="company-section-nav" aria-label={l('Product sections', 'Rubriques du produit')}>{[['product-details', l('Overview', 'Présentation')], ['specifications', l('Specifications', 'Caractéristiques')], ['applications', l('Applications', 'Applications')], ['commercial', l('Commercial details', 'Conditions')], ...(parent ? [['trade', l('Trade framework', 'Échanges UE')]] : []), ['product-sources', l('Sources', 'Sources')]].map(([id, label]) => <a key={id} href={'#' + id}>{label}</a>)}</nav>
    <div className="research-product-layout"><div>
      <section className="catalogue-panel research-product-intro" id="product-details"><div className="research-product-symbol"><ProductVisual product={p}/></div><div><p className="eyebrow">{l('Product or manufacturing family', 'Produit ou famille de fabrication')}</p><h2>{l('Product overview', 'Présentation de l’offre')}</h2><p className="catalogue-long-copy" dir="auto">{p.description}</p>{research.scopeNote && <p className="research-context-note" dir="auto">{research.scopeNote}</p>}</div></section>
      <section className="catalogue-panel" id="specifications"><div className="research-section-heading"><span className="research-section-icon"><Settings2 size={23} aria-hidden/></span><div><p className="eyebrow">{l('Technical data', 'Données techniques')}</p><h2>{l('Detailed specifications', 'Caractéristiques détaillées')}</h2></div></div>{specs.length ? <Facts rows={specs}/> : <p className="research-missing">{l('Technical specifications not disclosed in the sources consulted.', 'Caractéristiques techniques non communiquées dans les sources consultées.')}</p>}</section>
      <section className="catalogue-panel" id="applications"><h2>{l('Applications, materials and customization', 'Applications, matières et personnalisation')}</h2><div className="research-application-grid"><div><h3>{l('Published applications', 'Applications publiées')}</h3>{research.applications.length ? <ul>{research.applications.map((value, index) => <li key={index} dir="auto">{value}</li>)}</ul> : <p className="research-missing">{l('Not disclosed', 'Non communiqué')}</p>}</div><div><h3>{l('Published materials', 'Matières publiées')}</h3>{research.materials.length ? <ul>{research.materials.map((value, index) => <li key={index} dir="auto">{value}</li>)}</ul> : <p className="research-missing">{l('Not disclosed', 'Non communiqué')}</p>}</div></div><Facts rows={[[l('Customization described by the manufacturer', 'Personnalisation décrite par le fabricant'), research.customization]]}/></section>
      <CommercialDetails research={research}/>
      {parent && <TradeContext research={parent} product/>}
      <section className="catalogue-panel" id="product-sources"><div className="research-section-heading"><span className="research-section-icon"><BookOpen size={23} aria-hidden/></span><div><p className="eyebrow">{l('Traceable information', 'Informations traçables')}</p><h2>{l('Product sources', 'Sources du produit')}</h2></div></div><Checked date={research.checkedAt} reference={research.sourceId}/><Sources sources={research.sources}/><p className="research-context-note">{l('Product characteristics are attributed to the sources above. Company certifications have their own scope and do not automatically certify this offer.', 'Les caractéristiques sont attribuées aux sources ci-dessus. Les certifications de l’entreprise ont leur propre périmètre et ne certifient pas automatiquement cette offre.')}</p><Link className="research-inline-link" href={'/fabricants/' + p.organization_id + '#certifications'}>{l('Manufacturer’s documents', 'Documents du fabricant')} · {research.companySourceId}<ArrowRight size={15} aria-hidden/></Link></section>
    </div><aside className="research-product-sidebar"><Link className="product-manufacturer-link" href={'/fabricants/' + p.organization_id}><CompanyMark supplier={company}/><span><small>{l('Manufacturer', 'Fabricant')}</small><strong>{company.display_name}</strong></span><ArrowUpRight size={17} aria-hidden/></Link>
      <section className="research-price-summary"><span>{l('Published price', 'Prix publié')}</span><strong>{price || l('Not disclosed', 'Non communiqué')}</strong>{researchValue(research.commercial.availability) && <p className="research-availability">{researchValue(research.commercial.availability)}</p>}<Facts rows={[[l('Minimum order', 'Commande minimale'), research.commercial.moq], ...(researchValue(research.commercial.minimum_price_quantity) ? [[l('Quantity for the lowest price', 'Quantité au prix minimal'), research.commercial.minimum_price_quantity] as Fact] : []), [l('Lead time', 'Délai'), research.commercial.lead_time]]}/><a href="#commercial" className="research-inline-link">{l('All commercial details', 'Toutes les conditions')}<ArrowRight size={15} aria-hidden/></a></section>
      <GslContact supplier={company} product={p}/><div className="research-save-actions"><SaveProduct id={p.product_id}/><CompareProduct id={p.product_id}/></div>
    </aside></div>
    {similar.length > 0 && <section className="product-related"><div className="catalogue-section-heading"><h2>{l('Related capabilities', 'Capacités similaires')}</h2><Link href={'/catalogue?category=' + encodeURIComponent(p.category)}>{l('All products', 'Tous les produits')}<ArrowRight size={17} aria-hidden/></Link></div><div className="catalogue-grid">{similar.map(product => <ProductCard key={product.product_id} product={product}/>)}</div></section>}
  </main>;
}
