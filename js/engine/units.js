// constraint units: each prunes candidate masks and returns false on contradiction
import {POPCOUNT,SINGLE_VALUE,VALUES_OF,MIN_VALUE,MAX_VALUE,maskBetween} from './bits.js'

const MEMO_LIMIT=30000

function memoGet(unit,key){
  return unit.memo.get(key)
}

function memoSet(unit,key,value){
  if(unit.memo.size>MEMO_LIMIT)unit.memo.clear()
  unit.memo.set(key,value)
}

function keyOf(dom,cells){
  let key=''
  for(let index=0;index<cells.length;index++)key+=dom[cells[index]]+','
  return key
}

// applies support masks to the domain, returns -1 contradiction, 1 changed, 0 unchanged
function applySupport(dom,cells,support){
  let changed=0
  for(let index=0;index<cells.length;index++){
    const cell=cells[index]
    const next=dom[cell]&support[index]
    if(next===0)return -1
    if(next!==dom[cell]){dom[cell]=next;changed=1}
  }
  return changed
}

// generic tuple enumeration for small groups of cells
function enumerateTuples(dom,cells,mustDiffer,partialOk,leafOk,nodeBudget){
  const count=cells.length
  const values=new Array(count).fill(0)
  const support=new Array(count).fill(0)
  let nodes=0
  let overBudget=false
  function walk(depth){
    if(overBudget)return
    if(depth===count){
      if(leafOk(values)){
        for(let index=0;index<count;index++)support[index]|=1<<values[index]
      }
      return
    }
    const options=VALUES_OF[dom[cells[depth]]]
    for(let optionIndex=0;optionIndex<options.length;optionIndex++){
      const value=options[optionIndex]
      if(support[depth]&(1<<value)){
        // skip branches that cannot add any new support
        let nothingNew=true
        for(let index=0;index<depth;index++){
          if(!(support[index]&(1<<values[index]))){nothingNew=false;break}
        }
        if(nothingNew){
          for(let index=depth+1;index<count;index++){
            if((dom[cells[index]]&~support[index])!==0){nothingNew=false;break}
          }
        }
        if(nothingNew)continue
      }
      let clash=false
      const differ=mustDiffer[depth]
      for(let index=0;index<differ.length;index++){
        if(values[differ[index]]===value){clash=true;break}
      }
      if(clash)continue
      values[depth]=value
      nodes++
      if(nodes>nodeBudget){overBudget=true;return}
      if(partialOk(values,depth))walk(depth+1)
      if(overBudget)return
    }
  }
  walk(0)
  return overBudget?null:support
}

function buildMustDiffer(cells,arePeers){
  return cells.map((cell,depth)=>{
    const earlier=[]
    for(let index=0;index<depth;index++)if(arePeers(cells[index],cell))earlier.push(index)
    return earlier
  })
}

function makeTupleUnit(kind,cells,arePeers,partialOk,leafOk,budget){
  const mustDiffer=buildMustDiffer(cells,arePeers)
  const unit={
    kind,cells,memo:new Map(),
    prune(dom){
      const key=keyOf(dom,cells)
      let support=memoGet(unit,key)
      if(support===undefined){
        support=enumerateTuples(dom,cells,mustDiffer,partialOk,leafOk,budget)
        memoSet(unit,key,support)
      }
      if(support===null)return 0
      return applySupport(dom,cells,support)
    }
  }
  return unit
}

export function sumUnit(cells,target,arePeers){
  const count=cells.length
  const partialOk=(values,depth)=>{
    let total=0
    for(let index=0;index<=depth;index++)total+=values[index]
    return total+(count-depth-1)<=target
  }
  const leafOk=(values)=>{
    let total=0
    for(let index=0;index<count;index++)total+=values[index]
    return total===target
  }
  return makeTupleUnit('sum',cells,arePeers,partialOk,leafOk,200000)
}

