// builds puzzles for every mode at difficulty 1 to 9
import {createRng} from './rng.js'
import {compile,boxRegions,orthogonalPairs} from './model.js'
import {solve,countSolutions,domainFromGivens} from './solver.js'
import {logicSolve,gradePuzzle} from './logic.js'
import {POPCOUNT} from './bits.js'
import {LATIN_SIZES} from './modes.js'

const PLAN=[
  null,
  {fraction:0.56,minTier:1,maxTier:1},
  {fraction:0.49,minTier:1,maxTier:1},
  {fraction:0.43,minTier:1,maxTier:1},
  {fraction:0,minTier:1,maxTier:1},
  {fraction:0,minTier:2,maxTier:2},
  {fraction:0,minTier:3,maxTier:3},
  {fraction:0,minTier:4,maxTier:4},
  {fraction:0,minTier:5,maxTier:5,maxNodes:3},
  {fraction:0,minTier:5,maxTier:5,minNodes:4}
]

const SETTINGS={
  classic:{clueFactor:1,symmetric:true,attempts:30},
  mini6:{clueFactor:1,symmetric:true,attempts:12},
  diagonal:{clueFactor:0.92,symmetric:true,attempts:6},
  windoku:{clueFactor:0.9,symmetric:true,attempts:6},
  jigsaw:{clueFactor:1,symmetric:false,attempts:5},
  disjoint:{clueFactor:0.92,symmetric:true,attempts:6},
  killer:{clueFactor:0.4,symmetric:false,attempts:4},
  sandwich:{clueFactor:0.6,symmetric:true,attempts:4},
  arrow:{clueFactor:0.75,symmetric:false,attempts:4},
  thermo:{clueFactor:0.7,symmetric:false,attempts:4},
  kropki:{clueFactor:0.35,symmetric:false,attempts:4},
  consecutive:{clueFactor:0.55,symmetric:false,attempts:4},
  xv:{clueFactor:0.5,symmetric:false,attempts:4},
  evenodd:{clueFactor:0.8,symmetric:true,attempts:5},
  greater:{clueFactor:0.3,symmetric:false,attempts:4},
  antiknight:{clueFactor:0.85,symmetric:true,attempts:5,uniqueNodeLimit:15000},
  antiking:{clueFactor:0.85,symmetric:true,attempts:5},
  nonconsec:{clueFactor:0.6,symmetric:true,attempts:4,heavy:true,uniqueNodeLimit:4000},
  calcudoku:{attempts:4},
  futoshiki:{clueFactor:0.6,symmetric:false,attempts:4},
  skyscrapers:{attempts:4}
}

const KING_STEPS=[[0,1],[1,0],[0,-1],[-1,0],[1,1],[1,-1],[-1,1],[-1,-1]]
const ORTHO_STEPS=[[0,1],[1,0],[0,-1],[-1,0]]

function neighborsOf(cell,size,steps){
  const row=Math.floor(cell/size),col=cell%size
  const result=[]
  for(const [rowStep,colStep] of steps){
    const nextRow=row+rowStep,nextCol=col+colStep
    if(nextRow>=0&&nextCol>=0&&nextRow<size&&nextCol<size)result.push(nextRow*size+nextCol)
  }
  return result
}

function randomSolution(structure,rng,nodeLimit=30000){
  const csp=compile({...structure,constraints:structure.constraints||[]})
  const result=solve(csp,csp.initialDomain,{maxSolutions:1,nodeLimit,rng})
  return result.count?result.solutions[0]:null
}

function standard(size,boxRows,boxCols,rules={}){
  return {size,boxRows,boxCols,regions:boxRegions(size,boxRows,boxCols),rules,constraints:[]}
}

function withSolution(structure,rng,tries=40){
  for(let attempt=0;attempt<tries;attempt++){
    const solution=randomSolution(structure,rng,2500)
    if(solution)return {...structure,solution}
  }
  return null
}

