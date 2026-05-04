import type { RenderRequest } from '../edit-video/edit-video.types.ts';

// Minimal IDesign types mirroring @designcombo/types
interface IDisplay { from: number; to: number; }
interface ITrim { from: number; to: number; }
interface ISize { width: number; height: number; }

interface ITrackItemBase {
    id: string;
    type: string;
    display: IDisplay;
    trim?: ITrim;
    duration?: number;
    details?: Record<string, unknown>;
    metadata?: Record<string, unknown>;
}

interface ITrack {
    id: string;
    type: string;
    items: string[];
    muted?: boolean;
}

export interface IDesign {
    id: string | number;
    size: ISize;
    duration?: number;
    fps: number;
    tracks: ITrack[];
    trackItemIds: string[];
    trackItemsMap: Record<string, ITrackItemBase>;
}

function parsePx(val: unknown): number {
    if (typeof val === 'number') return val;
    if (typeof val === 'string') return parseFloat(val) || 0;
    return 0;
}

function toPercent(val: unknown, total: number): number {
    const px = parsePx(val);
    return total > 0 ? Math.min(100, Math.max(0, (px / total) * 100)) : 0;
}

export function transformDesignToRenderRequest(design: IDesign, format: 'mp4' = 'mp4'): Omit<RenderRequest, 'jobId'> {
    const { tracks, trackItemsMap, size, duration: designDuration } = design;

    const mainTrack = tracks.find(t => t.type === 'main' || t.type === 'video');
    const audioTracks = tracks.filter(t => t.type === 'audio');
    const overlayTracks = tracks.filter(t => t.type !== 'main' && t.type !== 'video' && t.type !== 'audio' && t.type !== 'helper');

    // Build sources from main track items (sorted by display.from)
    const mainItems = (mainTrack?.items ?? [])
        .map(id => trackItemsMap[id])
        .filter((item): item is ITrackItemBase => item !== undefined)
        .sort((a, b) => a.display.from - b.display.from);

    const sources = mainItems.map(item => {
        const details = item.details ?? {};
        const url = (details['src'] as string | undefined) ?? '';
        const type = item.type === 'image' ? 'image' : 'video';
        const displayDuration = (item.display.to - item.display.from) / 1000;

        const result: RenderRequest['sources'][0] = { url, type, duration: displayDuration };

        if (item.trim !== undefined) {
            result.trimFrom = item.trim.from / 1000;
            result.trimTo = item.trim.to / 1000;
        } else if (type === 'image') {
            // images need explicit duration (already set above)
        }

        return result;
    }).filter(s => s.url);

    const trimEnd = mainItems.reduce((sum, item) => {
        const d = item.trim
            ? (item.trim.to - item.trim.from) / 1000
            : (item.display.to - item.display.from) / 1000;
        return sum + d;
    }, 0) || (designDuration ? designDuration / 1000 : 5);

    // Build overlays from overlay tracks + any text/image items NOT on main track
    const overlays: RenderRequest['overlays'] = [];
    for (const track of overlayTracks) {
        for (const itemId of track.items) {
            const item = trackItemsMap[itemId];
            if (!item) continue;
            const details = item.details ?? {};
            const start = item.display.from / 1000;
            const end = item.display.to / 1000;
            const x = toPercent(details['left'], size.width);
            const y = toPercent(details['top'], size.height);

            if (item.type === 'text') {
                const fontSize = details['fontSize'] as number | undefined;
                const fontColor = details['color'] as string | undefined;
                const backgroundColor = details['backgroundColor'] as string | undefined;
                const opacity = details['opacity'] as number | undefined;
                overlays.push({
                    id: item.id,
                    type: 'text' as const,
                    text: (details['text'] as string | undefined) ?? '',
                    start,
                    end,
                    x,
                    y,
                    ...(fontSize !== undefined && { fontSize }),
                    ...(fontColor !== undefined && { fontColor }),
                    ...(backgroundColor !== undefined && { backgroundColor }),
                    ...(opacity !== undefined && { opacity }),
                });
            } else if (item.type === 'image') {
                const width = details['width'] as number | undefined;
                const height = details['height'] as number | undefined;
                const opacity = details['opacity'] as number | undefined;
                overlays.push({
                    id: item.id,
                    type: 'image' as const,
                    imageUrl: (details['src'] as string | undefined) ?? '',
                    start,
                    end,
                    x,
                    y,
                    ...(width !== undefined && { width }),
                    ...(height !== undefined && { height }),
                    ...(opacity !== undefined && { opacity }),
                });
            }
        }
    }

    // Also pick up text items on the main track (they appear as captions/titles)
    for (const item of mainItems) {
        if (item.type === 'text') {
            const details = item.details ?? {};
            const start = item.display.from / 1000;
            const end = item.display.to / 1000;
            const x = toPercent(details['left'], size.width);
            const y = toPercent(details['top'], size.height);
            const fontSize = details['fontSize'] as number | undefined;
            const fontColor = details['color'] as string | undefined;
            overlays.push({
                id: item.id,
                type: 'text' as const,
                text: (details['text'] as string | undefined) ?? '',
                start,
                end,
                x,
                y,
                ...(fontSize !== undefined && { fontSize }),
                ...(fontColor !== undefined && { fontColor }),
            });
        }
    }

    // Build audio sources
    const audioSources: RenderRequest['audioSources'] = [];
    for (const track of audioTracks) {
        for (const itemId of track.items) {
            const item = trackItemsMap[itemId];
            if (!item) continue;
            const details = item.details ?? {};
            const src = (details['src'] as string | undefined) ?? '';
            if (!src) continue;
            const startTime = item.display.from / 1000;
            const displayDuration = (item.display.to - item.display.from) / 1000;
            const trimDuration = item.trim ? (item.trim.to - item.trim.from) / 1000 : displayDuration;
            const originalDuration = item.duration !== undefined ? item.duration / 1000 : undefined;
            const audioTrimStart = item.trim ? item.trim.from / 1000 : undefined;
            const audioTrimEnd = item.trim ? item.trim.to / 1000 : undefined;
            audioSources.push({
                url: src,
                startTime,
                duration: trimDuration,
                ...(originalDuration !== undefined && { originalDuration }),
                ...(audioTrimStart !== undefined && { audioTrimStart }),
                ...(audioTrimEnd !== undefined && { audioTrimEnd }),
                volume: (details['volume'] as number | undefined) ?? 1,
                muted: (track.muted === true),
                solo: false,
            });
        }
    }

    return {
        sources: sources.length > 0 ? sources : [{ url: '', type: 'video', duration: 5 }],
        trimEnd,
        cuts: [],
        overlays,
        audioSources,
        audioMixMode: 'mix',
        format,
    };
}
