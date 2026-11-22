// human style solver used to grade difficulty and to explain hints
import {POPCOUNT,SINGLE_VALUE,VALUES_OF} from './bits.js'
import {propagate,isSolved,domainFromGivens} from './solver.js'

export const TIER_NAMES=['','Singles','Locked candidates','Pairs','Triples and X-Wing','Trial and error']
const BASIC_LINE_BUDGET=250
const DEEP_LINE_BUDGET=20000

function lockedCandidates(csp,dom){
  const {houses,cellHouses,allMask}=csp
  let changed=false
  for(let houseIndex=0;houseIndex<houses.length;houseIndex++){
    const house=houses[houseIndex]
    if(!house.full)continue
    const cells=house.cells
    for(let value=1;value<=csp.size;value++){
      const valueBit=1<<value
      const spots=[]
      for(let index=0;index<cells.length;index++){
        const mask=dom[cells[index]]
        if((mask&valueBit)&&POPCOUNT[mask]>1)spots.push(cells[index])
        else if(mask===valueBit){spots.length=0;spots.push(-1);break}
      }
      if(spots.length<2||spots[0]===-1)continue
      let shared=cellHouses[spots[0]]
      for(let index=1;index<spots.length&&shared.length;index++){
        const other=cellHouses[spots[index]]
        shared=shared.filter((candidate)=>other.includes(candidate))
      }
      for(const otherHouseIndex of shared){
        if(otherHouseIndex===houseIndex)continue
        for(const cell of houses[otherHouseIndex].cells){
          if(spots.includes(cell))continue
          if(dom[cell]&valueBit){
            dom[cell]&=~valueBit
            changed=true
          }
        }
      }
    }
  }
  void allMask
  return changed
}

function nakedSubsets(csp,dom,subsetSize){
  let changed=false
  for(const house of csp.houses){
    const open=house.cells.filter((cell)=>POPCOUNT[dom[cell]]>1&&POPCOUNT[dom[cell]]<=subsetSize)
    if(open.length<subsetSize)continue
    const choose=(start,picked,unionMask)=>{
      if(POPCOUNT[unionMask]>subsetSize)return
      if(picked.length===subsetSize){
        if(POPCOUNT[unionMask]!==subsetSize)return
        for(const cell of house.cells){
          if(picked.includes(cell))continue
          if(dom[cell]&unionMask&&POPCOUNT[dom[cell]]>1){
            dom[cell]&=~unionMask
            changed=true
          }
        }
        return
      }
      for(let index=start;index<open.length;index++){
        choose(index+1,[...picked,open[index]],unionMask|dom[open[index]])
      }
    }
    choose(0,[],0)
  }
  return changed
}

function hiddenSubsets(csp,dom,subsetSize){
  let changed=false
  for(const cells of csp.fullHouses){
    const positions=[]
    for(let value=1;value<=csp.size;value++){
      const spots=cells.filter((cell)=>(dom[cell]&(1<<value))&&POPCOUNT[dom[cell]]>1)
      positions.push({value,spots})
    }
    const usable=positions.filter((entry)=>entry.spots.length>=2&&entry.spots.length<=subsetSize)
    const choose=(start,pickedValues,cellSet)=>{
      if(cellSet.size>subsetSize)return
      if(pickedValues.length===subsetSize){
        if(cellSet.size!==subsetSize)return
        let keepMask=0
        for(const value of pickedValues)keepMask|=1<<value
        for(const cell of cellSet){
          if(dom[cell]&~keepMask){
            dom[cell]&=keepMask
            changed=true
          }
        }
        return
      }
      for(let index=start;index<usable.length;index++){
        const nextSet=new Set(cellSet)
        usable[index].spots.forEach((cell)=>nextSet.add(cell))
        choose(index+1,[...pickedValues,usable[index].value],nextSet)
      }
    }
    choose(0,[],new Set())
  }
  return changed
}

function xWing(csp,dom){
  const size=csp.size
  let changed=false
  for(const orientation of ['row','column']){
    const lineCell=(line,position)=>orientation==='row'?line*size+position:position*size+line
    for(let value=1;value<=size;value++){
      const valueBit=1<<value
      const linePositions=[]
      for(let line=0;line<size;line++){
        const spots=[]
        for(let position=0;position<size;position++){
          const mask=dom[lineCell(line,position)]
          if(mask&valueBit)spots.push(position)
        }
        linePositions.push(spots)
      }
      for(let firstLine=0;firstLine<size;firstLine++){
        const first=linePositions[firstLine]
        if(first.length!==2)continue
        for(let secondLine=firstLine+1;secondLine<size;secondLine++){
          const second=linePositions[secondLine]
          if(second.length!==2||second[0]!==first[0]||second[1]!==first[1])continue
          for(let line=0;line<size;line++){
            if(line===firstLine||line===secondLine)continue
            for(const position of first){
              const cell=lineCell(line,position)
              if((dom[cell]&valueBit)&&POPCOUNT[dom[cell]]>1){
                dom[cell]&=~valueBit
                changed=true
              }
            }
          }
        }
      }
    }
  }
  return changed
}

