import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cleanDescription } from './cleanDescription.ts';

describe('cleanDescription', () => {
  it('strips the attributes and comments a Google copy-paste brings along', () => {
    const html =
      '<p><strong data-complete="true" data-copy-service-computed-style="font-family: &quot;Google Sans&quot;, Arial" jscontroller="tP2kf#s32ZS" jsuid="HlbjLe_11">Склад комплекту:<!--TgQPHd|||[]--></strong><!--TgQPHd|||[]--></p>';

    assert.equal(cleanDescription(html), '<p><strong>Склад комплекту:</strong></p>');
  });

  it('unwraps span and div but keeps their text', () => {
    assert.equal(
      cleanDescription('<div><span style="color:red">Червоний</span> колір</div>'),
      'Червоний колір',
    );
  });

  it('drops style blocks and images together with what is inside them', () => {
    assert.equal(
      cleanDescription('<style>p { color: red }</style><p>Текст<img src="x.jpg"></p>'),
      '<p>Текст</p>',
    );
  });

  it('removes empty paragraphs, including ones holding only &nbsp; or <br>', () => {
    assert.equal(
      cleanDescription('<p>Перший</p><p>&nbsp;</p><p> </p><p><br></p><p>Другий</p>'),
      '<p>Перший</p><p>Другий</p>',
    );
  });

  it('collapses runs of &nbsp; into one space', () => {
    assert.equal(cleanDescription('<p>Ціна&nbsp;&nbsp;&nbsp; 250</p>'), '<p>Ціна 250</p>');
  });

  it('keeps only href on links', () => {
    assert.equal(
      cleanDescription('<a href="https://example.com" target="_blank" rel="nofollow">тут</a>'),
      '<a href="https://example.com">тут</a>',
    );
  });
});
