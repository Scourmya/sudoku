// draws the puzzle as svg and maps taps to cells
const CELL=100
const NS='http://www.w3.org/2000/svg'
const OP_LABEL={'+':'+','-':'−','x':'×','/':'÷','=':''}
const DISJOINT_TINTS=['#e8a0a0','#e8c58f','#d8d884','#9fd49a','#8fd0cf','#93b4e6','#b39ce6','#e39cd3','#c4b8a6']
const REGION_TINTS=['var(--tint-a)','var(--tint-b)','var(--tint-c)','var(--tint-d)']

function cellBox(cell,size){
  return {row:Math.floor(cell/size),col:cell%size,x:(cell%size)*CELL,y:Math.floor(cell/size)*CELL}
}

function center(cell,size){
  const box=cellBox(cell,size)
  return [box.x+CELL/2,box.y+CELL/2]
}

function margins(puzzle){
  const hasSandwich=puzzle.constraints.some((constraint)=>constraint.type==='sandwich')
  const hasSky=puzzle.constraints.some((constraint)=>constraint.type==='sky')||puzzle.mode==='skyscrapers'
  const pad=6
  if(hasSky)return {top:72,left:72,right:72,bottom:72}
  if(hasSandwich)return {top:72,left:72,right:pad,bottom:pad}
  return {top:pad,left:pad,right:pad,bottom:pad}
}

function regionOfCellFactory(puzzle){
  if(puzzle.mode==='calcudoku'){
    const owner=new Array(puzzle.size*puzzle.size).fill(-1)
    puzzle.constraints.forEach((constraint,index)=>constraint.cells.forEach((cell)=>{owner[cell]=index}))
    return (cell)=>owner[cell]
  }
  if(puzzle.regions)return (cell)=>puzzle.regions[cell]
  return null
}

function colorRegions(puzzle){
  const size=puzzle.size
  const regionCount=Math.max(...puzzle.regions)+1
  const adjacent=Array.from({length:regionCount},()=>new Set())
  for(let cell=0;cell<size*size;cell++){
    const row=Math.floor(cell/size),col=cell%size
    for(const [rowStep,colStep] of [[0,1],[1,0]]){
      const nextRow=row+rowStep,nextCol=col+colStep
      if(nextRow>=size||nextCol>=size)continue
      const first=puzzle.regions[cell],second=puzzle.regions[nextRow*size+nextCol]
      if(first!==second){adjacent[first].add(second);adjacent[second].add(first)}
    }
  }
  const colors=new Array(regionCount).fill(-1)
  for(let region=0;region<regionCount;region++){
    const used=new Set([...adjacent[region]].map((other)=>colors[other]))
    let color=0
    while(used.has(color))color++
    colors[region]=color%REGION_TINTS.length
  }
  return colors
}

function cageOutline(cells,size,inset){
  const inCage=new Set(cells)
  const has=(row,col)=>row>=0&&col>=0&&row<size&&col<size&&inCage.has(row*size+col)
  const segments=[]
  const sides=[
    {normal:[-1,0],tangent:[0,1]},
    {normal:[1,0],tangent:[0,1]},
    {normal:[0,-1],tangent:[1,0]},
    {normal:[0,1],tangent:[1,0]}
  ]
  for(const cell of cells){
    const row=Math.floor(cell/size),col=cell%size
    for(const {normal,tangent} of sides){
      if(has(row+normal[0],col+normal[1]))continue
      const endAdjust=(direction)=>{
        const nextRow=row+tangent[0]*direction,nextCol=col+tangent[1]*direction
        if(!has(nextRow,nextCol))return -inset
        if(has(nextRow+normal[0],nextCol+normal[1]))return inset
        return 0
      }
      const startExtra=endAdjust(-1),endExtra=endAdjust(1)
      if(normal[0]!==0){
        const y=normal[0]<0?row*CELL+inset:(row+1)*CELL-inset
        segments.push([col*CELL-startExtra,y,(col+1)*CELL+endExtra,y])
      }else{
        const x=normal[1]<0?col*CELL+inset:(col+1)*CELL-inset
        segments.push([x,row*CELL-startExtra,x,(row+1)*CELL+endExtra])
      }
    }
  }
  return segments
}

