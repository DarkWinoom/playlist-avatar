import { z } from 'zod';
export { identifyShare } from './share.ts';
export type { ShareTarget, PublicPlatform } from './share.ts';

export const CONTRACT_VERSION = 1 as const;
export const SOURCE_IDS = ['netease', 'qqmusic', 'local', 'lastfm', 'subsonic', 'jellyfin'] as const;
export type SourceId = typeof SOURCE_IDS[number];
export const TEMPLATE_IDS = ['mosaic', 'sleeve', 'disc', 'wall', 'film', 'riso', 'halftone', 'type',
  'aura', 'orbit', 'pulse', 'terrain', 'chrome', 'prism', 'glass', 'eclipse',
  'duo','focus','contact','strips','ribbon','bloom','mesh','waves'] as const;
export const ERROR_CODES = ['INVALID_INPUT', 'UNSUPPORTED_SOURCE', 'NOT_PUBLIC_OR_UNAVAILABLE', 'INCOMPLETE_SOURCE',
  'UPSTREAM_TIMEOUT', 'RATE_LIMITED', 'IMAGE_UNAVAILABLE', 'RESPONSE_TOO_LARGE', 'CANCELLED',
  'UNCONFIGURED_SOURCE', 'CONNECTION_REQUIRED', 'INVALID_IMAGE', 'UNSUPPORTED_FORMAT', 'INVALID_PACKAGE', 'INTERNAL_ERROR'] as const;
export const LIMITS = Object.freeze({ shareBytes: 2048, requestBytes: 32768, upstreamBytes: 8388608,
  metadata: 2000, candidates: 50, selected: 16, resolves: 2, queue: 8, images: 4,
  requestMs: 10000, deadlineMs: 30000, redirects: 3, remoteImageBytes: 8388608, remotePixels: 16000000,
  localImageBytes: 20971520, localPixels: 24000000, history: 50, bitmapBytes: 67108864,
  candidateBytes: 67108864, projectBytes: 524288000, packageBytes: 201326592,
  expandedPackageBytes: 268435456, packageEntries: 128, manifestBytes: 1048576 });