function randomJigsawRegions(rng){
  const size=9
  const regions=boxRegions(9,3,3)
  const connected=(region)=>{
    const cells=[]
    for(let cell=0;cell<81;cell++)if(regions[cell]===region)cells.push(cell)
    const seen=new Set([cells[0]])
    const queue=[cells[0]]
    while(queue.length){
      const current=queue.pop()
      for(const next of neighborsOf(current,size,ORTHO_STEPS)){
        if(regions[next]===region&&!seen.has(next)){seen.add(next);queue.push(next)}
      }
    }
    return seen.size===cells.length
  }
  for(let step=0;step<2500;step++){
    const cell=rng.int(81)
    const own=regions[cell]
    const touching=neighborsOf(cell,size,ORTHO_STEPS).map((next)=>regions[next]).filter((region)=>region!==own)
    if(!touching.length)continue
    const other=rng.pick(touching)
    const candidates=[]
    for(let index=0;index<81;index++){
      if(regions[index]!==other)continue
      if(neighborsOf(index,size,ORTHO_STEPS).some((next)=>regions[next]===own&&next!==cell))candidates.push(index)
    }
    if(!candidates.length)continue
    const swap=rng.pick(candidates)
    regions[cell]=other;regions[swap]=own
    if(!connected(own)||!connected(other)){regions[cell]=own;regions[swap]=other}
  }
  return regions
}

function growGroups(size,rng,pickSize,canJoin){
  const cellCount=size*size
  const groupOf=new Array(cellCount).fill(-1)
  const groups=[]
  for(const start of rng.shuffle([...Array(cellCount).keys()])){
    if(groupOf[start]>=0)continue
    const targetSize=pickSize()
    const group=[start]
    groupOf[start]=groups.length
    while(group.length<targetSize){
      const frontier=[]
      for(const cell of group){
        for(const next of neighborsOf(cell,size,ORTHO_STEPS)){
          if(groupOf[next]<0&&!frontier.includes(next)&&canJoin(group,next))frontier.push(next)
        }
      }
      if(!frontier.length)break
      const chosen=rng.pick(frontier)
      group.push(chosen)
      groupOf[chosen]=groups.length
    }
    groups.push(group)
  }
  return {groups,groupOf}
}

function mergeSingletons(groups,groupOf,size,rng,canJoin,keepChance){
  for(let groupIndex=0;groupIndex<groups.length;groupIndex++){
    const group=groups[groupIndex]
    if(group.length!==1||rng.chance(keepChance))continue
    const cell=group[0]
    const options=neighborsOf(cell,size,ORTHO_STEPS).map((next)=>groupOf[next]).filter((other)=>other!==groupIndex&&groups[other].length>0&&groups[other].length<5&&canJoin(groups[other],cell))
    if(!options.length)continue
    const target=rng.pick(options)
    groups[target].push(cell)
    groupOf[cell]=target
    groups[groupIndex]=[]
  }
  return groups.filter((group)=>group.length)
}

function sizePicker(rng,weights){
  const total=weights.reduce((sum,weight)=>sum+weight,0)
  return ()=>{
    let roll=rng.next()*total
    for(let index=0;index<weights.length;index++){
      roll-=weights[index]
      if(roll<0)return index+1
    }
    return weights.length
  }
}

function killerCages(solution,rng,difficulty){
  const weights=difficulty<=3?[0.04,0.5,0.4,0.06]:difficulty<=6?[0.03,0.3,0.4,0.22,0.05]:[0.02,0.2,0.35,0.3,0.13]
  const canJoin=(group,cell)=>!group.some((member)=>solution[member]===solution[cell])
  const grown=growGroups(9,rng,sizePicker(rng,weights),canJoin)
  const groups=mergeSingletons(grown.groups,grown.groupOf,9,rng,canJoin,0.25)
  return groups.map((cells)=>({type:'cage',cells:cells.sort((left,right)=>left-right),sum:cells.reduce((total,cell)=>total+solution[cell],0)}))
}

function crossKey(first,second){
  return first<second?first+'-'+second:second+'-'+first
}

function diagonalBlocked(from,to,size,segments){
  const fromRow=Math.floor(from/size),fromCol=from%size,toRow=Math.floor(to/size),toCol=to%size
  if(fromRow===toRow||fromCol===toCol)return false
  return segments.has(crossKey(fromRow*size+toCol,toRow*size+fromCol))
}

