import type { GameObjectNode } from '../core/schema';

/**
 * The pure half of the scene tree's navigation: which rows a filter shows,
 * which groups sit above a node, and which groups there are to collapse.
 *
 * None of it touches the document. The tree's filter, its collapsed groups and
 * what it reveals are all local state in `SceneTree`, like the collapsed set
 * always was — never saved, never undoable, never marking the file dirty.
 */

export interface TreeFilter {
  /** Nodes whose name or type contains the query. */
  matches: ReadonlySet<string>;
  /** The matches plus every group above one, so a match is never shown without its ancestry. */
  visible: ReadonlySet<string>;
}

/**
 * Filters a tree by a case-insensitive substring of each node's name or type.
 *
 * The type is included so "sprite" or "tilemap" finds every object of that
 * kind, which is the other question somebody scanning a long tree asks. An
 * empty or blank query answers null — no filter — rather than a filter that
 * matches everything, so the caller has one test for "is a filter on".
 */
export function filterTree(nodes: readonly GameObjectNode[], query: string): TreeFilter | null {
  const needle = query.trim().toLowerCase();
  if (needle === '') return null;
  const matches = new Set<string>();
  const visible = new Set<string>();

  const walk = (list: readonly GameObjectNode[]): boolean => {
    let any = false;
    for (const node of list) {
      const self = node.name.toLowerCase().includes(needle) || node.type.toLowerCase().includes(needle);
      const below = walk(node.children);
      if (self) matches.add(node.id);
      if (self || below) {
        visible.add(node.id);
        any = true;
      }
    }
    return any;
  };
  walk(nodes);
  return { matches, visible };
}

/** The ids of the groups above `id`, outermost first; empty for a top-level node or one not found. */
export function ancestorIdsOf(nodes: readonly GameObjectNode[], id: string): string[] {
  const path: string[] = [];
  const walk = (list: readonly GameObjectNode[]): boolean => {
    for (const node of list) {
      if (node.id === id) return true;
      path.push(node.id);
      if (walk(node.children)) return true;
      path.pop();
    }
    return false;
  };
  return walk(nodes) ? path : [];
}

/** Every node with children, at any depth — what "Collapse all groups" closes. */
export function groupIdsOf(nodes: readonly GameObjectNode[]): string[] {
  const ids: string[] = [];
  const walk = (list: readonly GameObjectNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        ids.push(node.id);
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return ids;
}

/**
 * Splits a name around every occurrence of the query, for highlighting.
 *
 * The parts join back to the name exactly, so the row's text content is
 * unchanged by a highlight — which is what lets the suite find a row by its
 * name whether or not a filter is on.
 */
export function highlightParts(name: string, query: string): { text: string; hit: boolean }[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return [{ text: name, hit: false }];
  const lower = name.toLowerCase();
  const parts: { text: string; hit: boolean }[] = [];
  let from = 0;
  for (let at = lower.indexOf(needle); at !== -1; at = lower.indexOf(needle, from)) {
    if (at > from) parts.push({ text: name.slice(from, at), hit: false });
    parts.push({ text: name.slice(at, at + needle.length), hit: true });
    from = at + needle.length;
  }
  if (from < name.length) parts.push({ text: name.slice(from), hit: false });
  return parts;
}

/** The window event the `/` shortcut sends: open the Scene panel if it is a sheet, then focus the filter. */
export const FOCUS_TREE_FILTER_EVENT = 'editor:focus-tree-filter';
