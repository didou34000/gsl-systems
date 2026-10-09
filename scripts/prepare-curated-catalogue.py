"""Compile the researched supplier list into contact-free, source-attributed GSL records.

This command only writes a reviewable JSON payload. It never contacts a database.
Usage: python scripts/prepare-curated-catalogue.py /path/to/research
"""
import collections
import hashlib
import json
from pathlib import Path
import re
import sys
import uuid

research_dir = Path(sys.argv[1])
source = json.loads((research_dir / 'deliverable_data_v2.json').read_text())
companies = source['company']
products = []
for file in ('products_mediterranean.json', 'products_balkans.json', 'products_eastern_egypt.json'):
    products.extend(json.loads((research_dir / file).read_text()))
assert len(companies) == 50 and len(products) == 78
assert {p['company_id'] for p in products} == {c['id'] for c in companies}
assert len({p['product_key'] for p in products}) == 78

countries = {'Turquie': 'TR', 'Maroc': 'MA', 'Tunisie': 'TN', 'Serbie': 'RS', 'Macédoine du Nord': 'MK', 'Bosnie-Herzégovine': 'BA', 'Moldavie': 'MD', 'Géorgie': 'GE', 'Albanie': 'AL', 'Égypte': 'EG'}
categories = {
    'Usinage CNC': 'usinage-precision', 'Usinage aéronautique': 'usinage-precision', 'Taillage et brochage': 'usinage-precision',
    'Pièces ferroviaires': 'usinage-precision',
    'Fixations et composants automobiles': 'ressorts-fixations', 'Fixations pour la construction': 'ressorts-fixations', 'Ressorts industriels': 'ressorts-fixations',
    'Câbles de commande': 'cables-electriques', 'Câbles de données': 'cables-electriques', 'Conducteurs électriques basse tension': 'cables-electriques',
    'Câbles de puissance': 'cables-electriques', 'Câbles électriques': 'cables-electriques', 'Câbles d’énergie': 'cables-electriques',
    'Câbles de raccordement': 'cables-electriques', 'Câbles d’installation': 'cables-electriques',
    'Tôlerie et mécanosoudure': 'tolerie-soudage', 'Emboutissage': 'tolerie-soudage', 'Découpe et tôlerie': 'tolerie-soudage',
    'Équipements industriels et manutention': 'manutention-industrielle', 'Équipements de quai': 'manutention-industrielle', 'Manutention industrielle': 'manutention-industrielle',
    'Composants pour équipements miniers': 'roulements-transmission', 'Composants de transmission mécanique': 'roulements-transmission',
    'Câbles et commandes mécaniques automobiles': 'roulements-transmission', 'Roulements et moyeux': 'roulements-transmission', 'Composants de roulements': 'roulements-transmission',
    'Faisceaux électriques': 'faisceaux-cablage', 'Faisceaux électriques automobiles': 'faisceaux-cablage', 'Faisceaux et assemblages électriques': 'faisceaux-cablage',
    'Appareillage électrique': 'automatismes-appareillage',
    'Injection plastique': 'moules-injection', 'Moules et outillages': 'moules-injection',
    'Fabrication électronique': 'electronique-capteurs', 'Électronique embarquée': 'electronique-capteurs', 'Composants électroniques': 'electronique-capteurs',
    'Comptage électrique': 'electronique-capteurs', 'Microcomposants électroniques': 'electronique-capteurs',
    'Électronique de puissance': 'energie-transformateurs', 'Transformateurs': 'energie-transformateurs',
    'Fonderie sous pression': 'fonderie-forge', 'Pompes et composants moteur': 'pompes-hydraulique',
    'Aciers pour la construction': 'acier-construction', 'Aciers plats': 'acier-construction', 'Aciers revêtus': 'acier-construction',
    'Profilés aluminium': 'aluminium-extrusion', 'Composants en élastomère': 'elastomeres-etancheite',
}
by_id = {c['id']: c for c in companies}
agreement_by_id = {a['code']: a for a in source['agreements']}
rules_by_id = {r['id']: r for r in source['rules']}
namespace = uuid.uuid5(uuid.NAMESPACE_URL, 'https://gsl-systems.com/research/catalogue')
def stable_id(value): return str(uuid.uuid5(namespace, value))
def unique(values): return list(dict.fromkeys(x.strip() for x in values if x and x.strip()))
def sources(values):
    rows = []
    for s in values:
        assert re.match(r'^https?://', s['url']) and '@' not in s['url']
        note = s.get('supports', '')
        if re.search(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', note):
            note = ''
        # Public sourcing notes describe the evidence, never reproduce contact details.
        note = re.sub(r'(?i)e-?mail[s]?,?\s*(?:téléphone,?\s*)?', '', note).strip(' ,;')
        rows.append({k: v for k, v in {'url': s['url'], 'title': s['title'], 'supports': note}.items() if v})
    return list({s['url']: s for s in rows}.values())
def agreement(a):
    return {k: a[k] for k in ('code', 'agreement', 'date', 'benefit', 'proof', 'limits')} | {'sources': sources(a['sources'])}
def rule(r):
    return {k: r[k] for k in ('id', 'type', 'title', 'scope', 'requirements', 'limits')} | {'sources': sources(r['sources'])}

compiled_products = []
for p in products:
    c = by_id[p['company_id']]
    commercial = p['commercial'].copy()
    spec = {k: v for k, v in p['specifications'].items() if isinstance(v, str) and v.strip()}
    if p['product_key'] == 'mikroe-current-4-click-mikroe-4755':
        commercial['availability'] = 'Hors stock au 9 octobre 2026 ; aucune date de disponibilité publiée.'
        commercial['price_tiers'] = [{'quantity': n, 'price': v} for n, v in ((1, 18), (2, 17.1), (5, 16.2), (10, 15.3))]
        commercial['minimum_price_quantity'] = 10
    for price in ('price_min', 'price_max'):
        assert commercial[price] is None or commercial[price] > 0
    if commercial['price_min'] is not None:
        assert commercial['unit'] and commercial['currency'] and p['sources']
        assert commercial['price_max'] >= commercial['price_min']
    materials = unique(p['materials'] or [])
    data = {'kind': 'gsl_research', 'schemaVersion': 1, 'sourceId': p['product_key'], 'companySourceId': c['id'], 'checkedAt': p['as_of'],
            'specifications': spec, 'applications': unique(p['applications'] or []), 'materials': materials,
            'customization': p['customization'], 'commercial': commercial, 'sources': sources(p['sources'])}
    model = next((v for k, v in spec.items() if re.fullmatch(r'Référence(?: produit| commerciale| catalogue)?|Modèle|Reference', k, re.I)), '')
    unit = {'pièce': 'pcs', 'pièces': 'pcs', 'carte': 'pcs', 'kg': 'kg', 'm': 'm', 'mètre': 'm', 'm2': 'm2', 'set': 'set'}.get(commercial['unit'], '')
    minimum = str(commercial['moq']) if commercial['moq'] is not None and unit else ''
    public_spec = {'materials': ', '.join(materials), 'processes': spec.get('Procédés', spec.get('Procédé', '')),
                   'manufacturing_country': countries[c['country']], 'reference': model,
                   'minimum_quantity': minimum, 'unit': unit, 'lead_time': commercial['lead_time'] or '',
                   'compliance': 'not_assessed', 'verification': 'sourced',
                   'research_data': json.dumps(data, ensure_ascii=False, separators=(',', ':'))}
    compiled_products.append({'id': stable_id('product:' + p['product_key']), 'companyId': stable_id('company:' + c['id']),
        'source_key': p['product_key'], 'company_source_id': c['id'], 'name': p['name_fr'], 'reference': 'GSL-' + p['product_key'],
        'category': categories[p['category']], 'description': p['description_fr'], 'specifications': public_spec,
        'made_to_order': True if re.search(r'sur plan|selon plan|sur mesure|selon projet|sous contrat', p['name_fr'] + ' ' + p['description_fr'], re.I) else None})

compiled_companies = []
for c in companies:
    own = [p for p in compiled_products if p['company_source_id'] == c['id']]
    materials = unique(m for p in own for m in json.loads(p['specifications']['research_data'])['materials'])
    research = {'kind': 'gsl_research', 'schemaVersion': 1, 'sourceId': c['id'], 'checkedAt': source['as_of'],
        'sector': c['sector'], 'family': c['family'], 'categories': unique(p['category'] for p in own),
        'productFamilies': c['products'], 'processes': c['processes'], 'certifications': c['certifications'],
        'certificationStatus': c['cert_status'], 'certificationDates': c['cert_expiry'], 'evidenceLevel': c['evidence_code'],
        'europeanMarket': re.sub(r';\s*contact public.*$', '.', c['eu_evidence']), 'agreement': agreement(agreement_by_id[c['agreement_code']]),
        'regulations': [rule(rules_by_id[i]) for i in c['rule_ids']], 'sources': sources(c['sources'])}
    compiled_companies.append({'id': stable_id('company:' + c['id']), 'source_id': c['id'], 'name': c['name'],
        'country': countries[c['country']], 'city': c['city'], 'description': c['sector'] + '.\n\n' + c['products'],
        'processes': unique(c['processes'].split(';')), 'materials': materials, 'website': c['website'],
        'details': {'verification': 'sourced', 'activity': c['sector'], 'website': c['website'], 'research': research}})

payload = {'schemaVersion': 1, 'batchId': 'gsl-research-2026-10-09', 'checkedAt': source['as_of'],
    'agreements': [{'country': countries[a['country']], 'agreement': agreement(a)} for a in source['agreements']],
    'companies': compiled_companies, 'products': compiled_products}
serialized = json.dumps(payload, ensure_ascii=False, indent=2) + '\n'
assert not re.search(r'[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}', serialized), 'Email present in public payload'
assert 'mailto:' not in serialized and 'tel:' not in serialized
for c in companies:
    for key in ('email', 'phone'):
        if c[key] and len(c[key]) > 5: assert c[key] not in serialized, (c['id'], key)
destination = Path('data/curated-catalogue-2026-10-09.json')
destination.parent.mkdir(exist_ok=True)
destination.write_text(serialized)
summary = {'batchId': payload['batchId'], 'companies': len(compiled_companies), 'products': len(compiled_products),
    'by_country': dict(collections.Counter(c['country'] for c in compiled_companies)),
    'by_category': dict(collections.Counter(p['category'] for p in compiled_products)),
    'source_urls': len({s['url'] for c in compiled_companies for s in c['details']['research']['sources']} | {s['url'] for p in compiled_products for s in json.loads(p['specifications']['research_data'])['sources']}),
    'published_prices': sum(json.loads(p['specifications']['research_data'])['commercial']['price_min'] is not None for p in compiled_products),
    'published_moq': sum(bool(p['specifications']['minimum_quantity']) for p in compiled_products),
    'sha256': hashlib.sha256(serialized.encode()).hexdigest()}
Path('data/curated-catalogue-summary.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(summary, ensure_ascii=False))
