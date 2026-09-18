import { promDescriptionCleanup } from './prom-description-cleanup';

/** ADR 0016 №4: the same rows and describe name as the server cleanup (T47), byte for byte. */
describe('Prom description cleanup: shared examples', () => {
  it('unwraps foreign markup and drops an empty paragraph (AC-48)', () => {
    expect(
      promDescriptionCleanup(
        '<div><span style="color:red">Червоний</span> колір</div><p>&nbsp;</p>',
      ),
    ).toBe('Червоний колір');
  });

  it('keeps the allowed structure, renaming b and i to strong and em (AC-48)', () => {
    expect(promDescriptionCleanup('<p><b>Жирний</b> і <i>курсив</i></p>')).toBe(
      '<p><strong>Жирний</strong> і <em>курсив</em></p>',
    );
    expect(promDescriptionCleanup('<ul><li>Пункт</li></ul>')).toBe('<ul><li>Пункт</li></ul>');
  });

  it('writes a line break the way the browser serializes it (AC-48)', () => {
    expect(promDescriptionCleanup('<p>a<br/>b</p>')).toBe('<p>a<br>b</p>');
  });

  it('drops a script together with its content (AC-48)', () => {
    expect(promDescriptionCleanup('<script>alert(1)</script><p>Текст</p>')).toBe('<p>Текст</p>');
  });

  it('drops an image together with its onerror handler (AC-48)', () => {
    expect(promDescriptionCleanup('<img src=x onerror="alert(1)"><p>Текст</p>')).toBe(
      '<p>Текст</p>',
    );
  });

  it('drops a javascript: href and keeps the link text (AC-48)', () => {
    expect(promDescriptionCleanup('<a href="javascript:alert(1)">x</a>')).toBe('<a>x</a>');
  });

  it('keeps only href on a link (AC-48)', () => {
    expect(promDescriptionCleanup('<a href="https://prom.ua" target="_blank">Prom</a>')).toBe(
      '<a href="https://prom.ua">Prom</a>',
    );
  });

  it('turns an empty paragraph into an empty string (AC-48)', () => {
    for (const html of ['<p></p>', '<p>&nbsp;</p>', '<p><br></p>']) {
      expect(promDescriptionCleanup(html), html).toBe('');
    }
  });
});