export const SourceSchema = z.enum(SOURCE_IDS);
export const TemplateSchema = z.enum(TEMPLATE_IDS);
export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type TemplateId = z.infer<typeof TemplateSchema>;
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;
const key = z.string().min(1).max(512);
const text = z.string().max(1024);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const date = z.iso.datetime();
export const ColorSchema = z.string().regex(/^#[\da-fA-F]{6}$/);

export function sourceNamespace(source: SourceId, connectionId?: string) {
  SourceSchema.parse(source);
  if (connectionId === undefined) return `${source}:public:`;
  if (!connectionId || connectionId.length > 128) throw new Error('Invalid connection namespace');
  return `${source}:connection:${encodeURIComponent(connectionId)}:`;
}
export function sourceKey(source: SourceId, connectionId: string | undefined, kind: string, id: string, order?: number) {
  const value = `${sourceNamespace(source, connectionId)}${encodeURIComponent(kind)}:${encodeURIComponent(id)}${order === undefined ? '' : `:${order}`}`;
  return key.parse(value);
}
function matchesSourceKey(actual: string, ...parts: Parameters<typeof sourceKey>) {
  try { return actual === sourceKey(...parts); } catch { return false; }
}

export const CoverageSchema = z.object({
  received: count, scanned: count.max(LIMITS.metadata).optional(), offset: count.default(0), reportedTotal: count.optional(), knownTotal: count.optional(), complete: z.boolean(),
  limitReason: z.enum(['budget', 'upstream', 'missing-details', 'unknown-total']).optional(),
}).refine(value => value.scanned===undefined||value.scanned>=value.received,{message:'Scanned range is smaller than returned items'}).refine(value => value.knownTotal === undefined || value.offset + (value.scanned??value.received) <= value.knownTotal,
  { message: 'Received count exceeds verified total' }).refine(value => !value.complete || (!value.limitReason
    && value.offset === 0 && value.knownTotal !== undefined && value.received === value.knownTotal), { message: 'Unverified coverage marked complete' });
export type Coverage = z.infer<typeof CoverageSchema>;

export const StatisticsSchema = z.object({ playCount: count.optional(), occurrenceCount: count.optional(),
  rankScore: z.number().finite().optional(), lastPlayedAt: date.optional(), eventAt: date.optional() });
export const ArtworkReferenceSchema = z.object({ key, href: z.string().regex(/^\/api\/v1\/artwork\/[a-zA-Z0-9_-]+$/) });
export const TrackSchema = z.object({ key, source: SourceSchema, sourceId: key,
  kind: z.enum(['track', 'album', 'event']).default('track'), title: text,
  artists: z.array(text).max(32), albumId: text.optional(), album: text.optional(), order: count,
  artwork: ArtworkReferenceSchema.optional(), statistics: StatisticsSchema.optional() });
export type Track = z.infer<typeof TrackSchema>;

export const SourceSnapshotSchema = z.object({ key, source: SourceSchema, collectionId: text, title: text,
  kind: z.enum(['playlist', 'top-albums', 'recent-tracks', 'recent-albums', 'frequent-albums', 'local']),
  fetchedAt: date, connectionId: key.max(128).optional(), period: z.enum(['7day', '1month', '3month', '6month', '12month', 'overall']).optional(),
  from: date.optional(), to: date.optional(), coverage: CoverageSchema, warnings: z.array(ErrorCodeSchema).max(32).default([]) });
export type SourceSnapshot = z.infer<typeof SourceSnapshotSchema>;
export const CollectionSchema = z.object({ version: z.literal(CONTRACT_VERSION), snapshot: SourceSnapshotSchema,
  tracks: z.array(TrackSchema).max(LIMITS.metadata) }).refine(value => value.tracks.length === value.snapshot.coverage.received,
  { message: 'Coverage does not match returned items' }).refine(value => value.tracks.every(track => track.source === value.snapshot.source),
  { message: 'Source namespace mismatch' }).refine(value => new Set(value.tracks.map(track => track.key)).size === value.tracks.length,
  { message: 'Repeated entry keys' }).refine(value => matchesSourceKey(value.snapshot.key, value.snapshot.source, value.snapshot.connectionId, 'collection', value.snapshot.collectionId),
  { message: 'Collection namespace mismatch' }).refine(value => value.tracks.every(track => matchesSourceKey(track.key, track.source,
    value.snapshot.connectionId, track.kind, track.sourceId, track.order)), { message: 'Entry namespace mismatch' })
  .refine(value => {
    try { return value.tracks.every(track => !track.artwork || track.artwork.key.startsWith(sourceNamespace(track.source, value.snapshot.connectionId))); }
    catch { return false; }
  }, { message: 'Artwork namespace mismatch' });
export type Collection = z.infer<typeof CollectionSchema>;

export const ResolveInputSchema = z.object({ input: z.string().min(1).refine(value => new TextEncoder().encode(value).length <= LIMITS.shareBytes),
  source: z.enum(['netease', 'qqmusic']).optional(), offset: count.default(0) });
export type ResolveInput = z.infer<typeof ResolveInputSchema>;
export const LastfmInputSchema=z.object({username:z.string().regex(/^[\w-]{1,64}$/),kind:z.enum(['top-albums','recent-tracks']),period:z.enum(['7day','1month','3month','6month','12month','overall']).default('1month')}).strict();
export const ConnectInputSchema=z.object({profileId:z.string().regex(/^[\w-]{1,64}$/),username:z.string().min(1).max(128),password:z.string().max(1024),cookie:z.string().max(8192).optional()}).strict();
export const AdvancedInputSchema=z.object({kind:z.enum(['playlist','recent-albums','frequent-albums']),collectionId:z.string().max(128).optional(),offset:count.default(0)}).strict();
const parameter = z.union([z.number().finite(), z.boolean(), z.string().max(128)]);
export const ImageFrameSchema=z.object({x:z.number().finite().min(-1).max(1),y:z.number().finite().min(-1).max(1),zoom:z.number().finite().min(1).max(2)});
export type ImageFrame=z.infer<typeof ImageFrameSchema>;
export const SLOT_IDS=Array.from({length:LIMITS.selected},(_,i)=>`slot:${i}`);
export const RecipeSchema = z.object({ version: z.literal(1), template: TemplateSchema, templateVersion: z.literal(1),
  assetIds: z.array(key).max(LIMITS.selected).refine(ids => new Set(ids).size === ids.length), parameters: z.partialRecord(TemplateSchema, z.record(z.string().max(32), parameter)),
  materialIds:z.array(key).max(LIMITS.candidates).refine(ids=>new Set(ids).size===ids.length).optional(),imageFrames:z.record(key,ImageFrameSchema).refine(value=>Object.keys(value).length<=LIMITS.candidates).optional(),
  slotImages:z.record(key,key).refine(value=>Object.keys(value).every(id=>SLOT_IDS.includes(id))).optional(),
  slotCount:z.number().int().min(1).max(LIMITS.selected).optional(),
  seed: z.number().int().min(0).max(4294967295), palette: z.array(ColorSchema).min(1).max(8), paletteLocked: z.boolean(),
  title: z.string().max(120), titleEnabled: z.boolean(), materialPhase: z.number().finite().min(0).max(1),weightMode:z.enum(['equal','occurrences','plays']).default('equal'),assetStats:z.record(key,StatisticsSchema).refine(value=>Object.keys(value).length<=LIMITS.selected).default({}),sourceOrder:z.array(key).max(LIMITS.selected).default([]),sourceRanks:z.record(key,count).refine(value=>Object.keys(value).length<=LIMITS.selected).default({}) })
  .refine(value=>value.slotImages===undefined||(value.assetIds.length===LIMITS.selected&&value.assetIds.every(id=>SLOT_IDS.includes(id))),{message:'Invalid canvas slots'})
  .refine(value=>new Set([...(value.slotImages===undefined?value.assetIds:Object.values(value.slotImages)),...value.materialIds||[]]).size<=LIMITS.candidates,{message:'Material pool exceeds budget'});
export type Recipe = z.infer<typeof RecipeSchema>;
export function recipeAssets(recipe:Recipe){return [...new Set([...(recipe.slotImages===undefined?recipe.assetIds:Object.values(recipe.slotImages)),...recipe.materialIds||[]])];}
export function slotAsset(recipe:Recipe,id:string){return recipe.slotImages===undefined?id:recipe.slotImages[id];}
export const WorkspaceSchema=z.object({version:z.literal(1),flow:z.enum(['quick','legacy']),editingId:key.optional(),
  variants:z.partialRecord(TemplateSchema,RecipeSchema),origins:z.partialRecord(TemplateSchema,RecipeSchema)}).strict();
export type Workspace=z.infer<typeof WorkspaceSchema>;
export function workspaceAssets(recipe:Recipe,workspace?:Workspace){return [...new Set([recipe,...Object.values(workspace?.variants||{}),...Object.values(workspace?.origins||{})].flatMap(value=>value?recipeAssets(value):[]))];}
export const AssetMetadataSchema = z.object({ id: key, fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
  width: count.min(1).max(8192), height: count.min(1).max(8192), bytes: count,
  colors: z.array(ColorSchema).max(8), sourceKey: key.optional(), label: z.string().max(200), createdAt: date,order:count.optional(),statistics:StatisticsSchema.optional(),isSample:z.boolean().optional() });
export type AssetMetadata = z.infer<typeof AssetMetadataSchema>;
export interface ArtworkAsset extends AssetMetadata { blob: Blob; thumbnail: Blob }
export const ProjectSchema = z.object({ version: z.literal(1), id: key, name: z.string().min(1).max(120),
  createdAt: date, updatedAt: date, recipe: RecipeSchema, snapshot: SourceSnapshotSchema.optional(),workspace:WorkspaceSchema.optional() })
  .refine(value=>workspaceAssets(value.recipe,value.workspace).length<=LIMITS.candidates,{message:'Workspace material pool exceeds budget'});
export type Project = z.infer<typeof ProjectSchema>;
export function projectAssets(project:Project){return workspaceAssets(project.recipe,project.workspace);}
export interface StoredProject extends Project { thumbnail?: Blob }
export const PackageManifestSchema=z.object({format:z.literal('playlist-avatar'),version:z.union([z.literal(0),z.literal(1)]),project:z.unknown(),
  assets:z.array(AssetMetadataSchema.extend({image:z.string(),thumbnail:z.string()}).strict()).max(LIMITS.candidates)}).strict();

export const ConnectionProfileSchema = z.object({ id: key, kind: z.enum(['subsonic', 'jellyfin', 'netease-api', 'qq-api']),
  name: z.string().min(1).max(120), implementation: z.string().max(128), address: z.string().max(2048).refine(value => {
    try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password && !url.search && !url.hash; }
    catch { return false; }
  }, { message: 'Invalid service address' }),
  credentialStorage: z.enum(['session', 'persistent']).default('session') });
export type ConnectionProfile = z.infer<typeof ConnectionProfileSchema>;
export const CapabilitiesSchema = z.object({ version: z.literal(CONTRACT_VERSION),
  limits: z.object({ metadata: count, candidates: count, selected: count }),
  sources: z.array(z.object({ id: SourceSchema, state: z.enum(['available', 'unconfigured', 'disabled', 'unsupported']) })).max(6),
  profiles: z.array(z.object({ id: key, kind: z.enum(['subsonic', 'jellyfin', 'netease-api', 'qq-api']), name: text,implementation:z.string().max(128).optional() })).max(16) });
export type Capabilities = z.infer<typeof CapabilitiesSchema>;
export const ApiErrorSchema = z.object({ version: z.literal(CONTRACT_VERSION), error: z.object({
  code: ErrorCodeSchema, retryable: z.boolean(), retryAfterMs: count.optional() }) });
export type ApiError = z.infer<typeof ApiErrorSchema>;
export interface ExportOptions { format: 'image/png' | 'image/jpeg' | 'image/webp'; size: 512 | 1024 | 2048;
  transparent: boolean; circle: boolean; background: string; quality: number }