function deepLines(csp,dom){
  let changed=false
  for(const unit of csp.lineUnits){
    const result=unit.prune(dom,DEEP_LINE_BUDGET)
    if(result<0)return -1
    if(result>0)changed=true
  }
  return changed
}

function applyTier(csp,dom,tier){
  switch(tier){
    case 2:{
      const lineResult=deepLines(csp,dom)
      if(lineResult===-1)return -1
      return lockedCandidates(csp,dom)||lineResult
    }
    case 3:return nakedSubsets(csp,dom,2)||hiddenSubsets(csp,dom,2)
    case 4:return nakedSubsets(csp,dom,3)||hiddenSubsets(csp,dom,3)||xWing(csp,dom)
    default:return false
  }
}

// returns {solved, tier, contradiction, dom}
export function logicSolve(csp,givens,maxTier=4,startDom=null){
  const dom=startDom?Uint16Array.from(startDom):domainFromGivens(csp,givens)
  let tierUsed=1
  for(let guard=0;guard<2000;guard++){
    if(!propagate(csp,dom,BASIC_LINE_BUDGET))return {solved:false,contradiction:true,tier:tierUsed,dom}
    if(isSolved(dom))return {solved:true,contradiction:false,tier:tierUsed,dom}
    let progress=false
    for(let tier=2;tier<=Math.min(maxTier,4);tier++){
      const result=applyTier(csp,dom,tier)
      if(result===-1)return {solved:false,contradiction:true,tier:tierUsed,dom}
      if(result){
        tierUsed=Math.max(tierUsed,tier)
        progress=true
        break
      }
    }
    if(!progress)return {solved:false,contradiction:false,tier:5,dom}
  }
  return {solved:false,contradiction:false,tier:5,dom}
}

export function gradePuzzle(csp,givens){
  const result=logicSolve(csp,givens,4)
  return result.solved?result.tier:5
}

// finds the next cell a person could fill, with a short reason
export function findHint(csp,grid){
  const dom=domainFromGivens(csp,grid)
  let tierUsed=1
  const emptyCells=[]
  for(let cell=0;cell<grid.length;cell++)if(!grid[cell])emptyCells.push(cell)
  for(let guard=0;guard<400;guard++){
    const before=Uint16Array.from(dom)
    if(!propagate(csp,dom,BASIC_LINE_BUDGET))return null
    const placed=pickPlacement(csp,before,dom,emptyCells)
    if(placed)return {...placed,tier:tierUsed,technique:TIER_NAMES[tierUsed]}
    let progress=false
    for(let tier=2;tier<=4;tier++){
      const result=applyTier(csp,dom,tier)
      if(result===-1)return null
      if(result){tierUsed=Math.max(tierUsed,tier);progress=true;break}
    }
    if(!progress)return {cell:-1,value:0,tier:5,technique:TIER_NAMES[5]}
  }
  return null
}

function pickPlacement(csp,before,dom,emptyCells){
  let best=null
  for(const cell of emptyCells){
    const value=SINGLE_VALUE[dom[cell]]
    if(!value)continue
    const reason=explain(csp,before,cell,value)
    const candidate={cell,value,reason}
    if(!best||reason.score<best.reason.score)best=candidate
    if(reason.score===0)break
  }
  if(!best)return null
  return {cell:best.cell,value:best.value,reason:best.reason.text,house:best.reason.house}
}

function explain(csp,dom,cell,value){
  const valueBit=1<<value
  for(const houseIndex of csp.cellHouses[cell]){
    const house=csp.houses[houseIndex]
    if(!house.full)continue
    const spots=house.cells.filter((other)=>dom[other]&valueBit)
    if(spots.length===1){
      return {score:0,house:houseIndex,text:`This ${houseLabel(house)} needs a ${value}, and this is the only cell where it can go.`}
    }
  }
  if(POPCOUNT[dom[cell]]===1){
    return {score:1,house:-1,text:`Every other digit is already ruled out here, so it must be ${value}.`}
  }
  return {score:2,house:-1,text:`After ruling out what can't go here, only ${value} is left.`}
}

export function houseLabel(house){
  switch(house.kind){
    case 'row':return `row ${house.index+1}`
    case 'column':return `column ${house.index+1}`
    case 'box':return 'box'
    case 'region':return 'region'
    case 'diagonal':return 'diagonal'
    case 'window':return 'window'
    case 'group':return 'group'
    default:return 'area'
  }
}

export {VALUES_OF}