function addSegments(cells,size,segments){
  for(let index=1;index<cells.length;index++)segments.add(crossKey(cells[index-1],cells[index]))
}

function findPath(start,length,size,rng,used,segments,accept,stepOk){
  const path=[]
  const walk=(current)=>{
    if(path.length===length)return accept(path)
    for(const next of rng.shuffle(neighborsOf(current,size,KING_STEPS))){
      if(used.has(next)||path.includes(next)||next===start)continue
      if(diagonalBlocked(current,next,size,segments))continue
      if(!stepOk(path,current,next))continue
      path.push(next)
      if(walk(next))return true
      path.pop()
    }
    return false
  }
  return walk(start)?path.slice():null
}

function buildArrows(solution,rng){
  const size=9
  const used=new Set(),segments=new Set()
  const arrows=[]
  const targetCount=rng.range(9,12)
  for(let attempt=0;attempt<600&&arrows.length<targetCount;attempt++){
    const circle=rng.int(81)
    if(used.has(circle)||solution[circle]<3)continue
    const total=solution[circle]
    const length=rng.range(2,Math.min(4,total-1))
    const stepOk=(path,current,next)=>{
      let sum=solution[next]
      for(const cell of path)sum+=solution[cell]
      return sum+(length-path.length-1)<=total
    }
    const accept=(path)=>path.reduce((sum,cell)=>sum+solution[cell],0)===total
    const path=findPath(circle,length,size,rng,used,segments,accept,stepOk)
    if(!path)continue
    used.add(circle)
    path.forEach((cell)=>used.add(cell))
    addSegments([circle,...path],size,segments)
    arrows.push({type:'arrow',circle,cells:path})
  }
  return arrows
}

function buildThermos(solution,rng){
  const size=9
  const used=new Set(),segments=new Set()
  const thermos=[]
  const targetCount=rng.range(6,9)
  for(let attempt=0;attempt<600&&thermos.length<targetCount;attempt++){
    const bulb=rng.int(81)
    if(used.has(bulb)||solution[bulb]>6)continue
    const length=rng.range(2,5)
    const stepOk=(path,current,next)=>solution[next]>solution[current]
    const path=findPath(bulb,length,size,rng,used,segments,()=>true,stepOk)
    if(!path)continue
    const cells=[bulb,...path]
    cells.forEach((cell)=>used.add(cell))
    addSegments(cells,size,segments)
    thermos.push({type:'thermo',cells})
  }
  return thermos
}

function lineCells(size,orientation,index,reversed=false){
  const cells=[]
  for(let position=0;position<size;position++){
    cells.push(orientation==='row'?index*size+position:position*size+index)
  }
  return reversed?cells.reverse():cells
}

function sandwichClues(solution){
  const clues=[]
  for(const orientation of ['column','row']){
    for(let index=0;index<9;index++){
      const cells=lineCells(9,orientation,index)
      const values=cells.map((cell)=>solution[cell])
      const first=values.findIndex((value)=>value===1||value===9)
      const second=values.findIndex((value,position)=>position>first&&(value===1||value===9))
      let sum=0
      for(let position=first+1;position<second;position++)sum+=values[position]
      clues.push({type:'sandwich',side:orientation==='row'?'left':'top',index,cells,sum})
    }
  }
  return clues
}

function skyClues(solution,size){
  const clues=[]
  const sides=[['top','column',false],['bottom','column',true],['left','row',false],['right','row',true]]
  for(const [side,orientation,reversed] of sides){
    for(let index=0;index<size;index++){
      const cells=lineCells(size,orientation,index,reversed)
      let visible=0,tallest=0
      for(const cell of cells)if(solution[cell]>tallest){tallest=solution[cell];visible++}
      clues.push({type:'sky',side,index,cells,count:visible})
    }
  }
  return clues
}

function pairMarks(solution,size,decide){
  const marks=[]
  for(const [first,second] of orthogonalPairs(size)){
    const mark=decide(solution[first],solution[second],first,second)
    if(mark)marks.push(mark)
  }
  return marks
}

