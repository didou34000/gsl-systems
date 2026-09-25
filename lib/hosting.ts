export const publicDeployment = process.env.NEXT_PUBLIC_DEPLOYMENT_TARGET === 'vercel';
export function unavailableWorkspace() {
  return Response.json({error:'L’espace professionnel n’est pas encore ouvert sur cette version. Aucune donnée n’a été enregistrée.',code:'WORKSPACE_NOT_OPEN'}, {status:503,headers:{'Cache-Control':'no-store'}});
}
