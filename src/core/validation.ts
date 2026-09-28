import { inspectorSectionFor } from './sections';
import { SCHEMA_VERSION, type GameObjectNode, type Project, type SceneDoc, type ValidationIssue } from './schema';
export type { ValidationIssue } from './schema';

export const blockingIssues = (issues: readonly ValidationIssue[]): ValidationIssue[] =>
  issues.filter((issue) => issue.severity === 'error' && issue.blocksExport);

export class ProjectValidationError extends Error {
  constructor(public readonly issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.code}: ${issue.message}`).join('\n'));
    this.name = 'ProjectValidationError';
  }
}

const SAFE_NAME = /^[A-Za-z_$][A-Za-z0-9_$]*$/;
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * Validates the document exactly as supplied. It never normalises, removes, or
 * writes a value; callers therefore get the same codes for Save, Play and all
 * export formats.
 *
 * **An issue blocks Play and export only when the output would be invalid.**
 * A newer schema, no scenes, a repeated id, a non-finite number and a scene with
 * no size all would be. A dangling reference and a malformed colour would not:
 * the readers already drop a reference that names nothing (`prefabChildrenOf`,
 * `labelOf`, `particleFollowOf` and the rest), and the exporter already repairs
 * a colour through `hexLiteral` and `cssColor`. So those two warn: they are
 * listed and lead to their field, and the game still runs. That is the editor's
 * older rule too, that one unreadable reference must not cost the user the rest
 * of their work.
 */
export function validateProject(project: Project): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (issue: ValidationIssue) => issues.push(issue);
  if (!Number.isInteger(project.schemaVersion) || project.schemaVersion > SCHEMA_VERSION) {
    add({ code: 'schema.unsupported-newer', severity: 'error', message: `Schema version ${project.schemaVersion} is newer than supported version ${SCHEMA_VERSION}.`, fieldPath: 'schemaVersion', blocksExport: true });
  }
  if (!project.name.trim()) add({ code: 'config.project-name-missing', severity: 'warning', message: 'Project name is empty.', fieldPath: 'name', blocksExport: false });
  if (!Array.isArray(project.scenes) || project.scenes.length === 0) add({ code: 'config.scenes-missing', severity: 'error', message: 'The project has no scenes.', fieldPath: 'scenes', blocksExport: true });

  const assets = new Set(project.assets.map((item) => item.id));
  const animations = new Set(project.animations.map((item) => item.id));
  const prefabs = new Set(project.prefabs.map((item) => item.id));
  const variables = new Set(project.variables.map((item) => item.id));
  const duplicateIds = (values: readonly { id: string }[], path: string) => {
    const seen = new Set<string>();
    values.forEach((value, index) => {
      if (seen.has(value.id)) add({ code: 'name.duplicate-id', severity: 'error', message: `Duplicate id "${value.id}".`, fieldPath: `${path}.${index}.id`, blocksExport: true });
      seen.add(value.id);
    });
  };
  duplicateIds(project.assets, 'assets'); duplicateIds(project.animations, 'animations');
  duplicateIds(project.prefabs, 'prefabs'); duplicateIds(project.variables, 'variables');
  duplicateIds(project.scenes, 'scenes');

  const validateNames = (values: readonly { name: string }[], path: string) => {
    const names = new Set<string>();
    values.forEach((value, index) => {
      const name = value.name.trim();
      if (!name) add({ code: 'name.empty', severity: 'warning', message: 'Name is empty.', fieldPath: `${path}.${index}.name`, blocksExport: false });
      else if (!SAFE_NAME.test(name)) add({ code: 'name.unsafe', severity: 'warning', message: `"${value.name}" is not a safe generated-code name.`, fieldPath: `${path}.${index}.name`, blocksExport: false });
      if (names.has(name)) add({ code: 'name.duplicate', severity: 'warning', message: `Name "${value.name}" is duplicated.`, fieldPath: `${path}.${index}.name`, blocksExport: false });
      names.add(name);
    });
  };
  validateNames(project.scenes, 'scenes'); validateNames(project.prefabs, 'prefabs');
  validateNames(project.animations, 'animations'); validateNames(project.variables, 'variables');

  const walk = (nodes: readonly GameObjectNode[], scene: SceneDoc | undefined, base: string) => {
    const nodeIds = new Set<string>();
    const collect = (items: readonly GameObjectNode[], path: string) => items.forEach((node, index) => {
      if (nodeIds.has(node.id)) add({ code: 'name.duplicate-id', severity: 'error', message: `Duplicate object id "${node.id}".`, sceneId: scene?.id, objectId: node.id, fieldPath: `${path}.${index}.id`, blocksExport: true });
      nodeIds.add(node.id);
      if ('children' in node) collect(node.children, `${path}.${index}.children`);
    });
    collect(nodes, base);
    const visit = (items: readonly GameObjectNode[], path: string) => items.forEach((node, index) => {
      const at = `${path}.${index}`;
      const common = { sceneId: scene?.id, objectId: node.id };
      for (const [key, value] of Object.entries(node.transform)) if (typeof value !== 'number' || !Number.isFinite(value)) add({ code: 'value.not-finite', severity: 'error', message: `${key} must be a finite number.`, ...common, fieldPath: `${at}.transform.${key}`, inspectorSection: inspectorSectionFor(node.type, `transform.${key}`), blocksExport: true });
      const props = node.props as unknown as Record<string, unknown>;
      for (const [key, value] of Object.entries(props)) {
        if (typeof value === 'number' && !Number.isFinite(value)) add({ code: 'value.not-finite', severity: 'error', message: `${key} must be a finite number.`, ...common, fieldPath: `${at}.props.${key}`, inspectorSection: inspectorSectionFor(node.type, `props.${key}`), blocksExport: true });
        if ((key === 'fill' || key === 'tint' || key.endsWith('Color')) && typeof value === 'string' && !HEX.test(value)) add({ code: 'value.color-malformed', severity: 'warning', message: `${key} is not a six-digit hex colour; the export uses a default.`, ...common, fieldPath: `${at}.props.${key}`, inspectorSection: inspectorSectionFor(node.type, `props.${key}`), blocksExport: false });
      }
      const ref = (id: unknown, exists: boolean, code: string, field: string, label: string) => { if (typeof id === 'string' && id && !exists) add({ code, severity: 'warning', message: `${label} reference "${id}" is missing; the export ignores it.`, ...common, fieldPath: `${at}.${field}`, inspectorSection: inspectorSectionFor(node.type, field), blocksExport: false }); };
      if ('assetId' in props) ref(props.assetId, assets.has(String(props.assetId)), 'reference.asset-missing', 'props.assetId', 'Asset');
      if ('assetId' in props && props.assetId === null) add({ code: 'config.asset-unset', severity: 'warning', message: 'No image asset is selected.', ...common, fieldPath: `${at}.props.assetId`, inspectorSection: inspectorSectionFor(node.type, 'props.assetId'), blocksExport: false });
      if ('animationId' in props) ref(props.animationId, animations.has(String(props.animationId)), 'reference.animation-missing', 'props.animationId', 'Animation');
      if ('prefabId' in props) ref(props.prefabId, prefabs.has(String(props.prefabId)), 'reference.prefab-missing', 'props.prefabId', 'Prefab');
      if ('followId' in props) ref(props.followId, nodeIds.has(String(props.followId)), 'reference.object-missing', 'props.followId', 'Object');
      if (node.type === 'text' && node.props.label) ref(node.props.label.variableId, variables.has(node.props.label.variableId), 'reference.variable-missing', 'props.label.variableId', 'Variable');
      if ('children' in node) visit(node.children, `${at}.children`);
    });
    visit(nodes, base);
  };
  project.scenes.forEach((scene, index) => {
    walk(scene.children, scene, `scenes.${index}.children`);
    if (!(scene.width > 0) || !(scene.height > 0)) add({ code: 'config.scene-size-invalid', severity: 'error', message: 'Scene width and height must be positive.', sceneId: scene.id, fieldPath: `scenes.${index}`, inspectorSection: 'Scene', blocksExport: true });
    if (!HEX.test(scene.backgroundColor)) add({ code: 'value.color-malformed', severity: 'warning', message: 'Scene background is not a six-digit hex colour; the export uses a default.', sceneId: scene.id, fieldPath: `scenes.${index}.backgroundColor`, inspectorSection: 'Scene', blocksExport: false });
  });
  project.prefabs.forEach((prefab, index) => walk(prefab.children, undefined, `prefabs.${index}.children`));
  return issues;
}

export function assertProjectExportable(project: Project): ValidationIssue[] {
  const issues = validateProject(project);
  const blocking = blockingIssues(issues);
  if (blocking.length) throw new ProjectValidationError(blocking);
  return issues;
}
