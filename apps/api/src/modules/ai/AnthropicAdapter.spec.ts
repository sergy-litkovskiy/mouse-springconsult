import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import sharp from 'sharp';
import { config } from '../../config.ts';
import {
  AnthropicAdapter,
  type FieldRewriteResult,
  type ModelContentBlock,
  type PriceResult,
  type TextsResult,
} from './AnthropicAdapter.ts';

const USAGE = { model: 'claude-sonnet-5', inputTokens: 100, outputTokens: 20 };

/** A real, decodable JPEG well above the optimization ceiling — sharp cannot process signature bytes. */
async function bigFrame(width = 3000, height = 2000): Promise<Uint8Array> {
  const buffer = await sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 40, b: 200 } },
  })
    .jpeg({ quality: 95 })
    .toBuffer();
  return new Uint8Array(buffer);
}

function imageBlocks(
  content: readonly ModelContentBlock[] | undefined,
): Extract<ModelContentBlock, { type: 'image' }>[] {
  assert.ok(content, 'expected the request content to have been recorded');
  return content.filter(
    (block): block is Extract<ModelContentBlock, { type: 'image' }> => block.type === 'image',
  );
}

function textOf(content: readonly ModelContentBlock[] | undefined): string {
  assert.ok(content, 'expected the request content to have been recorded');
  const block = content.find(
    (entry): entry is Extract<ModelContentBlock, { type: 'text' }> => entry.type === 'text',
  );
  assert.ok(block, 'expected a text block in the request content');
  return block.text;
}

/** Never talks to Anthropic: every method that would reach the SDK client is overridden. */
class RecordingAnthropicAdapter extends AnthropicAdapter {
  lastTextsContent: readonly ModelContentBlock[] | undefined;
  lastPriceContent: readonly ModelContentBlock[] | undefined;
  lastFieldContent: readonly ModelContentBlock[] | undefined;

  constructor() {
    super('test-key');
  }

  override async requestTexts(content: readonly ModelContentBlock[]) {
    this.lastTextsContent = content;
    return {
      value: {
        recognizedItem: 'вʼязана пов’язка на голову',
        descriptionProm: 'Опис для Prom.',
        descriptionOlx: 'Опис для OLX.',
        seoKeywords: ['пов’язка', 'вʼязана'],
      },
      usage: USAGE,
    };
  }

  override async requestPrice(content: readonly ModelContentBlock[]) {
    this.lastPriceContent = content;
    return {
      value: { priceFrom: '200.00', priceTo: '350.00', sources: ['https://example.com/item'] },
      usage: USAGE,
    };
  }

  override async requestFieldRewrite(content: readonly ModelContentBlock[]) {
    this.lastFieldContent = content;
    return { value: { value: 'Новий варіант.' }, usage: USAGE };
  }
}

describe('frame optimization', () => {
  it('shrinks a frame before sending it to the model (Checklist 5, DoD)', async () => {
    const adapter = new RecordingAnthropicAdapter();
    const original = await bigFrame();

    await adapter.generateTexts([original]);

    const blocks = imageBlocks(adapter.lastTextsContent);
    assert.equal(blocks.length, 1);
    const source = blocks[0]?.source;
    assert.ok(source?.type === 'base64');
    const optimizedBytes = Buffer.from(source.data, 'base64');
    assert.ok(
      optimizedBytes.byteLength < original.byteLength,
      `optimized frame (${String(optimizedBytes.byteLength)} B) is not smaller than the original (${String(original.byteLength)} B)`,
    );

    const metadata = await sharp(optimizedBytes).metadata();
    assert.ok(metadata.width <= config.ai.frameOptimization.maxDimensionPx);
    assert.ok(metadata.height <= config.ai.frameOptimization.maxDimensionPx);
  });

  it('leaves a frame already under the ceiling essentially as-is in size', async () => {
    const adapter = new RecordingAnthropicAdapter();
    const small = await bigFrame(200, 150);

    await adapter.generateTexts([small]);

    const metadata = await sharp(small).metadata();
    assert.equal(metadata.width, 200);
  });
});

describe('frame limit', () => {
  it('sends at most three frames per request even when the card has ten (DoD)', async () => {
    const adapter = new RecordingAnthropicAdapter();
    const frames = await Promise.all(Array.from({ length: 10 }, () => bigFrame(64, 64)));

    await adapter.generateTexts(frames);

    assert.equal(imageBlocks(adapter.lastTextsContent).length, config.ai.maxFramesPerRequest);
    assert.equal(config.ai.maxFramesPerRequest, 3);
  });
});

describe('generateTexts', () => {
  it('returns the recognized item alongside both listings and usage (AC-08, ADR 0014)', async () => {
    const adapter = new RecordingAnthropicAdapter();

    const result: TextsResult = await adapter.generateTexts([await bigFrame(64, 64)]);

    assert.deepEqual(result, {
      recognizedItem: 'вʼязана пов’язка на голову',
      descriptionProm: 'Опис для Prom.',
      descriptionOlx: 'Опис для OLX.',
      seoKeywords: ['пов’язка', 'вʼязана'],
      usage: USAGE,
    });
  });

  it('asks for plain text, not Markdown or emoji (ai/CLAUDE.md)', async () => {
    const adapter = new RecordingAnthropicAdapter();

    await adapter.generateTexts([await bigFrame(64, 64)]);

    const prompt = textOf(adapter.lastTextsContent);
    assert.match(prompt, /plain text/i);
    assert.match(prompt, /no markdown/i);
  });
});

describe('findPriceRange', () => {
  it('sends the composed query as-is and returns the range with usage (AC-08)', async () => {
    const adapter = new RecordingAnthropicAdapter();

    const result: PriceResult = await adapter.findPriceRange('вʼязана повʼязка Zara');

    assert.equal(textOf(adapter.lastPriceContent).includes('вʼязана повʼязка Zara'), true);
    assert.deepEqual(result, {
      priceFrom: '200.00',
      priceTo: '350.00',
      sources: ['https://example.com/item'],
      usage: USAGE,
    });
  });
});

describe('rewriteField', () => {
  it('sends the draft text and returns a single string for a title field (ADR 0015)', async () => {
    const adapter = new RecordingAnthropicAdapter();

    const result: FieldRewriteResult = await adapter.rewriteField('titleProm', 'стара чернетка');

    assert.equal(textOf(adapter.lastFieldContent).includes('стара чернетка'), true);
    assert.equal(result.value, 'Новий варіант.');
    assert.deepEqual(result.usage, USAGE);
  });

  it('asks for a keyword list, not a sentence, when the field is seoKeywords (ADR 0015)', async () => {
    const adapter = new RecordingAnthropicAdapter();

    await adapter.rewriteField('seoKeywords', 'слово1, слово2');

    assert.match(textOf(adapter.lastFieldContent), /list of keywords/i);
  });
});
