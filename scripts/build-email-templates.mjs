// Writes the Supabase Auth email templates (supabase/email-templates/*.html) from one layout.
// Paste each generated file into Supabase > Authentication > Emails > Templates.
// Variables used: {{ .Token }}, {{ .Email }}, {{ .Data.display_name }} (sign-up metadata).
import fs from 'node:fs';

const site='https://www.gsl-systems.com';
const font="Inter,'Segoe UI',Roboto,'Helvetica Neue',Helvetica,Arial,sans-serif";
const c={steel:'#1F4E79',night:'#0F1B26',ink:'#14191F',slate:'#5A6571',border:'#D9DEE3',surface:'#F3F5F7'};

const templates={
 confirmation:{title:'Votre code de confirmation GSL systems',preheader:'Votre code pour activer votre compte GSL systems.',heading:'Confirmez votre adresse email',intro:'Merci pour votre inscription. Saisissez ce code sur la page de confirmation pour activer votre compte.',after:'Une fois votre compte activé, vous pourrez compléter la fiche de votre entreprise.'},
 recovery:{title:'Votre code de récupération GSL systems',preheader:'Votre code pour choisir un nouveau mot de passe.',heading:'Choisissez un nouveau mot de passe',intro:'Vous avez demandé à réinitialiser votre mot de passe. Saisissez ce code sur GSL systems pour en choisir un nouveau.',after:'Si la vérification en deux étapes est activée sur votre compte, le code de votre application d’authentification vous sera aussi demandé.'},
};

const page=t=>`<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${t.title}</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${c.surface};font-family:${font};color:${c.ink};-webkit-font-smoothing:antialiased;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${t.preheader}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${c.surface};"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="560" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:560px;background-color:#ffffff;border:1px solid ${c.border};border-radius:8px;">
<tr><td style="height:4px;background-color:${c.steel};border-radius:8px 8px 0 0;font-size:1px;line-height:4px;">&nbsp;</td></tr>
<tr><td align="center" style="padding:32px 32px 8px;"><a href="${site}" style="text-decoration:none;"><img src="${site}/brand/gsl-systems-email.png" width="168" height="80" alt="GSL systems" style="display:block;margin:0 auto;width:168px;height:auto;border:0;"></a></td></tr>
<tr><td style="padding:24px 40px 36px;font-family:${font};">
<h1 style="margin:0 0 20px;font-family:${font};font-size:24px;line-height:1.3;font-weight:700;color:${c.ink};text-align:center;">${t.heading}</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.7;">{{ if .Data.display_name }}Bonjour {{ .Data.display_name }},{{ else }}Bonjour,{{ end }}</p>
<p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:${c.slate};">${t.intro}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:22px 12px;background-color:${c.surface};border:1px solid ${c.border};border-radius:6px;">
<p style="margin:0 0 8px;font-family:${font};font-size:13px;line-height:1.5;color:${c.slate};">Votre code</p>
<p style="margin:0;font-family:${font};font-size:34px;font-weight:700;letter-spacing:8px;padding-left:8px;line-height:1.3;color:${c.steel};font-variant-numeric:tabular-nums;">{{ .Token }}</p>
</td></tr></table>
<p style="margin:16px 0 24px;font-size:13px;line-height:1.6;color:${c.slate};text-align:center;">Code demandé pour {{ .Email }}. Il ne sert qu’une fois et expire après un court délai.</p>
<p style="margin:0 0 28px;font-size:14px;line-height:1.7;color:${c.slate};">${t.after}</p>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td style="border-top:1px solid ${c.border};padding-top:20px;">
<p style="margin:0 0 8px;font-size:12px;line-height:1.7;color:${c.slate};">Ne communiquez ce code à personne : l’équipe GSL systems ne vous le demandera jamais.</p>
<p style="margin:0;font-size:12px;line-height:1.7;color:${c.slate};">Vous n’êtes pas à l’origine de cette demande ? Ignorez cet email, votre compte reste inchangé.</p>
</td></tr></table>
</td></tr>
<tr><td style="padding:20px 40px;background-color:${c.night};border-radius:0 0 8px 8px;font-family:${font};">
<p style="margin:0 0 4px;font-size:13px;font-weight:600;color:#ffffff;">GSL systems</p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#B8C2CC;">Sourcing de composants industriels · <a href="${site}" style="color:#ffffff;text-decoration:underline;">gsl-systems.com</a> · <a href="mailto:contact@gsl-systems.com" style="color:#ffffff;text-decoration:underline;">contact@gsl-systems.com</a></p>
</td></tr>
</table>
</td></tr></table>
</body></html>
`;

for(const [name,t] of Object.entries(templates))fs.writeFileSync(`supabase/email-templates/${name}.html`,page(t));
console.log('Templates written:',Object.keys(templates).join(', '));