function calcCages(solution,size,rng,difficulty){
  const maxCage=[0,2,2,3,3,3,4,4,4,4][difficulty]
  const weights=[0.1,0.45,0.3,0.15].slice(0,maxCage)
  const operations=difficulty<=2?['+','-']:difficulty<=4?['+','-','x']:['+','-','x','/']
  const grown=growGroups(size,rng,sizePicker(rng,weights),()=>true)
  const groups=mergeSingletons(grown.groups,grown.groupOf,size,rng,()=>true,difficulty<=3?0.5:0.2)
  return groups.map((cells)=>makeCalcCage(cells,solution,operations,rng))
}

function makeCalcCage(cells,solution,operations,rng){
  const sorted=cells.slice().sort((left,right)=>left-right)
  const values=sorted.map((cell)=>solution[cell])
  if(sorted.length===1)return {type:'calc',cells:sorted,op:'=',target:values[0]}
  const options=[]
  if(sorted.length===2){
    const high=Math.max(...values),low=Math.min(...values)
    if(operations.includes('/')&&high%low===0&&high!==low)options.push('/','/')
    if(operations.includes('-'))options.push('-')
  }
  options.push('+')
  const product=values.reduce((total,value)=>total*value,1)
  if(operations.includes('x')&&product<=3000)options.push('x')
  const op=rng.pick(options)
  let target
  if(op==='+')target=values.reduce((total,value)=>total+value,0)
  else if(op==='x')target=product
  else if(op==='-')target=Math.abs(values[0]-values[1])
  else target=Math.max(...values)/Math.min(...values)
  return {type:'calc',cells:sorted,op,target}
}

