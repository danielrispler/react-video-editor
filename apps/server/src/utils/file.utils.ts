import fs from 'node:fs';
import { promises as fsp } from 'node:fs';
import https from 'node:https';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';

export async function createTempDir(prefix: string = 'render-'): Promise<string> {
    const tempDir = path.join(os.tmpdir(), `${prefix}${Date.now()}`);
    await fsp.mkdir(tempDir, { recursive: true });
    return tempDir;
}

export const downloadFile = (url: string, outputPath: string, timeoutMs: number = 300000): Promise<void> => {
    return new Promise((resolve, reject) => {
        const protocol = url.startsWith('https') ? https : http;
        const file = fs.createWriteStream(outputPath);

        const timeoutId = setTimeout(() => {
            file.close();
            fs.unlink(outputPath, () => { });
            reject(new Error(`Download timeout after ${timeoutMs}ms: ${url}`));
        }, timeoutMs);

        const cleanup = (): void => {
            clearTimeout(timeoutId);
        };

        protocol.get(url, response => {
            if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                cleanup();
                file.close();
                fs.unlink(outputPath, () => { });
                return downloadFile(response.headers.location, outputPath, timeoutMs).then(resolve).catch(reject);
            }

            if (!response.statusCode || (response.statusCode !== 200 && response.statusCode < 300)) {
                cleanup();
                file.close();
                fs.unlink(outputPath, () => { });
                reject(new Error(`Failed to download ${url}: ${response.statusCode || 'unknown'}`));
                return;
            }

            response.pipe(file);
            file.on('finish', () => {
                cleanup();
                file.close();
                resolve();
            });
            file.on('error', err => {
                cleanup();
                file.close();
                fs.unlink(outputPath, () => { });
                reject(err);
            });
        }).on('error', err => {
            cleanup();
            file.close();
            fs.unlink(outputPath, () => { });
            reject(err);
        });
    });
};
