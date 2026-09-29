export const currencyDecimals:Record<string,number>={EUR:2,USD:2,GBP:2,JPY:0,KRW:0,BHD:3,KWD:3,TND:3,CNY:2,TRY:2,GEL:2,MAD:2,CHF:2,CAD:2,AUD:2,PLN:2,RON:2};
export function toMinorUnits(input:string,currency:string):string{
 const decimals=currencyDecimals[currency];if(decimals===undefined)throw Error('CURRENCY');
 const normalized=input.trim().replace(',','.');
 if(!/^\d+(\.\d+)?$/.test(normalized))throw Error('AMOUNT');
 const [whole,fraction='']=normalized.split('.');if(fraction.length>decimals)throw Error('PRECISION');
 const result=BigInt(whole)*BigInt(10)**BigInt(decimals)+BigInt(fraction.padEnd(decimals,'0')||'0');
 if(result>BigInt('9007199254740991'))throw Error('AMOUNT_TOO_LARGE');return result.toString();
}
