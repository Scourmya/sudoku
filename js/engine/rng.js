// seeded random generator so daily puzzles are the same for a given date

export function hashString(text){
  let hash=1779033703^text.length
  for(let index=0;index<text.length;index++){
    hash=Math.imul(hash^text.charCodeAt(index),3432918353)
    hash=(hash<<13)|(hash>>>19)
  }
  return ()=>{
    hash=Math.imul(hash^(hash>>>16),2246822507)
    hash=Math.imul(hash^(hash>>>13),3266489909)
    return (hash^=hash>>>16)>>>0
  }
}

export function createRng(seed){
  const seedSource=hashString(String(seed))
  let stateA=seedSource(),stateB=seedSource(),stateC=seedSource(),stateD=seedSource()
  function next(){
    stateA>>>=0;stateB>>>=0;stateC>>>=0;stateD>>>=0
    let result=(stateA+stateB)|0
    stateA=stateB^(stateB>>>9)
    stateB=(stateC+(stateC<<3))|0
    stateC=(stateC<<21)|(stateC>>>11)
    stateD=(stateD+1)|0
    result=(result+stateD)|0
    stateC=(stateC+result)|0
    return (result>>>0)/4294967296
  }
  const rng={
    next,
    int(maxExclusive){return Math.floor(next()*maxExclusive)},
    range(minInclusive,maxInclusive){return minInclusive+Math.floor(next()*(maxInclusive-minInclusive+1))},
    chance(probability){return next()<probability},
    pick(list){return list[Math.floor(next()*list.length)]},
    shuffle(list){
      for(let index=list.length-1;index>0;index--){
        const swapIndex=Math.floor(next()*(index+1))
        const temp=list[index];list[index]=list[swapIndex];list[swapIndex]=temp
      }
      return list
    }
  }
  for(let warmup=0;warmup<12;warmup++)next()
  return rng
}

export function randomSeed(){
  return Date.now().toString(36)+Math.floor(Math.random()*1e9).toString(36)
}