function buildBase(modeId,rng,difficulty){
  switch(modeId){
    case 'classic':return withSolution(standard(9,3,3),rng)
    case 'mini6':return withSolution(standard(6,2,3),rng)
    case 'diagonal':return withSolution(standard(9,3,3,{diagonal:true}),rng)
    case 'windoku':return withSolution(standard(9,3,3,{windoku:true}),rng)
    case 'disjoint':return withSolution(standard(9,3,3,{disjoint:true}),rng)
    case 'antiknight':return withSolution(standard(9,3,3,{antiKnight:true}),rng)
    case 'antiking':return withSolution(standard(9,3,3,{antiKing:true}),rng)
    case 'nonconsec':return withSolution(standard(9,3,3,{nonConsecutive:true}),rng)
    case 'jigsaw':{
      for(let attempt=0;attempt<8;attempt++){
        const structure={size:9,boxRows:0,boxCols:0,regions:randomJigsawRegions(rng),rules:{jigsaw:true},constraints:[]}
        const solution=randomSolution(structure,rng,20000)
        if(solution)return {...structure,solution}
      }
      return null
    }
    case 'killer':{
      const base=withSolution(standard(9,3,3),rng)
      return {...base,constraints:killerCages(base.solution,rng,difficulty)}
    }
    case 'sandwich':{
      const base=withSolution(standard(9,3,3),rng)
      return {...base,constraints:sandwichClues(base.solution)}
    }
    case 'arrow':{
      const base=withSolution(standard(9,3,3),rng)
      return {...base,constraints:buildArrows(base.solution,rng)}
    }
    case 'thermo':{
      const base=withSolution(standard(9,3,3),rng)
      return {...base,constraints:buildThermos(base.solution,rng)}
    }
    case 'kropki':{
      const base=withSolution(standard(9,3,3),rng)
      const marks=pairMarks(base.solution,9,(first,second,a,b)=>{
        const white=Math.abs(first-second)===1,black=first===2*second||second===2*first
        if(white&&black)return {type:'dot',a,b,kind:rng.chance(0.5)?'white':'black'}
        if(white)return {type:'dot',a,b,kind:'white'}
        if(black)return {type:'dot',a,b,kind:'black'}
        return null
      })
      return {...base,rules:{negativeDots:'kropki'},constraints:marks}
    }
    case 'consecutive':{
      const base=withSolution(standard(9,3,3),rng)
      const marks=pairMarks(base.solution,9,(first,second,a,b)=>Math.abs(first-second)===1?{type:'dot',a,b,kind:'white'}:null)
      return {...base,rules:{negativeDots:'white'},constraints:marks}
    }
    case 'xv':{
      const base=withSolution(standard(9,3,3),rng)
      const marks=pairMarks(base.solution,9,(first,second,a,b)=>{
        if(first+second===10)return {type:'xv',a,b,kind:'X'}
        if(first+second===5)return {type:'xv',a,b,kind:'V'}
        return null
      })
      return {...base,rules:{xvNegative:true},constraints:marks}
    }
    case 'evenodd':{
      const base=withSolution(standard(9,3,3),rng)
      const marks=[]
      for(let cell=0;cell<81;cell++){
        if(rng.chance(0.5))marks.push({type:'parity',cell,parity:base.solution[cell]%2===0?'even':'odd'})
      }
      return {...base,constraints:marks}
    }
    case 'greater':{
      const base=withSolution(standard(9,3,3),rng)
      const marks=[]
      for(const [first,second] of orthogonalPairs(9)){
        if(base.regions[first]!==base.regions[second])continue
        if(base.solution[first]<base.solution[second])marks.push({type:'lt',a:first,b:second})
        else marks.push({type:'lt',a:second,b:first})
      }
      return {...base,constraints:marks}
    }
    case 'calcudoku':{
      const size=LATIN_SIZES.calcudoku[difficulty]
      const structure={size,boxRows:0,boxCols:0,regions:null,rules:{},constraints:[]}
      const solution=randomSolution(structure,rng)
      return {...structure,solution,constraints:calcCages(solution,size,rng,difficulty)}
    }
    case 'futoshiki':{
      const size=LATIN_SIZES.futoshiki[difficulty]
      const structure={size,boxRows:0,boxCols:0,regions:null,rules:{},constraints:[]}
      const solution=randomSolution(structure,rng)
      const marks=[]
      for(const [first,second] of orthogonalPairs(size)){
        if(solution[first]<solution[second])marks.push({type:'lt',a:first,b:second})
        else marks.push({type:'lt',a:second,b:first})
      }
      return {...structure,solution,constraints:marks}
    }
    case 'skyscrapers':{
      const size=LATIN_SIZES.skyscrapers[difficulty]
      const structure={size,boxRows:0,boxCols:0,regions:null,rules:{},constraints:[]}
      const solution=randomSolution(structure,rng)
      return {...structure,solution,constraints:skyClues(solution,size)}
    }
    default:throw new Error('unknown mode '+modeId)
  }
}

let uniqueNodeLimit=40000

function acceptable(csp,givens,maxTier){
  if(maxTier<5)return logicSolve(csp,givens,maxTier).solved
  return countSolutions(csp,givens,uniqueNodeLimit)===1
}

function removalGroups(size,rng,symmetric){
  const cellCount=size*size
  const groups=[]
  const seen=new Set()
  for(let cell=0;cell<cellCount;cell++){
    if(seen.has(cell))continue
    const mirror=cellCount-1-cell
    if(symmetric&&mirror!==cell){
      groups.push([cell,mirror]);seen.add(cell);seen.add(mirror)
    }else{
      groups.push([cell]);seen.add(cell)
    }
  }
  return rng.shuffle(groups)
}

function removeGivens(csp,givens,size,rng,symmetric,target,maxTier){
  let givenCount=givens.filter(Boolean).length
  for(const group of removalGroups(size,rng,symmetric)){
    if(givenCount-group.length<target)continue
    if(group.some((cell)=>!givens[cell]))continue
    const saved=group.map((cell)=>givens[cell])
    group.forEach((cell)=>{givens[cell]=0})
    if(acceptable(csp,givens,maxTier))givenCount-=group.length
    else group.forEach((cell,index)=>{givens[cell]=saved[index]})
  }
  return givens
}