export function calcUnit(cells,operation,target,arePeers){
  const count=cells.length
  let partialOk=()=>true
  let leafOk
  if(operation==='='){
    leafOk=(values)=>values[0]===target
  }else if(operation==='+'){
    partialOk=(values,depth)=>{
      let total=0
      for(let index=0;index<=depth;index++)total+=values[index]
      return total+(count-depth-1)<=target
    }
    leafOk=(values)=>{
      let total=0
      for(let index=0;index<count;index++)total+=values[index]
      return total===target
    }
  }else if(operation==='x'){
    partialOk=(values,depth)=>{
      let product=1
      for(let index=0;index<=depth;index++)product*=values[index]
      return target%product===0
    }
    leafOk=(values)=>{
      let product=1
      for(let index=0;index<count;index++)product*=values[index]
      return product===target
    }
  }else if(operation==='-'){
    leafOk=(values)=>Math.abs(values[0]-values[1])===target
  }else{
    leafOk=(values)=>{
      const high=Math.max(values[0],values[1]),low=Math.min(values[0],values[1])
      return high===low*target
    }
  }
  return makeTupleUnit('calc',cells,arePeers,partialOk,leafOk,200000)
}

export function arrowUnit(circle,path,arePeers){
  const cells=[circle,...path]
  const count=cells.length
  const partialOk=(values,depth)=>{
    let total=0
    for(let index=1;index<=depth;index++)total+=values[index]
    return total+(count-depth-1)<=values[0]
  }
  const leafOk=(values)=>{
    let total=0
    for(let index=1;index<count;index++)total+=values[index]
    return total===values[0]
  }
  return makeTupleUnit('arrow',cells,arePeers,partialOk,leafOk,200000)
}

export function thermoUnit(cells,size){
  return {
    kind:'thermo',cells,
    prune(dom){
      let changed=0
      let low=0
      for(let index=0;index<cells.length;index++){
        const cell=cells[index]
        const next=dom[cell]&maskBetween(low+1,size)
        if(next===0)return -1
        if(next!==dom[cell]){dom[cell]=next;changed=1}
        low=MIN_VALUE[next]
      }
      let high=size+1
      for(let index=cells.length-1;index>=0;index--){
        const cell=cells[index]
        const next=dom[cell]&maskBetween(1,high-1)
        if(next===0)return -1
        if(next!==dom[cell]){dom[cell]=next;changed=1}
        high=MAX_VALUE[next]
      }
      return changed
    }
  }
}

// line units enumerate permutations of a full row or column, with a node budget
function makeLineUnit(kind,cells,size,makeState){
  const count=cells.length
  const unit={
    kind,cells,memo:new Map(),
    prune(dom,budget){
      const key=keyOf(dom,cells)+'|'+budget
      let support=memoGet(unit,key)
      if(support===undefined){
        support=enumerateLine(dom,cells,count,makeState,budget)
        memoSet(unit,key,support)
      }
      if(support===null)return 0
      return applySupport(dom,cells,support)
    }
  }
  return unit
}

function enumerateLine(dom,cells,count,makeState,budget){
  const support=new Array(count).fill(0)
  const values=new Array(count).fill(0)
  const checker=makeState()
  let nodes=0
  let overBudget=false
  function walk(depth,usedMask){
    if(overBudget)return
    if(depth===count){
      if(checker.leaf(values)){
        for(let index=0;index<count;index++)support[index]|=1<<values[index]
      }
      return
    }
    const options=VALUES_OF[dom[cells[depth]]&~usedMask]
    for(let optionIndex=0;optionIndex<options.length;optionIndex++){
      const value=options[optionIndex]
      values[depth]=value
      nodes++
      if(nodes>budget){overBudget=true;return}
      if(checker.partial(values,depth,usedMask|(1<<value)))walk(depth+1,usedMask|(1<<value))
      if(overBudget)return
    }
  }
  walk(0,0)
  return overBudget?null:support
}

export function skyUnit(cells,count,size){
  return makeLineUnit('sky',cells,size,()=>({
    partial(values,depth,usedMask){
      let visible=0,tallest=0
      for(let index=0;index<=depth;index++){
        if(values[index]>tallest){tallest=values[index];visible++}
      }
      if(visible>count)return false
      let tallerLeft=0
      for(let value=tallest+1;value<=size;value++)if(!(usedMask&(1<<value)))tallerLeft++
      const remaining=size-depth-1
      return visible+Math.min(tallerLeft,remaining)>=count
    },
    leaf(values){
      let visible=0,tallest=0
      for(let index=0;index<values.length;index++){
        if(values[index]>tallest){tallest=values[index];visible++}
      }
      return visible===count
    }
  }))
}

