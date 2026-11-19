import fs from 'fs';
import path from 'path';

import { MODAL_ORIENTATIONS } from '../modalOrientations';

// TestFlight build 83 crashed (SIGABRT in UIViewController __supportedInterfaceOrientations) when a <Modal> was
// presented while the call screen had turned the app sideways: React Native's Modal is portrait-only by default.
// Every <Modal> of the app therefore has to say which orientations it supports.

const ROOT = path.resolve(__dirname, '../../..');

function sourceFiles(dir: string): string[] {
    return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return entry.name === '__tests__' || entry.name === 'node_modules' ? [] : sourceFiles(full);
        return /\.tsx$/.test(entry.name) ? [full] : [];
    });
}

describe('Modal orientations', () => {
    it('allows portrait and landscape', () => {
        expect(MODAL_ORIENTATIONS).toEqual(expect.arrayContaining(['portrait', 'landscape-left', 'landscape-right']));
    });

    it('is set on every <Modal> of the app', () => {
        const offenders: string[] = [];
        for (const file of [...sourceFiles(path.join(ROOT, 'app')), ...sourceFiles(path.join(ROOT, 'components'))]) {
            const text = fs.readFileSync(file, 'utf8');
            for (const match of text.matchAll(/<Modal(?=[\s>])([\s\S]*?)>/g)) {
                // the attributes of the tag, up to its first closing ">" that is not an arrow "=>"
                const tag = text.slice(match.index!, match.index! + 800);
                const end = tag.search(/[^=]>/);
                const attributes = end >= 0 ? tag.slice(0, end + 2) : tag;
                if (!attributes.includes('supportedOrientations')) offenders.push(path.relative(ROOT, file));
            }
        }
        expect(offenders).toEqual([]);
    });
});
