import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { draftPlainText } from './draftPlainText.ts';

describe('draftPlainText', () => {
  it('puts paragraphs and list items on lines of their own and turns &amp; into & (AC-65)', () => {
    assert.equal(
      draftPlainText(
        '<p>Миша &amp; килимок</p><ul><li>Кабель USB-C</li><li>Коробка</li></ul><p>Стан відмінний.</p>',
      ),
      'Миша & килимок\n\n• Кабель USB-C\n• Коробка\n\nСтан відмінний.',
    );
  });

  it('ends a paragraph with a blank line and keeps a <br> as a line break (Checklist 1)', () => {
    assert.equal(
      draftPlainText('<p>Перший абзац</p><p>Рядок один<br>рядок два<br />рядок три</p>'),
      'Перший абзац\n\nРядок один\nрядок два\nрядок три',
    );
  });

  it('turns items of a numbered list into bulleted lines (Checklist 1)', () => {
    assert.equal(draftPlainText('<ol>\n<li>Книга</li>\n<li>Зошит</li>\n</ol>'), '• Книга\n• Зошит');
  });

  it('drops nested inline tags and keeps their text (Checklist 1)', () => {
    assert.equal(
      draftPlainText(
        '<p><strong>Склад: <em>миша</em></strong>, <a href="https://example.com">інструкція</a></p>',
      ),
      'Склад: миша, інструкція',
    );
  });

  it('gives characters back instead of &amp;, &nbsp; and &lt; (Checklist 1)', () => {
    assert.equal(
      draftPlainText('<p>Миша &amp; килимок, 3&nbsp;шт, вага &lt; 100 г</p>'),
      'Миша & килимок, 3 шт, вага < 100 г',
    );
  });

  it('keeps a list item on one line when Tiptap wraps its text in a paragraph', () => {
    assert.equal(
      draftPlainText('<p>Комплект:</p><ul><li><p>Кабель</p></li><li><p>Коробка</p></li></ul>'),
      'Комплект:\n\n• Кабель\n• Коробка',
    );
  });

  it('leaves at most one blank line where the editor kept empty paragraphs', () => {
    assert.equal(
      draftPlainText('<p>Перший</p><p></p><p><br></p><p>Другий</p>'),
      'Перший\n\nДругий',
    );
  });

  it('drops script and style together with their content', () => {
    assert.equal(
      draftPlainText('<p>Миша</p><script>alert(1)</script><style>p { color: red }</style>'),
      'Миша',
    );
  });

  it('gives quotes back and reads a > inside an attribute as part of the tag', () => {
    assert.equal(
      draftPlainText('<p title="a > b">Модель &quot;M1&quot;, кит&#39;</p>'),
      'Модель "M1", кит\'',
    );
  });

  it('passes plain text through unchanged, apart from the spaces at its edges (Checklist 1)', () => {
    assert.equal(
      draftPlainText('  Продаю мишу, майже нова.\nКоробка є.  '),
      'Продаю мишу, майже нова.\nКоробка є.',
    );
  });
});