export function sandwichUnit(cells,target,size){
  const count=cells.length
  const lowBit=1<<1,highBit=1<<size
  const middleMask=maskBetween(2,size-1)
  // union of digits usable in k distinct middle digits that sum to target
  const subsetUnion=new Array(count).fill(0)
  const middleValues=VALUES_OF[middleMask]
  const collect=(start,picked,total,mask)=>{
    if(total===target)subsetUnion[picked]|=mask
    if(total>=target)return
    for(let index=start;index<middleValues.length;index++){
      collect(index+1,picked+1,total+middleValues[index],mask|(1<<middleValues[index]))
    }
  }
  collect(0,0,0,0)
  if(target===0)subsetUnion[0]=-1
  const unit={
    kind:'sandwich',cells,memo:new Map(),
    prune(dom){
      const key=keyOf(dom,cells)
      let support=memoGet(unit,key)
      if(support===undefined){
        support=computeSupport(dom)
        memoSet(unit,key,support)
      }
      return applySupport(dom,cells,support)
    }
  }
  function computeSupport(dom){
    const support=new Array(count).fill(0)
    for(let first=0;first<count;first++){
      for(let second=first+1;second<count;second++){
        const between=second-first-1
        if(!subsetUnion[between])continue
        for(const [firstBit,secondBit] of [[lowBit,highBit],[highBit,lowBit]]){
          if(!(dom[cells[first]]&firstBit)||!(dom[cells[second]]&secondBit))continue
          let possible=true
          for(let index=0;index<count&&possible;index++){
            if(index!==first&&index!==second&&!(dom[cells[index]]&middleMask))possible=false
          }
          if(!possible)continue
          const betweenSupport=supportBetween(dom,first+1,between)
          if(!betweenSupport)continue
          support[first]|=firstBit
          support[second]|=secondBit
          for(let index=0;index<count;index++){
            if(index>first&&index<second)support[index]|=betweenSupport[index-first-1]
            else if(index!==first&&index!==second)support[index]|=dom[cells[index]]&middleMask
          }
        }
      }
    }
    return support
  }
  function supportBetween(dom,start,length){
    if(length===0)return target===0?[]:null
    const union=subsetUnion[length]
    let simple=true
    for(let index=0;index<length;index++){
      if((dom[cells[start+index]]&union)!==union){simple=false;break}
    }
    if(simple)return new Array(length).fill(union)
    const result=new Array(length).fill(0)
    const values=new Array(length)
    let found=false
    const walk=(depth,used,total)=>{
      if(depth===length){
        if(total===target){
          found=true
          for(let index=0;index<length;index++)result[index]|=1<<values[index]
        }
        return
      }
      const remaining=length-depth-1
      const options=VALUES_OF[dom[cells[start+depth]]&middleMask&~used]
      for(let optionIndex=0;optionIndex<options.length;optionIndex++){
        const value=options[optionIndex]
        const nextTotal=total+value
        if(nextTotal+remaining*2>target)break
        if(nextTotal+remaining*(size-1)<target)continue
        values[depth]=value
        walk(depth+1,used|(1<<value),nextTotal)
      }
    }
    walk(0,0,0)
    return found?result:null
  }
  return unit
}

export function skyInitialMasks(count,size){
  // returns allowed mask for each distance from the viewer
  const masks=[]
  for(let distance=0;distance<size;distance++){
    if(count===1){
      masks.push(distance===0?(1<<size):maskBetween(1,size-1))
    }else if(count===size){
      masks.push(1<<(distance+1))
    }else{
      masks.push(maskBetween(1,Math.min(size,size-count+1+distance))&(distance===0?~(1<<size):~0))
    }
  }
  return masks
}

export {POPCOUNT,SINGLE_VALUE}
