import { calculateExportBounds } from '../client/src/lib/exportGeometry';
import type { BookData } from '../client/src/lib/types';

const book = {
  id: 'bounds-fixture',
  title: 'Export Bounds Fixture',
  author: '',
  characters: [
    { id: 'ada', name: 'Ada', x: 100, y: 100, gender: 'female', groupIds: ['inner', 'outer'] },
    { id: 'ben', name: 'Ben', x: 300, y: 200, gender: 'male', groupIds: ['outer'] },
  ],
  relationships: [],
  hubRelationships: [],
  groupRelationships: [],
  groups: [
    { id: 'inner', name: 'Inner', color: '#ff0000', groupType: 'circle' },
    { id: 'outer', name: 'Outer', color: '#00ff00', groupType: 'circle' },
  ],
} as unknown as BookData;

const ids = new Set(['ada', 'ben']);
const bounds = calculateExportBounds(book, ids, new Set(), 14, ['inner', 'outer'], true);

if (bounds.minX > 2 || bounds.minY > -12 || bounds.maxX < 518 || bounds.maxY < 334) {
  throw new Error(`Safe bounds exclude an expanded outer circle: ${JSON.stringify(bounds)}`);
}

const hiddenBounds = calculateExportBounds(book, ids, new Set(['outer']), 14, ['inner', 'outer'], true);
if (hiddenBounds.maxX >= bounds.maxX || hiddenBounds.maxY >= bounds.maxY) {
  throw new Error('Hidden circle still contributes to export bounds.');
}

console.log('Export-bound regression checks passed:', bounds);
