// candidate sets are bitmasks: bit v set means digit v is still possible (v from 1 to 9)

export const MASK_LIMIT=1<<10
export const POPCOUNT=new Uint8Array(MASK_LIMIT)
export const SINGLE_VALUE=new Uint8Array(MASK_LIMIT)
export const VALUES_OF=new Array(MASK_LIMIT)
export const MIN_VALUE=new Uint8Array(MASK_LIMIT)
export const MAX_VALUE=new Uint8Array(MASK_LIMIT)

for(let mask=0;mask<MASK_LIMIT;mask++){
  const values=[]
  for(let value=1;value<10;value++)if(mask&(1<<value))values.push(value)
  VALUES_OF[mask]=values
  POPCOUNT[mask]=values.length
  SINGLE_VALUE[mask]=values.length===1?values[0]:0
  MIN_VALUE[mask]=values.length?values[0]:0
  MAX_VALUE[mask]=values.length?values[values.length-1]:0
}

export function fullMask(size){
  return ((1<<(size+1))-1)&~1
}

export function bit(value){
  return 1<<value
}

export function maskBetween(lowInclusive,highInclusive){
  let mask=0
  for(let value=Math.max(1,lowInclusive);value<=Math.min(9,highInclusive);value++)mask|=1<<value
  return mask
}
