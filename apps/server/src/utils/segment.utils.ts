import { TimeRange } from '../types/types';

export const isValidSegment = (segment: TimeRange): boolean => segment.end > segment.start;

export const calculateTotalDurationSegments = (segments: TimeRange[]): number => segments.reduce((acc, segment) => acc + (segment.end - segment.start), 0);