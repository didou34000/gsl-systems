import type {MetadataRoute} from 'next';
import {indexable,privatePaths} from '@/lib/seo';
export default function robots():MetadataRoute.Robots{return {rules:indexable('/')?{userAgent:'*',allow:'/',disallow:privatePaths}:{userAgent:'*',disallow:'/'},sitemap:(process.env.GSL_SITE_URL||'https://www.gsl-systems.com')+'/sitemap.xml'}}