function removeConstraints(base,givens,rng,removableType,keepCount,maxTier){
  let constraints=base.constraints.slice()
  const removable=rng.shuffle(constraints.filter((constraint)=>constraint.type===removableType))
  let remaining=removable.length
  for(const constraint of removable){
    if(remaining<=keepCount)break
    const trial=constraints.filter((other)=>other!==constraint)
    const csp=compile({...base,constraints:trial})
    if(acceptable(csp,givens,maxTier)){
      constraints=trial
      remaining--
    }
  }
  return constraints
}

function refineCalc(base,rng,maxTier,difficulty){
  let constraints=base.constraints.slice()
  const operations=difficulty<=2?['+','-']:difficulty<=4?['+','-','x']:['+','-','x','/']
  const givens=new Array(base.size*base.size).fill(0)
  for(let round=0;round<40;round++){
    const csp=compile({...base,constraints})
    const result=maxTier<5?logicSolve(csp,givens,maxTier):null
    if(result&&result.solved)return constraints
    if(!result){
      const count=countSolutions(csp,givens,30000)
      if(count===1)return constraints
    }
    const dom=result?result.dom:domainFromGivens(csp,givens)
    const open=[]
    for(let cell=0;cell<dom.length;cell++)if(POPCOUNT[dom[cell]]>1)open.push(cell)
    if(!open.length)return null
    const cell=rng.pick(open)
    const owner=constraints.find((constraint)=>constraint.cells.includes(cell))
    if(owner.cells.length===1)return null
    constraints=constraints.filter((constraint)=>constraint!==owner)
    const rest=owner.cells.filter((other)=>other!==cell)
    for(const piece of splitConnected(rest,base.size))constraints.push(makeCalcCage(piece,base.solution,operations,rng))
    const partner=neighborsOf(cell,base.size,ORTHO_STEPS).filter((other)=>rest.includes(other))
    if(partner.length&&rng.chance(0.6)){
      const pairPartner=rng.pick(partner)
      const holder=constraints.find((constraint)=>constraint.cells.includes(pairPartner))
      if(holder.cells.length>2){
        constraints=constraints.filter((constraint)=>constraint!==holder)
        const remainder=holder.cells.filter((other)=>other!==pairPartner)
        for(const piece of splitConnected(remainder,base.size))constraints.push(makeCalcCage(piece,base.solution,operations,rng))
        constraints.push(makeCalcCage([cell,pairPartner],base.solution,operations,rng))
        continue
      }
    }
    constraints.push(makeCalcCage([cell],base.solution,operations,rng))
  }
  return null
}

function splitConnected(cells,size){
  const pieces=[]
  const left=new Set(cells)
  while(left.size){
    const start=left.values().next().value
    left.delete(start)
    const piece=[start]
    const queue=[start]
    while(queue.length){
      const current=queue.pop()
      for(const next of neighborsOf(current,size,ORTHO_STEPS)){
        if(left.has(next)){left.delete(next);piece.push(next);queue.push(next)}
      }
    }
    pieces.push(piece)
  }
  return pieces
}

