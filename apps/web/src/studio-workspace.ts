import{LIMITS,workspaceAssets,WorkspaceSchema}from'@playlist-avatar/contracts';
import type{Recipe,Workspace,TemplateId}from'@playlist-avatar/contracts';
export function validateWorkspace(recipe:Recipe,value:Workspace){const parsed=WorkspaceSchema.parse(value);if(workspaceAssets(recipe,parsed).length>LIMITS.candidates)throw Error('RESPONSE_TOO_LARGE');return parsed;}
export function workspaceFor(recipe:Recipe,origin:Recipe,editingId?:string):Workspace{return{version:1,flow:'quick',variants:{},origins:{[recipe.template]:structuredClone(origin)},editingId};}
export function stashVariant(recipe:Recipe,workspace:Workspace):Workspace{return{...workspace,variants:{...workspace.variants,[recipe.template]:structuredClone(recipe)}};}
export function variantFor(workspace:Workspace,id:TemplateId){return workspace.variants[id]?structuredClone(workspace.variants[id]):undefined;}
