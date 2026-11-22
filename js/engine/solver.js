// constraint propagation and backtracking search
import {POPCOUNT,SINGLE_VALUE,VALUES_OF} from './bits.js'

export const SEARCH_LINE_BUDGET=600

// queue based propagation: peer elimination, relations, hidden singles, then units
// returns false on contradiction
export function propagate(csp,dom,lineBudget=SEARCH_LINE_BUDGET){
  const {cellCount,peers,fullHouses,relations,units,allMask,cellRelations,cellFullHouses,cellUnits}=csp
  const stack=csp.scratchStack,inStack=csp.scratchInStack
  const houseDirty=csp.scratchHouseDirty,unitDirty=csp.scratchUnitDirty
  let top=0
  for(let cell=0;cell<cellCount;cell++){stack[top++]=cell;inStack[cell]=1}
  houseDirty.fill(1)
  unitDirty.fill(1)
  const fail=()=>{
    for(let index=0;index<top;index++)inStack[stack[index]]=0
    return false
  }
  for(;;){
    while(top>0){
      const cell=stack[--top]
      inStack[cell]=0
      const mask=dom[cell]
      if(mask===0)return fail()
      const housesOfCell=cellFullHouses[cell]
      for(let index=0;index<housesOfCell.length;index++)houseDirty[housesOfCell[index]]=1
      const unitsOfCell=cellUnits[cell]
      for(let index=0;index<unitsOfCell.length;index++)unitDirty[unitsOfCell[index]]=1
      if(POPCOUNT[mask]===1){
        const cellPeers=peers[cell]
        for(let index=0;index<cellPeers.length;index++){
          const peer=cellPeers[index]
          if(dom[peer]&mask){
            const next=dom[peer]&~mask
            if(next===0)return fail()
            dom[peer]=next
            if(!inStack[peer]){inStack[peer]=1;stack[top++]=peer}
          }
        }
      }
      const relationsOfCell=cellRelations[cell]
      for(let index=0;index<relationsOfCell.length;index++){
        const relation=relations[relationsOfCell[index]]
        const firstMask=dom[relation.first],secondMask=dom[relation.second]
        let allowedSecond=0,allowedFirst=0
        const firstValues=VALUES_OF[firstMask]
        for(let valueIndex=0;valueIndex<firstValues.length;valueIndex++)allowedSecond|=relation.forward[firstValues[valueIndex]]
        const secondValues=VALUES_OF[secondMask]
        for(let valueIndex=0;valueIndex<secondValues.length;valueIndex++)allowedFirst|=relation.backward[secondValues[valueIndex]]
        const nextFirst=firstMask&allowedFirst,nextSecond=secondMask&allowedSecond
        if(nextFirst===0||nextSecond===0)return fail()
        if(nextFirst!==firstMask){
          dom[relation.first]=nextFirst
          if(!inStack[relation.first]){inStack[relation.first]=1;stack[top++]=relation.first}
        }
        if(nextSecond!==secondMask){
          dom[relation.second]=nextSecond
          if(!inStack[relation.second]){inStack[relation.second]=1;stack[top++]=relation.second}
        }
      }
    }
    for(let houseIndex=0;houseIndex<fullHouses.length;houseIndex++){
      if(!houseDirty[houseIndex])continue
      houseDirty[houseIndex]=0
      const house=fullHouses[houseIndex]
      let once=0,twice=0
      for(let index=0;index<house.length;index++){
        const mask=dom[house[index]]
        twice|=once&mask
        once|=mask
      }
      if(once!==allMask)return fail()
      const uniqueMask=once&~twice
      if(!uniqueMask)continue
      for(let index=0;index<house.length;index++){
        const cell=house[index]
        const hit=dom[cell]&uniqueMask
        if(!hit)continue
        if(POPCOUNT[hit]>1)return fail()
        if(dom[cell]!==hit){
          dom[cell]=hit
          if(!inStack[cell]){inStack[cell]=1;stack[top++]=cell}
        }
      }
    }
    if(top>0)continue
    for(let unitIndex=0;unitIndex<units.length&&top===0;unitIndex++){
      if(!unitDirty[unitIndex])continue
      unitDirty[unitIndex]=0
      const unit=units[unitIndex]
      const unitCells=unit.cells
      const before=csp.scratchBefore
      for(let index=0;index<unitCells.length;index++)before[index]=dom[unitCells[index]]
      const result=unit.prune(dom,lineBudget)
      if(result<0)return fail()
      if(result>0){
        for(let index=0;index<unitCells.length;index++){
          const cell=unitCells[index]
          if(dom[cell]!==before[index]&&!inStack[cell]){inStack[cell]=1;stack[top++]=cell}
        }
      }
    }
    if(top===0)return true
  }
}

export function isSolved(dom){
  for(let index=0;index<dom.length;index++)if(POPCOUNT[dom[index]]!==1)return false
  return true
}

export function domainFromGivens(csp,givens){
  const dom=Uint16Array.from(csp.initialDomain)
  for(let cell=0;cell<givens.length;cell++){
    if(givens[cell]){
      dom[cell]&=1<<givens[cell]
    }
  }
  return dom
}

// counts solutions up to maxSolutions; rng randomizes value order for generation
export function solve(csp,startDom,options={}){
  const maxSolutions=options.maxSolutions??2
  const nodeLimit=options.nodeLimit??100000
  const rng=options.rng||null
  const solutions=[]
  let nodes=0
  let aborted=false
  const dom=Uint16Array.from(startDom)
  for(let index=0;index<dom.length;index++)if(dom[index]===0)return {count:0,solutions,aborted,nodes}
  if(!propagate(csp,dom))return {count:0,solutions,aborted,nodes}
  function search(current){
    nodes++
    if(nodes>nodeLimit){aborted=true;return}
    let bestCell=-1,bestCount=99
    for(let cell=0;cell<current.length;cell++){
      const count=POPCOUNT[current[cell]]
      if(count>1&&count<bestCount){
        bestCell=cell;bestCount=count
        if(count===2)break
      }
    }
    if(bestCell<0){
      solutions.push(Array.from(current,(mask)=>SINGLE_VALUE[mask]))
      return
    }
    let values=VALUES_OF[current[bestCell]]
    if(rng)values=rng.shuffle(values.slice())
    for(let index=0;index<values.length;index++){
      const next=current.slice()
      next[bestCell]=1<<values[index]
      if(propagate(csp,next))search(next)
      if(solutions.length>=maxSolutions||aborted)return
    }
  }
  search(dom)
  return {count:solutions.length,solutions,aborted,nodes}
}

export function countSolutions(csp,givens,nodeLimit=60000){
  const result=solve(csp,domainFromGivens(csp,givens),{maxSolutions:2,nodeLimit})
  return result.aborted?-1:result.count
}
