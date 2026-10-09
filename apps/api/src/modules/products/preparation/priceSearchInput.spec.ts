import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { config } from '../../../config.ts';
import { priceSearchInput } from './priceSearchInput.ts';

const MAX = config.ai.priceSearch.maxInputChars;

describe('priceSearchInput', () => {
  it('takes the OLX title and the Prom description when each exists on one marketplace only', () => {
    const input = priceSearchInput({
      titleProm: '',
      titleOlx: 'Миша Logitech M185',
      descriptionProm: '<p>Бездротова миша, <strong>майже нова</strong>.</p>',
      descriptionOlx: '',
    });

    assert.deepEqual(input, {
      kind: 'pair',
      title: 'Миша Logitech M185',
      description: 'Бездротова миша, майже нова.',
    });
  });

  it('prefers the Prom title and description over the OLX ones', () => {
    const input = priceSearchInput({
      titleProm: 'Миша Logitech M185 бездротова',
      titleOlx: 'Миша Logitech',
      descriptionProm: '<p>Опис для Prom</p>',
      descriptionOlx: 'Опис для OLX',
    });

    assert.deepEqual(input, {
      kind: 'pair',
      title: 'Миша Logitech M185 бездротова',
      description: 'Опис для Prom',
    });
  });

  it('falls back to the OLX description when the Prom one is only tags', () => {
    const input = priceSearchInput({
      titleProm: 'Миша Logitech M185',
      titleOlx: '',
      descriptionProm: '<p></p><p><br></p>',
      descriptionOlx: 'Бездротова миша, коробка є.',
    });

    assert.deepEqual(input, {
      kind: 'pair',
      title: 'Миша Logitech M185',
      description: 'Бездротова миша, коробка є.',
    });
  });

  it('reports the description as missing when the Prom one is only tags and OLX has none', () => {
    const input = priceSearchInput({
      titleProm: 'Миша Logitech M185',
      titleOlx: '',
      descriptionProm: '<p></p>',
      descriptionOlx: '',
    });

    assert.deepEqual(input, { kind: 'missing', missing: ['description'] });
  });

  it('reports the title as missing when neither marketplace has one beyond spaces', () => {
    const input = priceSearchInput({
      titleProm: '',
      titleOlx: '   ',
      descriptionProm: '<p>Бездротова миша</p>',
      descriptionOlx: '',
    });

    assert.deepEqual(input, { kind: 'missing', missing: ['title'] });
  });

  it('reports both the title and the description when the draft has neither', () => {
    const input = priceSearchInput({
      titleProm: '',
      titleOlx: '',
      descriptionProm: '',
      descriptionOlx: '',
    });

    assert.deepEqual(input, { kind: 'missing', missing: ['title', 'description'] });
  });

  it('cuts the title and the plain-text description to the search input limit', () => {
    const input = priceSearchInput({
      titleProm: 'н'.repeat(MAX + 1),
      titleOlx: '',
      descriptionProm: `<p>${'о'.repeat(MAX + 500)}</p>`,
      descriptionOlx: '',
    });

    assert.deepEqual(input, {
      kind: 'pair',
      title: 'н'.repeat(MAX),
      description: 'о'.repeat(MAX),
    });
  });
});