function attemptPuzzle(modeId,rng,difficulty){
  const plan=PLAN[difficulty]
  const settings=SETTINGS[modeId]
  const base=buildBase(modeId,rng,difficulty)
  if(!base||!base.solution)return null
  const size=base.size
  const cellCount=size*size
  const stageTier=plan.maxTier===5?4:plan.maxTier

  if(modeId==='calcudoku'){
    const constraints=refineCalc(base,rng,plan.maxTier,difficulty)
    if(!constraints)return null
    const puzzle={...base,constraints,givens:new Array(cellCount).fill(0)}
    return finish(puzzle)
  }
  if(modeId==='skyscrapers'){
    let givens=base.solution.slice()
    let csp=compile(base)
    givens=removeGivens(csp,givens,size,rng,false,0,stageTier)
    const keepFraction=[0,1,0.85,0.8,0.7,0.6,0.5,0,0,0][difficulty]
    const total=base.constraints.length
    let constraints=removeConstraints(base,givens,rng,'sky',Math.round(total*keepFraction),stageTier)
    if(plan.maxTier===5){
      constraints=removeConstraints({...base,constraints},givens,rng,'sky',0,5)
    }
    return finish({...base,constraints,givens})
  }
  if(modeId==='futoshiki'){
    const keepFraction=[0,0.55,0.45,0.4,0.35,0.3,0.25,0,0,0][difficulty]
    const total=base.constraints.length
    let constraints=rng.shuffle(base.constraints.slice()).slice(0,Math.max(1,Math.round(total*Math.max(keepFraction,0.35))))
    let givens=base.solution.slice()
    const target=Math.round(plan.fraction*settings.clueFactor*cellCount)
    let csp=compile({...base,constraints})
    givens=removeGivens(csp,givens,size,rng,false,target,stageTier)
    constraints=removeConstraints({...base,constraints},givens,rng,'lt',Math.round(total*keepFraction),stageTier)
    if(plan.maxTier===5){
      csp=compile({...base,constraints})
      givens=removeGivens(csp,givens,size,rng,false,0,5)
    }
    return finish({...base,constraints,givens})
  }

  const csp=compile(base)
  let givens=base.solution.slice()
  if(difficulty<=4){
    const target=Math.round(plan.fraction*settings.clueFactor*cellCount)
    givens=removeGivens(csp,givens,size,rng,settings.symmetric,target,1)
  }else if(settings.heavy&&plan.maxTier<5){
    givens=removeGivens(csp,givens,size,rng,false,0,plan.maxTier)
  }else{
    givens=removeGivens(csp,givens,size,rng,false,0,4)
    givens=removeGivens(csp,givens,size,rng,false,0,5)
    if(plan.maxTier<5){
      givens=addBackUntilSolvable(csp,givens,base.solution,rng,plan.maxTier)
      givens=removeGivens(csp,givens,size,rng,false,0,plan.maxTier)
    }
  }
  return finish({...base,givens})
}

function addBackUntilSolvable(csp,givens,solution,rng,maxTier){
  for(let guard=0;guard<80;guard++){
    const result=logicSolve(csp,givens,maxTier)
    if(result.solved)return givens
    const open=[]
    for(let cell=0;cell<givens.length;cell++)if(POPCOUNT[result.dom[cell]]>1)open.push(cell)
    if(!open.length)return givens
    const cell=rng.pick(open)
    givens[cell]=solution[cell]
  }
  return givens
}

function finish(puzzle){
  const csp=compile(puzzle)
  const tier=gradePuzzle(csp,puzzle.givens)
  let searchNodes=0
  if(tier===5)searchNodes=solve(csp,domainFromGivens(csp,puzzle.givens),{maxSolutions:2,nodeLimit:200000}).nodes
  return {...puzzle,tier,searchNodes,givenCount:puzzle.givens.filter(Boolean).length}
}

export function generatePuzzle(modeId,difficulty,seed){
  const plan=PLAN[difficulty]
  const settings=SETTINGS[modeId]
  const rng=createRng(`${modeId}|${difficulty}|${seed}`)
  uniqueNodeLimit=settings.uniqueNodeLimit||40000
  let best=null,bestScore=Infinity
  for(let attempt=0;attempt<settings.attempts;attempt++){
    const puzzle=attemptPuzzle(modeId,rng,difficulty)
    if(!puzzle)continue
    let score=0
    if(puzzle.tier<plan.minTier)score=plan.minTier-puzzle.tier
    if(puzzle.tier>plan.maxTier)score=(puzzle.tier-plan.maxTier)*3
    if(puzzle.tier===5&&plan.maxNodes&&puzzle.searchNodes>plan.maxNodes)score+=0.5
    if(puzzle.tier===5&&plan.minNodes&&puzzle.searchNodes<plan.minNodes)score+=0.5
    if(score<bestScore){best=puzzle;bestScore=score}
    if(score===0)break
  }
  if(!best)throw new Error('could not generate '+modeId)
  return {
    id:`${modeId}-${difficulty}-${seed}`,
    mode:modeId,difficulty,seed:String(seed),
    size:best.size,boxRows:best.boxRows||0,boxCols:best.boxCols||0,
    regions:best.regions||null,rules:best.rules||{},constraints:best.constraints||[],
    givens:best.givens,solution:best.solution,tier:best.tier,givenCount:best.givenCount
  }
}
