import { arrayMove } from '@dnd-kit/sortable'

// Monta a árvore a partir das notas planas (por parent_id, ordenadas por position).
// `collapsed` é um Set de ids recolhidos (marca a flag em cada nó).
export function buildTree(notes, collapsed = new Set()) {
  const byParent = new Map()
  for (const n of notes) {
    const p = n.parent_id || null
    if (!byParent.has(p)) byParent.set(p, [])
    byParent.get(p).push(n)
  }
  for (const arr of byParent.values())
    arr.sort(
      (a, b) => (a.position ?? 0) - (b.position ?? 0) || (a.updated_at < b.updated_at ? 1 : -1),
    )
  const make = (parentId) =>
    (byParent.get(parentId) || []).map((n) => ({
      ...n,
      collapsed: collapsed.has(n.id),
      children: make(n.id),
    }))
  return make(null)
}

function flatten(items, parentId = null, depth = 0) {
  return items.reduce(
    (acc, item, index) => [
      ...acc,
      { ...item, parentId, depth, index },
      ...flatten(item.children, item.id, depth + 1),
    ],
    [],
  )
}
export function flattenTree(items) {
  return flatten(items)
}

// remove da lista plana os descendentes dos ids informados (collapse / item ativo)
export function removeChildrenOf(items, ids) {
  const exclude = [...ids]
  return items.filter((item) => {
    if (item.parentId && exclude.includes(item.parentId)) {
      if (item.children.length) exclude.push(item.id)
      return false
    }
    return true
  })
}

function countChildren(items) {
  return items.reduce((acc, i) => acc + 1 + countChildren(i.children), 0)
}
export function getChildCount(flatItem) {
  return flatItem?.children ? countChildren(flatItem.children) : 0
}

const getDragDepth = (offset, indentationWidth) => Math.round(offset / indentationWidth)

// Projeção estilo Notion: converte o deslocamento horizontal do drag em
// profundidade/parent válidos, respeitando os vizinhos.
export function getProjection(items, activeId, overId, dragOffset, indentationWidth) {
  const overItemIndex = items.findIndex(({ id }) => id === overId)
  const activeItemIndex = items.findIndex(({ id }) => id === activeId)
  const activeItem = items[activeItemIndex]
  const newItems = arrayMove(items, activeItemIndex, overItemIndex)
  const previousItem = newItems[overItemIndex - 1]
  const nextItem = newItems[overItemIndex + 1]
  const dragDepth = getDragDepth(dragOffset, indentationWidth)
  const projectedDepth = activeItem.depth + dragDepth
  const maxDepth = previousItem ? previousItem.depth + 1 : 0
  const minDepth = nextItem ? nextItem.depth : 0
  let depth = projectedDepth
  if (projectedDepth >= maxDepth) depth = maxDepth
  else if (projectedDepth < minDepth) depth = minDepth

  const getParentId = () => {
    if (depth === 0 || !previousItem) return null
    if (depth === previousItem.depth) return previousItem.parentId
    if (depth > previousItem.depth) return previousItem.id
    const newParent = newItems
      .slice(0, overItemIndex)
      .reverse()
      .find((item) => item.depth === depth)?.parentId
    return newParent ?? null
  }

  return { depth, maxDepth, minDepth, parentId: getParentId() }
}

// evita ciclos: true se `maybeAncestor` é ancestral de `id` (ou o próprio)
export function isAncestor(notesById, id, maybeAncestor) {
  let cur = id
  const seen = new Set()
  while (cur) {
    if (cur === maybeAncestor) return true
    if (seen.has(cur)) break
    seen.add(cur)
    cur = notesById.get(cur)?.parent_id || null
  }
  return false
}
