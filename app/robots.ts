import type {MetadataRoute} from 'next';
import {indexable} from '@/lib/seo';
export default function robots():MetadataRoute.Robots{return {rules:indexable('/')?{userAgent:'*',allow:'/',disallow:['/api/','/demo/','/operations','/administration/','/compte','/espace','/selection','/comparateur','/connexion','/inscription','/auth/']}:{userAgent:'*',disallow:'/'},sitemap:(process.env.GSL_SITE_URL||'https://www.gsl-systems.com')+'/sitemap.xml'}}
