// ============================================================
// Sample data — Pride & Prejudice demo
// Seeded on first load if no data exists
// ============================================================
import type { BookData } from './types';

export const SAMPLE_BOOK: BookData = {
  id: 'sample-pride-prejudice',
  title: 'Pride and Prejudice',
  author: 'Jane Austen',
  series: '',
  description: 'A romantic novel following the Bennet family and their five daughters.',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  groups: [
    { id: 'g-bennet',  name: 'The Bennets',  color: '#c9a84c', description: 'The Bennet family of Longbourn' },
    { id: 'g-darcy',   name: 'The Darcys',   color: '#4cb8c9', description: 'The Darcy family of Pemberley' },
    { id: 'g-bingley', name: 'The Bingleys', color: '#9b6ec9', description: 'Mr Bingley and his circle' },
  ],
  characters: [
    // Bennets
    { id: 'c-elizabeth', name: 'Elizabeth Bennet', title: 'Miss', description: 'The witty, independent second daughter of the Bennets.', gender: 'female', groupIds: ['g-bennet'], status: 'alive', x: 400, y: 260 },
    { id: 'c-jane',      name: 'Jane Bennet',      title: 'Miss', description: 'The eldest and most beautiful Bennet daughter.', gender: 'female', groupIds: ['g-bennet'], status: 'alive', x: 240, y: 160 },
    { id: 'c-lydia',     name: 'Lydia Bennet',     title: 'Miss', description: 'The youngest, flirtatious Bennet daughter.', gender: 'female', groupIds: ['g-bennet'], status: 'alive', x: 560, y: 160 },
    { id: 'c-mr-bennet', name: 'Mr Bennet',         description: 'The sardonic patriarch of the Bennet family.', gender: 'male', groupIds: ['g-bennet'], status: 'alive', x: 300, y: 380 },
    { id: 'c-mrs-bennet',name: 'Mrs Bennet',         description: 'The anxious, husband-hunting matriarch.', gender: 'female', groupIds: ['g-bennet'], status: 'alive', x: 500, y: 380 },
    // Darcys
    { id: 'c-darcy',     name: 'Fitzwilliam Darcy', title: 'Mr', description: 'The proud, wealthy master of Pemberley.', gender: 'male', groupIds: ['g-darcy'], color: '#4cb8c9', status: 'alive', x: 700, y: 260 },
    { id: 'c-georgiana', name: 'Georgiana Darcy',   title: 'Miss', description: "Darcy's shy younger sister.", gender: 'female', groupIds: ['g-darcy'], status: 'alive', x: 820, y: 380 },
    // Bingleys
    { id: 'c-bingley',   name: 'Charles Bingley',   title: 'Mr', description: 'The amiable, wealthy friend of Darcy.', gender: 'male', groupIds: ['g-bingley'], color: '#9b6ec9', status: 'alive', x: 160, y: 260 },
    { id: 'c-caroline',  name: 'Caroline Bingley',  title: 'Miss', description: "Bingley's scheming sister.", gender: 'female', groupIds: ['g-bingley'], status: 'alive', x: 80, y: 380 },
    // Others
    { id: 'c-wickham',   name: 'George Wickham',    title: 'Mr', description: 'The charming but unscrupulous militia officer.', gender: 'male', color: '#c94c4c', status: 'alive', x: 680, y: 100 },
    { id: 'c-collins',   name: 'Mr Collins',         description: "The pompous clergyman and Bennet cousin.", gender: 'male', color: '#8899aa', status: 'alive', x: 400, y: 500 },
  ],
  relationships: [
    // Family
    { id: 'r-mr-mrs-bennet',   sourceId: 'c-mr-bennet',  targetId: 'c-mrs-bennet',  type: 'family',     label: 'married to',  bidirectional: true,  uncertain: false },
    { id: 'r-bennet-elizabeth',sourceId: 'c-mr-bennet',  targetId: 'c-elizabeth',   type: 'family',     label: 'father of',   bidirectional: false, uncertain: false },
    { id: 'r-bennet-jane',     sourceId: 'c-mr-bennet',  targetId: 'c-jane',        type: 'family',     label: 'father of',   bidirectional: false, uncertain: false },
    { id: 'r-bennet-lydia',    sourceId: 'c-mr-bennet',  targetId: 'c-lydia',       type: 'family',     label: 'father of',   bidirectional: false, uncertain: false },
    { id: 'r-darcy-georgiana', sourceId: 'c-darcy',      targetId: 'c-georgiana',   type: 'family',     label: 'brother of',  bidirectional: false, uncertain: false },
    { id: 'r-bingley-caroline',sourceId: 'c-bingley',    targetId: 'c-caroline',    type: 'family',     label: 'brother of',  bidirectional: false, uncertain: false },
    // Romance
    { id: 'r-darcy-elizabeth', sourceId: 'c-darcy',      targetId: 'c-elizabeth',   type: 'romance',    label: 'loves',       bidirectional: true,  uncertain: false },
    { id: 'r-bingley-jane',    sourceId: 'c-bingley',    targetId: 'c-jane',        type: 'romance',    label: 'loves',       bidirectional: true,  uncertain: false },
    { id: 'r-wickham-lydia',   sourceId: 'c-wickham',    targetId: 'c-lydia',       type: 'romance',    label: 'elopes with', bidirectional: false, uncertain: false },
    { id: 'r-collins-elizabeth',sourceId: 'c-collins',   targetId: 'c-elizabeth',   type: 'romance',    label: 'proposes to', bidirectional: false, uncertain: false },
    // Friendship
    { id: 'r-darcy-bingley',   sourceId: 'c-darcy',      targetId: 'c-bingley',     type: 'friendship', label: 'close friends', bidirectional: true, uncertain: false },
    { id: 'r-jane-elizabeth',  sourceId: 'c-jane',       targetId: 'c-elizabeth',   type: 'friendship', label: 'sisters',     bidirectional: true,  uncertain: false },
    // Rivalry / Enemy
    { id: 'r-darcy-wickham',   sourceId: 'c-darcy',      targetId: 'c-wickham',     type: 'rivalry',    label: 'rivals',      bidirectional: true,  uncertain: false },
    { id: 'r-caroline-jane',   sourceId: 'c-caroline',   targetId: 'c-jane',        type: 'rivalry',    label: 'jealous of',  bidirectional: false, uncertain: false },
    // Collins family connection
    { id: 'r-collins-bennet',  sourceId: 'c-collins',    targetId: 'c-mr-bennet',   type: 'family',     label: 'cousin of',   bidirectional: false, uncertain: false },
  ],
  hubRelationships: [],
  convergingRelationships: [],
  familyUnitRelationships: [],
  groupRelationships: [],
  annotations: [],
  groupSequenceOrder: [],
  layoutVariants: [],
  activeLayoutVariantId: null,
};
