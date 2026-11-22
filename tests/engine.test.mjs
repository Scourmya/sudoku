// run with: node tests/engine.test.mjs [modeId] [difficulty]
import {generatePuzzle} from '../js/engine/generate.js'
import {compile} from '../js/engine/model.js'
import {propagate,countSolutions,domainFromGivens} from '../js/engine/solver.js'
import {MODES} from '../js/engine/modes.js'

const onlyMode=process.argv[2]
const onlyDifficulty=process.argv[3]?Number(process.argv[3]):null
const seeds=Number(process.env.SEEDS||1)
let failures=0
const timings={}

for(const mode of MODES){
  if(onlyMode&&mode.id!==onlyMode)continue
  const row=[]
  for(let difficulty=1;difficulty<=9;difficulty++){
    if(onlyDifficulty&&difficulty!==onlyDifficulty)continue
    for(let seedIndex=0;seedIndex<seeds;seedIndex++){
      const started=performance.now()
      let puzzle
      try{
        puzzle=generatePuzzle(mode.id,difficulty,'test'+seedIndex)
      }catch(error){
        failures++
        console.log(`FAIL ${mode.id} d${difficulty}: ${error.message}`)
        continue
      }
      const elapsed=performance.now()-started
      const csp=compile(puzzle)
      const solvedDom=domainFromGivens(csp,puzzle.solution)
      const valid=propagate(csp,solvedDom)
      const matches=puzzle.givens.every((value,cell)=>!value||value===puzzle.solution[cell])
      const count=countSolutions(compile(puzzle),puzzle.givens,400000)
      const ok=valid&&matches&&count===1
      if(!ok){
        failures++
        console.log(`FAIL ${mode.id} d${difficulty}: valid=${valid} matches=${matches} solutions=${count}`)
      }
      row.push(`d${difficulty}:${puzzle.tier}/${puzzle.givenCount}g/${Math.round(elapsed)}ms`)
      timings[mode.id]=Math.max(timings[mode.id]||0,elapsed)
    }
  }
  console.log(mode.id.padEnd(12),row.join('  '))
}
console.log(failures?`${failures} failures`:'all ok')
process.exit(failures?1:0)
