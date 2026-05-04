import moment from 'moment';

export const ONE_HOUR_IN_SECONDS = 60 * 60;

export const parseTime = (timeStr: string): number => {
    const [hours, minutes, seconds] = timeStr.trim().split(':').map(Number);
    return (hours ?? 0) * 3600 + (minutes ?? 0) * 60 + (seconds ?? 0);
};

export const formatTimestamp = (seconds: number): string => moment.utc(seconds * 1000).format('HH:mm:ss.SSS');
