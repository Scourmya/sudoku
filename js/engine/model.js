// turns a puzzle definition into houses, peers, relations and units for the solver
import {fullMask} from './bits.js'
import {sumUnit,calcUnit,arrowUnit,thermoUnit,skyUnit,sandwichUnit,skyInitialMasks} from './units.js'

export function boxRegions(size,boxRows,boxCols){
  const regions=new Array(size*size)
  const boxesPerRow=size/boxCols
  for(let row=0;row<size;row++){
    for(let col=0;col<size;col++){
      regions[row*size+col]=Math.floor(row/boxRows)*boxesPerRow+Math.floor(col/boxCols)
    }
  }
  return regions
}

export function orthogonalPairs(size){
  const pairs=[]
  for(let row=0;row<size;row++){
    for(let col=0;col<size;col++){
      const cell=row*size+col
      if(col+1<size)pairs.push([cell,cell+1])
      if(row+1<size)pairs.push([cell,cell+size])
    }
  }
  return pairs
}

const KNIGHT_STEPS=[[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
const KING_STEPS=[[1,1],[1,-1],[-1,1],[-1,-1]]

function relationTest(kind){
  switch(kind){
    case 'white':return (first,second)=>Math.abs(first-second)===1
    case 'black':return (first,second)=>first===2*second||second===2*first
    case 'notKropki':return (first,second)=>Math.abs(first-second)!==1&&first!==2*second&&second!==2*first
    case 'notWhite':return (first,second)=>Math.abs(first-second)!==1
    case 'X':return (first,second)=>first+second===10
    case 'V':return (first,second)=>first+second===5
    case 'notXV':return (first,second)=>first+second!==10&&first+second!==5
    case 'lt':return (first,second)=>first<second
    default:throw new Error('unknown relation '+kind)
  }
}

function makeRelation(first,second,kind,size){
  const test=relationTest(kind)
  const forward=new Uint16Array(size+1)
  const backward=new Uint16Array(size+1)
  for(let firstValue=1;firstValue<=size;firstValue++){
    for(let secondValue=1;secondValue<=size;secondValue++){
      if(test(firstValue,secondValue)){
        forward[firstValue]|=1<<secondValue
        backward[secondValue]|=1<<firstValue
      }
    }
  }
  return {first,second,kind,forward,backward}
}

export function compile(definition){
  const size=definition.size
  const cellCount=size*size
  const rules=definition.rules||{}
  const constraints=definition.constraints||[]
  const houses=[]
  const addHouse=(cells,full,kind,index)=>houses.push({cells,full,kind,index})

  for(let row=0;row<size;row++){
    const cells=[]
    for(let col=0;col<size;col++)cells.push(row*size+col)
    addHouse(cells,true,'row',row)
  }
  for(let col=0;col<size;col++){
    const cells=[]
    for(let row=0;row<size;row++)cells.push(row*size+col)
    addHouse(cells,true,'column',col)
  }
  if(definition.regions){
    const groups=new Map()
    definition.regions.forEach((region,cell)=>{
      if(!groups.has(region))groups.set(region,[])
      groups.get(region).push(cell)
    })
    for(const [region,cells] of [...groups.entries()].sort((left,right)=>left[0]-right[0])){
      addHouse(cells,true,rules.jigsaw?'region':'box',region)
    }
  }
  if(rules.diagonal){
    const down=[],up=[]
    for(let index=0;index<size;index++){
      down.push(index*size+index)
      up.push(index*size+(size-1-index))
    }
    addHouse(down,true,'diagonal',0)
    addHouse(up,true,'diagonal',1)
  }
  if(rules.windoku){
    const corners=[[1,1],[1,5],[5,1],[5,5]]
    corners.forEach(([top,left],index)=>{
      const cells=[]
      for(let row=top;row<top+3;row++)for(let col=left;col<left+3;col++)cells.push(row*size+col)
      addHouse(cells,true,'window',index)
    })
  }
  if(rules.disjoint){
    for(let position=0;position<9;position++){
      const cells=[]
      const innerRow=Math.floor(position/3),innerCol=position%3
      for(let boxRow=0;boxRow<3;boxRow++)for(let boxCol=0;boxCol<3;boxCol++){
        cells.push((boxRow*3+innerRow)*size+boxCol*3+innerCol)
      }
      addHouse(cells,true,'group',position)
    }
  }
  constraints.forEach((constraint,index)=>{
    if(constraint.type==='cage')addHouse(constraint.cells,false,'cage',index)
  })

  const peerSets=Array.from({length:cellCount},()=>new Set())
  for(const house of houses){
    for(const cell of house.cells)for(const other of house.cells)if(cell!==other)peerSets[cell].add(other)
  }
  const stepRules=[]
  if(rules.antiKnight)stepRules.push(KNIGHT_STEPS)
  if(rules.antiKing)stepRules.push(KING_STEPS)
  for(const steps of stepRules){
    for(let row=0;row<size;row++)for(let col=0;col<size;col++){
      for(const [rowStep,colStep] of steps){
        const otherRow=row+rowStep,otherCol=col+colStep
        if(otherRow<0||otherCol<0||otherRow>=size||otherCol>=size)continue
        peerSets[row*size+col].add(otherRow*size+otherCol)
      }
    }
  }
  const peers=peerSets.map((set)=>Int16Array.from(set))
  const arePeers=(first,second)=>peerSets[first].has(second)

  const relations=[]
  const marked=new Set()
  const pairKey=(first,second)=>first<second?first+'-'+second:second+'-'+first
  for(const constraint of constraints){
    if(constraint.type==='dot'){
      relations.push(makeRelation(constraint.a,constraint.b,constraint.kind,size))
      marked.add('dot'+pairKey(constraint.a,constraint.b))
    }else if(constraint.type==='xv'){
      relations.push(makeRelation(constraint.a,constraint.b,constraint.kind,size))
      marked.add('xv'+pairKey(constraint.a,constraint.b))
    }else if(constraint.type==='lt'){
      relations.push(makeRelation(constraint.a,constraint.b,'lt',size))
    }
  }
  if(rules.negativeDots||rules.xvNegative||rules.nonConsecutive){
    for(const [first,second] of orthogonalPairs(size)){
      if(rules.negativeDots&&!marked.has('dot'+pairKey(first,second))){
        relations.push(makeRelation(first,second,rules.negativeDots==='white'?'notWhite':'notKropki',size))
      }
      if(rules.xvNegative&&!marked.has('xv'+pairKey(first,second))){
        relations.push(makeRelation(first,second,'notXV',size))
      }
      if(rules.nonConsecutive)relations.push(makeRelation(first,second,'notWhite',size))
    }
  }

  const initialDomain=new Uint16Array(cellCount).fill(fullMask(size))
  const units=[]
  for(const constraint of constraints){
    switch(constraint.type){
      case 'cage':units.push(sumUnit(constraint.cells,constraint.sum,arePeers));break
      case 'calc':units.push(calcUnit(constraint.cells,constraint.op,constraint.target,arePeers));break
      case 'arrow':units.push(arrowUnit(constraint.circle,constraint.cells,arePeers));break
      case 'thermo':units.push(thermoUnit(constraint.cells,size));break
      case 'sandwich':units.push(sandwichUnit(constraint.cells,constraint.sum,size));break
      case 'sky':{
        units.push(skyUnit(constraint.cells,constraint.count,size))
        const masks=skyInitialMasks(constraint.count,size)
        constraint.cells.forEach((cell,distance)=>{initialDomain[cell]&=masks[distance]})
        break
      }
      case 'parity':{
        let mask=0
        for(let value=1;value<=size;value++){
          if((value%2===0)===(constraint.parity==='even'))mask|=1<<value
        }
        initialDomain[constraint.cell]&=mask
        break
      }
      default:break
    }
  }

  const cellHouses=Array.from({length:cellCount},()=>[])
  houses.forEach((house,houseIndex)=>house.cells.forEach((cell)=>cellHouses[cell].push(houseIndex)))
  const fullHouses=houses.filter((house)=>house.full).map((house)=>house.cells)
  const cellFullHouses=Array.from({length:cellCount},()=>[])
  fullHouses.forEach((cells,houseIndex)=>cells.forEach((cell)=>cellFullHouses[cell].push(houseIndex)))
  const cellRelations=Array.from({length:cellCount},()=>[])
  relations.forEach((relation,relationIndex)=>{
    cellRelations[relation.first].push(relationIndex)
    cellRelations[relation.second].push(relationIndex)
  })
  const cellUnits=Array.from({length:cellCount},()=>[])
  units.forEach((unit,unitIndex)=>unit.cells.forEach((cell)=>cellUnits[cell].push(unitIndex)))

  return {
    size,cellCount,allMask:fullMask(size),
    houses,fullHouses,cellFullHouses,cellRelations,cellUnits,
    peers,arePeers,relations,units,initialDomain,cellHouses,
    scratchStack:new Int16Array(cellCount),scratchInStack:new Uint8Array(cellCount),
    scratchHouseDirty:new Uint8Array(fullHouses.length),scratchUnitDirty:new Uint8Array(units.length),
    scratchBefore:new Uint16Array(cellCount),
    lineUnits:units.filter((unit)=>unit.kind==='sky'||unit.kind==='sandwich')
  }
}
