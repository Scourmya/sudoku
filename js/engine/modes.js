// catalog of puzzle types, grouped into menu categories

export const CATEGORIES=[
  {id:'classic',name:'Classic',blurb:'The standard rules on regular grids.'},
  {id:'regions',name:'Extra Regions',blurb:'Sudoku with more areas that must hold every digit.'},
  {id:'math',name:'Math Clues',blurb:'Sums, comparisons and dots that tie cells together.'},
  {id:'anti',name:'Anti Rules',blurb:'Normal sudoku plus restrictions on nearby cells.'},
  {id:'other',name:'Other Puzzles',blurb:'Sudoku cousins built on Latin squares.'}
]

export const MODES=[
  {id:'classic',category:'classic',name:'Classic',size:9,
    short:'The original 9×9.',
    rules:'Fill every row, column and 3×3 box with the digits 1 to 9, each exactly once.'},
  {id:'mini6',category:'classic',name:'Mini 6×6',size:6,
    short:'Smaller grid with 2×3 boxes.',
    rules:'Fill every row, column and 2×3 box with the digits 1 to 6, each exactly once.'},

  {id:'diagonal',category:'regions',name:'Sudoku X',size:9,
    short:'Both long diagonals hold 1–9.',
    rules:'Classic rules, and each of the two main diagonals must also contain 1 to 9 once.'},
  {id:'windoku',category:'regions',name:'Windoku',size:9,
    short:'Four shaded windows hold 1–9.',
    rules:'Classic rules, plus the four shaded 3×3 windows must each contain 1 to 9 once.'},
  {id:'jigsaw',category:'regions',name:'Jigsaw',size:9,
    short:'Boxes are irregular shapes.',
    rules:'Every row, column and bold irregular region contains 1 to 9 once. There are no 3×3 boxes.'},
  {id:'disjoint',category:'regions',name:'Disjoint Groups',size:9,
    short:'Same spot in every box holds 1–9.',
    rules:'Classic rules, plus cells in the same position of each box (all top-left cells, all centers, and so on) must contain 1 to 9 once. Matching positions share a tint.'},

  {id:'killer',category:'math',name:'Killer',size:9,
    short:'Cages show the sum of their digits.',
    rules:'Classic rules. The digits in each dashed cage add up to the small number in its corner, and digits never repeat inside a cage.'},
  {id:'sandwich',category:'math',name:'Sandwich',size:9,
    short:'Sum between the 1 and the 9.',
    rules:'Classic rules. A clue outside the grid is the sum of the digits sitting between the 1 and the 9 in that row or column.'},
  {id:'arrow',category:'math',name:'Arrow',size:9,
    short:'Arrow digits add up to the circle.',
    rules:'Classic rules. Digits along an arrow add up to the digit in its circle. Digits may repeat on an arrow if sudoku rules allow it.'},
  {id:'thermo',category:'math',name:'Thermo',size:9,
    short:'Digits rise from the bulb.',
    rules:'Classic rules. Along each thermometer, digits strictly increase starting from the round bulb.'},
  {id:'kropki',category:'math',name:'Kropki',size:9,
    short:'Dots mark +1 and ×2 pairs.',
    rules:'Classic rules. A white dot joins two digits that differ by 1. A black dot joins two digits where one is double the other. Every possible dot is shown, so neighbors with no dot have neither relationship.'},
  {id:'consecutive',category:'math',name:'Consecutive',size:9,
    short:'Bars mark neighbors that differ by 1.',
    rules:'Classic rules. A bar between two cells means their digits differ by exactly 1. All bars are shown, so neighbors without a bar are never consecutive.'},
  {id:'xv',category:'math',name:'XV',size:9,
    short:'X sums to 10, V sums to 5.',
    rules:'Classic rules. Cells joined by an X add up to 10, cells joined by a V add up to 5. All X and V marks are shown.'},
  {id:'evenodd',category:'math',name:'Even / Odd',size:9,
    short:'Gray squares even, circles odd.',
    rules:'Classic rules. A gray square must hold an even digit and a circle must hold an odd digit.'},
  {id:'greater',category:'math',name:'Greater Than',size:9,
    short:'Signs compare neighbors in a box.',
    rules:'Classic rules. Inside each box, the sign between two cells points to the smaller digit, like > and <.'},

  {id:'antiknight',category:'anti',name:'Anti-Knight',size:9,
    short:'No twin a knight move apart.',
    rules:'Classic rules. Two cells a chess knight move apart can never hold the same digit.'},
  {id:'antiking',category:'anti',name:'Anti-King',size:9,
    short:'No twin touching diagonally.',
    rules:'Classic rules. Cells that touch, even only at a corner, can never hold the same digit.'},
  {id:'nonconsec',category:'anti',name:'Non-Consecutive',size:9,
    short:'Neighbors never differ by 1.',
    rules:'Classic rules. Cells that share a side can never hold consecutive digits (like 4 and 5).'},

  {id:'calcudoku',category:'other',name:'Calcudoku',size:0,
    short:'KenKen style math cages.',
    rules:'Each row and column contains 1 to N once (no boxes). The digits in each cage combine to the target using the operation shown. For − and ÷ the larger digit comes first. Digits can repeat in a cage if they are in different rows and columns.'},
  {id:'futoshiki',category:'other',name:'Futoshiki',size:0,
    short:'Latin square with inequalities.',
    rules:'Each row and column contains 1 to N once (no boxes). Every inequality sign between two cells must be true.'},
  {id:'skyscrapers',category:'other',name:'Skyscrapers',size:0,
    short:'Count the buildings you can see.',
    rules:'Each row and column contains 1 to N once. Digits are building heights. A clue says how many buildings you see from that side, since taller buildings hide shorter ones behind them.'}
]

export const MODE_BY_ID=Object.fromEntries(MODES.map((mode)=>[mode.id,mode]))

export const DIFFICULTY_NAMES=['','Gentle','Easy','Easy+','Moderate','Tricky','Hard','Expert','Master','Fiendish']

export const LATIN_SIZES={
  calcudoku:[0,4,4,5,5,6,6,6,7,7],
  futoshiki:[0,4,5,5,6,6,7,7,8,8],
  skyscrapers:[0,4,4,5,5,6,6,6,7,7]
}
