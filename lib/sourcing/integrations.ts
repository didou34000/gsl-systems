/** Implement only after contractual role, country coverage and provider are approved. No live money movement here. */
export interface PaymentProvider {
 coverage(country:string):Promise<{supported:boolean;commercialModel:string}>;
 createCheckout(input:{acceptedProposalId:string;currency:string;amountMinor:string;idempotencyKey:string}):Promise<{url:string;providerReference:string}>;
 verifyWebhook(input:{rawBody:Uint8Array;signature:string}):Promise<{providerEventId:string;proposalId:string;status:'pending'|'paid'|'failed';currency:string;amountMinor:string}>;
}
export interface LogisticsProvider {
 requestQuote(input:{caseId:string;shipmentId:string;revision:number}):Promise<{externalReference:string}>;
 getTracking(externalReference:string):Promise<{status:string;occurredAt:string;trackingUrl?:string}>;
}
// Deliberately unconfigured. A future implementation must verify all supplier countries,
// server-side amount/currency, signed callbacks and unique provider event IDs before recording payment.
export const paymentCapability={configured:false as const,mode:'terms_to_agree' as const};
export const logisticsCapability={configured:false as const,mode:'manual_quotes' as const};