function edgeMid(first,second,size){
  const [firstX,firstY]=center(first,size),[secondX,secondY]=center(second,size)
  return [(firstX+secondX)/2,(firstY+secondY)/2,secondX-firstX,secondY-firstY]
}

function buildStatic(puzzle){
  const size=puzzle.size
  const width=size*CELL
  const tint=[`<rect x="0" y="0" width="${width}" height="${width}" class="board-bg"/>`],deco=[],grid=[]
  const rules=puzzle.rules||{}

  if(rules.windoku){
    for(const [top,left] of [[1,1],[1,5],[5,1],[5,5]]){
      tint.push(`<rect x="${left*CELL}" y="${top*CELL}" width="${3*CELL}" height="${3*CELL}" fill="var(--window)"/>`)
    }
  }
  if(rules.disjoint){
    for(let cell=0;cell<size*size;cell++){
      const box=cellBox(cell,size)
      const position=(box.row%3)*3+box.col%3
      tint.push(`<rect x="${box.x}" y="${box.y}" width="${CELL}" height="${CELL}" fill="${DISJOINT_TINTS[position]}" opacity="var(--disjoint-opacity)"/>`)
    }
  }
  if(rules.jigsaw&&puzzle.regions){
    const colors=colorRegions(puzzle)
    for(let cell=0;cell<size*size;cell++){
      const box=cellBox(cell,size)
      tint.push(`<rect x="${box.x}" y="${box.y}" width="${CELL}" height="${CELL}" fill="${REGION_TINTS[colors[puzzle.regions[cell]]]}"/>`)
    }
  }
  if(rules.diagonal){
    deco.push(`<line x1="0" y1="0" x2="${width}" y2="${width}" class="diag"/><line x1="${width}" y1="0" x2="0" y2="${width}" class="diag"/>`)
  }

  for(const constraint of puzzle.constraints){
    switch(constraint.type){
      case 'parity':{
        const box=cellBox(constraint.cell,size)
        if(constraint.parity==='even')deco.push(`<rect x="${box.x+14}" y="${box.y+14}" width="${CELL-28}" height="${CELL-28}" rx="10" class="even"/>`)
        else deco.push(`<circle cx="${box.x+50}" cy="${box.y+50}" r="37" class="odd"/>`)
        break
      }
      case 'thermo':{
        const points=constraint.cells.map((cell)=>center(cell,size).join(',')).join(' ')
        const [bulbX,bulbY]=center(constraint.cells[0],size)
        deco.push(`<polyline points="${points}" class="thermo-line"/><circle cx="${bulbX}" cy="${bulbY}" r="36" class="thermo-bulb"/>`)
        break
      }
      case 'arrow':{
        const [circleX,circleY]=center(constraint.circle,size)
        const path=constraint.cells.map((cell)=>center(cell,size))
        const [firstX,firstY]=path[0]
        const distance=Math.hypot(firstX-circleX,firstY-circleY)
        const startX=circleX+(firstX-circleX)/distance*38,startY=circleY+(firstY-circleY)/distance*38
        const points=[[startX,startY],...path].map((point)=>point.join(',')).join(' ')
        const [lastX,lastY]=path[path.length-1]
        const [beforeX,beforeY]=path.length>1?path[path.length-2]:[circleX,circleY]
        const angle=Math.atan2(lastY-beforeY,lastX-beforeX)
        const head=(offset)=>`${lastX-22*Math.cos(angle+offset)},${lastY-22*Math.sin(angle+offset)}`
        deco.push(`<circle cx="${circleX}" cy="${circleY}" r="38" class="arrow-circle"/><polyline points="${points}" class="arrow-line"/><polyline points="${head(0.6)} ${lastX},${lastY} ${head(-0.6)}" class="arrow-line"/>`)
        break
      }
      case 'cage':{
        for(const [x1,y1,x2,y2] of cageOutline(constraint.cells,size,7)){
          deco.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="cage"/>`)
        }
        const anchor=cellBox(Math.min(...constraint.cells),size)
        const label=String(constraint.sum)
        deco.push(`<text x="${anchor.x+8}" y="${anchor.y+23}" class="cage-label">${label}</text>`)
        break
      }
      case 'calc':{
        const anchor=cellBox(Math.min(...constraint.cells),size)
        const label=`${constraint.target}${OP_LABEL[constraint.op]}`
        deco.push(`<text x="${anchor.x+8}" y="${anchor.y+24}" class="calc-label">${label}</text>`)
        break
      }
      default:break
    }
  }

  const regionOf=regionOfCellFactory(puzzle)
  for(let index=1;index<size;index++){
    grid.push(`<line x1="${index*CELL}" y1="0" x2="${index*CELL}" y2="${width}" class="thin"/>`)
    grid.push(`<line x1="0" y1="${index*CELL}" x2="${width}" y2="${index*CELL}" class="thin"/>`)
  }
  if(regionOf){
    for(let row=0;row<size;row++){
      for(let col=0;col<size;col++){
        const cell=row*size+col
        if(col+1<size&&regionOf(cell)!==regionOf(cell+1)){
          grid.push(`<line x1="${(col+1)*CELL}" y1="${row*CELL}" x2="${(col+1)*CELL}" y2="${(row+1)*CELL}" class="thick"/>`)
        }
        if(row+1<size&&regionOf(cell)!==regionOf(cell+size)){
          grid.push(`<line x1="${col*CELL}" y1="${(row+1)*CELL}" x2="${(col+1)*CELL}" y2="${(row+1)*CELL}" class="thick"/>`)
        }
      }
    }
  }
  grid.push(`<rect x="0" y="0" width="${width}" height="${width}" class="outer"/>`)

  const marks=[]
  for(const constraint of puzzle.constraints){
    if(constraint.type==='dot'){
      const [x,y]=edgeMid(constraint.a,constraint.b,size)
      marks.push(`<circle cx="${x}" cy="${y}" r="11" class="dot-${constraint.kind}"/>`)
    }else if(constraint.type==='xv'){
      const [x,y]=edgeMid(constraint.a,constraint.b,size)
      marks.push(`<circle cx="${x}" cy="${y}" r="17" class="xv-bg"/><text x="${x}" y="${y+1}" class="xv">${constraint.kind}</text>`)
    }else if(constraint.type==='lt'){
      const [x,y,deltaX,deltaY]=edgeMid(constraint.a,constraint.b,size)
      const length=Math.hypot(deltaX,deltaY)
      const unitX=deltaX/length,unitY=deltaY/length
      const tipX=x-unitX*9,tipY=y-unitY*9
      const backX=x+unitX*9,backY=y+unitY*9
      const sideX=-unitY*13,sideY=unitX*13
      marks.push(`<polyline points="${backX+sideX},${backY+sideY} ${tipX},${tipY} ${backX-sideX},${backY-sideY}" class="ineq"/>`)
    }
  }

  const outside=[]
  for(const constraint of puzzle.constraints){
    if(constraint.type!=='sandwich'&&constraint.type!=='sky')continue
    const label=constraint.type==='sandwich'?constraint.sum:constraint.count
    let x,y
    const position=constraint.index*CELL+CELL/2
    if(constraint.side==='top'){x=position;y=-36}
    else if(constraint.side==='bottom'){x=position;y=width+38}
    else if(constraint.side==='left'){x=-36;y=position}
    else {x=width+36;y=position}
    outside.push(`<text x="${x}" y="${y}" class="outside-clue">${label}</text>`)
  }

  return {tint:tint.join(''),deco:deco.join('')+marks.join(''),grid:grid.join('')+outside.join('')}
}

export function createBoard(container,onCellTap){
  const svg=document.createElementNS(NS,'svg')
  svg.setAttribute('class','board')
  svg.innerHTML='<g class="layer-tint"></g><g class="layer-highlight"></g><g class="layer-deco"></g><g class="layer-grid"></g><g class="layer-circles"></g><g class="layer-digits"></g><g class="layer-select"></g>'
  container.appendChild(svg)
  const layers={
    tint:svg.querySelector('.layer-tint'),highlight:svg.querySelector('.layer-highlight'),deco:svg.querySelector('.layer-deco'),
    grid:svg.querySelector('.layer-grid'),circles:svg.querySelector('.layer-circles'),digits:svg.querySelector('.layer-digits'),select:svg.querySelector('.layer-select')
  }
  let currentPuzzle=null
  let ratio=1

  svg.addEventListener('pointerdown',(event)=>{
    if(!currentPuzzle)return
    const point=svg.createSVGPoint()
    point.x=event.clientX
    point.y=event.clientY
    const matrix=svg.getScreenCTM()
    if(!matrix)return
    const local=point.matrixTransform(matrix.inverse())
    const col=Math.floor(local.x/CELL),row=Math.floor(local.y/CELL)
    const size=currentPuzzle.size
    if(row<0||col<0||row>=size||col>=size)return
    event.preventDefault()
    onCellTap(row*size+col)
  })

  function setPuzzle(puzzle){
    currentPuzzle=puzzle
    const margin=margins(puzzle)
    const width=puzzle.size*CELL
    svg.setAttribute('viewBox',`${-margin.left} ${-margin.top} ${width+margin.left+margin.right} ${width+margin.top+margin.bottom}`)
    ratio=(width+margin.left+margin.right)/(width+margin.top+margin.bottom)
    const parts=buildStatic(puzzle)
    layers.tint.innerHTML=parts.tint
    layers.deco.innerHTML=parts.deco
    layers.grid.innerHTML=parts.grid
  }

  function update(view){
    const puzzle=currentPuzzle
    if(!puzzle)return
    const size=puzzle.size
    const highlight=[]
    const circles=[]
    const digits=[]
    const selected=view.selected
    const selectedValue=selected>=0?view.values[selected]:0
    const peerSet=view.peerCells||new Set()
    for(let cell=0;cell<size*size;cell++){
      const box=cellBox(cell,size)
      const value=view.values[cell]
      let fill=null
      if(view.hidden){
        continue
      }
      if(cell===selected)fill='var(--hl-selected)'
      else if(view.hintCells&&view.hintCells.has(cell))fill='var(--hl-hint-area)'
      else if(view.highlightPeers&&peerSet.has(cell))fill='var(--hl-peer)'
      if(view.errors.has(cell)&&cell!==selected)fill='var(--hl-error)'
      if(fill)highlight.push(`<rect x="${box.x}" y="${box.y}" width="${CELL}" height="${CELL}" fill="${fill}"/>`)
      if(cell===view.hintCell)highlight.push(`<rect x="${box.x+4}" y="${box.y+4}" width="${CELL-8}" height="${CELL-8}" class="hint-pulse"/>`)
      if(value&&view.highlightSame&&value===selectedValue){
        circles.push(`<circle cx="${box.x+50}" cy="${box.y+50}" r="40" class="same-circle"/>`)
      }
      if(value){
        const given=puzzle.givens[cell]>0
        const kind=given?'given':view.errors.has(cell)?'wrong':'entry'
        digits.push(`<text x="${box.x+50}" y="${box.y+53}" class="digit ${kind}">${value}</text>`)
      }else if(view.notes[cell]){
        for(let note=1;note<=size;note++){
          if(!(view.notes[cell]&(1<<note)))continue
          const noteX=box.x+21+((note-1)%3)*29
          const noteY=box.y+24+Math.floor((note-1)/3)*28
          const sameNote=view.highlightSame&&selectedValue===note
          if(sameNote)circles.push(`<circle cx="${noteX}" cy="${noteY}" r="14" class="note-circle"/>`)
          digits.push(`<text x="${noteX}" y="${noteY}" class="note${sameNote?' note-same':''}">${note}</text>`)
        }
      }
    }
    layers.highlight.innerHTML=highlight.join('')
    layers.circles.innerHTML=view.hidden?'':circles.join('')
    layers.digits.innerHTML=view.hidden?'':digits.join('')
    if(selected>=0&&!view.hidden){
      const box=cellBox(selected,size)
      layers.select.innerHTML=`<rect x="${box.x+2.5}" y="${box.y+2.5}" width="${CELL-5}" height="${CELL-5}" class="selection"/>`
    }else{
      layers.select.innerHTML=''
    }
    svg.classList.toggle('is-hidden',!!view.hidden)
  }

  return {setPuzzle,update,element:svg,ratio:()=>ratio}
}

export function renderThumbnail(puzzle){
  const holder=document.createElement('div')
  const board=createBoard(holder,()=>{})
  board.setPuzzle(puzzle)
  board.update({values:puzzle.givens,notes:[],selected:-1,errors:new Set()})
  return holder.innerHTML
}
