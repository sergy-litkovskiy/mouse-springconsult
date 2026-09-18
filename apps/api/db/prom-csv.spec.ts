import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cleanDescription,
  parsePromExport,
  splitImageUrls,
  splitKeywords,
  toCondition,
  toPlainText,
} from './prom-csv.ts';

/** A cut-down export: the columns the mapping reads, plus two characteristics. */
const HEADER = [
  'Назва_позиції_укр',
  'Пошукові_запити_укр',
  'Опис_укр',
  'Ціна',
  'Посилання_зображення',
  'Наявність',
  'Назва_групи',
  'Унікальний_ідентифікатор',
  'Назва_Характеристики',
  'Одиниця_виміру_Характеристики',
  'Значення_Характеристики',
  'Назва_Характеристики',
  'Одиниця_виміру_Характеристики',
  'Значення_Характеристики',
];

function csvOf(rows: readonly (readonly string[])[]): string {
  const quote = (value: string): string => `"${value.replaceAll('"', '""')}"`;
  return [HEADER, ...rows].map((row) => row.map(quote).join(',')).join('\n');
}

function row(overrides: Partial<Record<string, string>> = {}): string[] {
  const values: Record<string, string> = {
    title: 'Книга «100 притч»',
    keywords: 'мудра книга, притчі, , мудра книга',
    description: '<p>Опис</p>',
    price: '250',
    images: 'https://images.prom.ua/1_a.jpg, https://images.prom.ua/2_a.jpg',
    availability: '!',
    category: 'Книги',
    promId: '1519870367',
    firstName: 'Автор',
    firstValue: 'Олена Літковська',
    secondName: 'Стан',
    secondValue: 'Новий',
    ...overrides,
  };
  return [
    values['title'] ?? '',
    values['keywords'] ?? '',
    values['description'] ?? '',
    values['price'] ?? '',
    values['images'] ?? '',
    values['availability'] ?? '',
    values['category'] ?? '',
    values['promId'] ?? '',
    values['firstName'] ?? '',
    '',
    values['firstValue'] ?? '',
    values['secondName'] ?? '',
    '',
    values['secondValue'] ?? '',
  ];
}

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

describe('toPlainText', () => {
  it('ends a paragraph with a blank line and keeps a <br> as a line break', () => {
    assert.equal(
      toPlainText('<p>Перший абзац</p><p>Рядок один<br />рядок два</p>'),
      'Перший абзац\n\nРядок один\nрядок два',
    );
  });

  it('turns list items into bulleted lines and drops the inline markup', () => {
    assert.equal(
      toPlainText(
        '<p><strong>Склад комплекту:</strong></p>\n<ol>\n<li>Книга</li>\n<li><em>Зошит</em></li>\n</ol>',
      ),
      'Склад комплекту:\n\n• Книга\n• Зошит',
    );
  });

  it('keeps the text of a link without its address', () => {
    assert.equal(
      toPlainText('<p>Дивіться <a href="https://example.com">тут</a></p>'),
      'Дивіться тут',
    );
  });

  it('gives characters back instead of entities', () => {
    assert.equal(
      toPlainText('<p>&quot;100 притч&quot; &amp; щоденник, 3 &lt; 5&nbsp;грн</p>'),
      '"100 притч" & щоденник, 3 < 5 грн',
    );
  });
});

describe('toCondition', () => {
  it('reads Новий, Новое and Негашене as new', () => {
    assert.equal(toCondition('Новий'), 'new');
    assert.equal(toCondition('Новое'), 'new');
    assert.equal(toCondition(' Негашене '), 'new');
  });

  it('reads anything else, or nothing, as used', () => {
    assert.equal(toCondition('Вживаний'), 'used');
    assert.equal(toCondition('Гашене'), 'used');
    assert.equal(toCondition(undefined), 'used');
  });
});

describe('splitKeywords', () => {
  it('trims, drops empty ones and duplicates, keeping the first order', () => {
    assert.deepEqual(splitKeywords(' мудра книга, притчі, , мудра книга,100 притч '), [
      'мудра книга',
      'притчі',
      '100 притч',
    ]);
  });

  it('gives an empty list for an empty cell', () => {
    assert.deepEqual(splitKeywords(''), []);
  });
});

describe('splitImageUrls', () => {
  it('splits the comma-separated list in order', () => {
    assert.deepEqual(
      splitImageUrls('https://images.prom.ua/1_a.jpg, https://images.prom.ua/2_a.jpg'),
      ['https://images.prom.ua/1_a.jpg', 'https://images.prom.ua/2_a.jpg'],
    );
  });
});

describe('parsePromExport', () => {
  it('maps a row onto a card published on Prom only', () => {
    const { cards, outOfStock, errors } = parsePromExport(csvOf([row()]));

    assert.equal(outOfStock, 0);
    assert.deepEqual(errors, []);
    assert.deepEqual(cards, [
      {
        draft: {
          promId: '1519870367',
          titleProm: 'Книга «100 притч»',
          titleOlx: 'Книга «100 притч»',
          descriptionProm: '<p>Опис</p>',
          descriptionOlx: 'Опис',
          price: '250',
          seoKeywords: ['мудра книга', 'притчі'],
          category: 'Книги',
          condition: 'new',
          publishedProm: true,
          publishedOlx: false,
          olxId: null,
        },
        imageUrls: ['https://images.prom.ua/1_a.jpg', 'https://images.prom.ua/2_a.jpg'],
      },
    ]);
  });

  it('leaves out rows marked - and counts them', () => {
    const { cards, outOfStock } = parsePromExport(
      csvOf([row({ promId: '1' }), row({ promId: '2', availability: '-' })]),
    );

    assert.deepEqual(
      cards.map((card) => card.draft.promId),
      ['1'],
    );
    assert.equal(outOfStock, 1);
  });

  it('takes the condition from whichever characteristic column holds Стан', () => {
    const { cards } = parsePromExport(
      csvOf([
        row({ firstName: 'Стан', firstValue: 'Новий', secondName: 'Автор', secondValue: 'X' }),
      ]),
    );

    assert.equal(cards[0]?.draft.condition, 'new');
  });

  it('treats a card without Стан as used', () => {
    const { cards } = parsePromExport(csvOf([row({ secondName: '', secondValue: '' })]));

    assert.equal(cards[0]?.draft.condition, 'used');
  });

  it('keeps a multi-line quoted description whole', () => {
    const { cards } = parsePromExport(
      csvOf([row({ description: '<p>Перший,</p>\n<p>"Другий"</p>' })]),
    );

    assert.equal(cards[0]?.draft.descriptionProm, '<p>Перший,</p>\n<p>"Другий"</p>');
  });

  it('reports a row with a price that is not a decimal and goes on', () => {
    const { cards, errors } = parsePromExport(
      csvOf([row({ promId: '1', price: '250,5' }), row({ promId: '2' })]),
    );

    assert.deepEqual(
      cards.map((card) => card.draft.promId),
      ['2'],
    );
    assert.deepEqual(errors, [{ row: 2, promId: '1', reason: 'price "250,5" is not a decimal' }]);
  });
});
