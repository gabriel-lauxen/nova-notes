import { buildTree, flattenTree, removeChildrenOf, getProjection } from './src/lib/tree.js'
const notes = [
  { id:'a', parent_id:null, position:0, updated_at:'3' },
  { id:'b', parent_id:null, position:1, updated_at:'2' },
  { id:'c', parent_id:null, position:2, updated_at:'1' },
]
const flat = flattenTree(buildTree(notes, new Set()))
console.log('flat:', flat.map(i=>`${i.id}@d${i.depth}`).join(' '))
const proj = getProjection(flat, 'a', 'b', 18, 18)  // arrasta A pra baixo de B, 18px pra direita
console.log('projeção A sob B:', proj)
