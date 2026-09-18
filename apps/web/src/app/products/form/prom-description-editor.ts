import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  type ElementRef,
  forwardRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { type ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import type { Editor } from '@tiptap/core';

export type EditorMode = 'visual' | 'html';

type ToolbarAction = {
  readonly id: string;
  readonly icon: string;
  readonly label: string;
  /** `null` for undo and redo: they have no "active" state to highlight. */
  readonly isActive: ((editor: Editor) => boolean) | null;
  readonly run: (editor: Editor) => void;
};

/**
 * A heading level 3, not 2: Prom renders the card's own title as the page heading, so the
 * description's sections sit one level below it.
 */
const SECTION_HEADING = { level: 3 } as const;

const TOOLBAR: readonly ToolbarAction[] = [
  {
    id: 'bold',
    icon: 'format_bold',
    label: 'Жирний',
    isActive: (editor) => editor.isActive('bold'),
    run: (editor) => editor.chain().focus().toggleBold().run(),
  },
  {
    id: 'italic',
    icon: 'format_italic',
    label: 'Курсив',
    isActive: (editor) => editor.isActive('italic'),
    run: (editor) => editor.chain().focus().toggleItalic().run(),
  },
  {
    id: 'bulletList',
    icon: 'format_list_bulleted',
    label: 'Маркований список',
    isActive: (editor) => editor.isActive('bulletList'),
    run: (editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: 'orderedList',
    icon: 'format_list_numbered',
    label: 'Нумерований список',
    isActive: (editor) => editor.isActive('orderedList'),
    run: (editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: 'heading',
    icon: 'title',
    label: 'Заголовок',
    isActive: (editor) => editor.isActive('heading', SECTION_HEADING),
    run: (editor) => editor.chain().focus().toggleHeading(SECTION_HEADING).run(),
  },
  {
    id: 'link',
    icon: 'link',
    label: 'Посилання',
    isActive: (editor) => editor.isActive('link'),
    run: (editor) => {
      if (editor.isActive('link')) {
        editor.chain().focus().unsetLink().run();
        return;
      }
      const href = window.prompt('Адреса посилання', 'https://');
      if (href !== null && href.trim() !== '') {
        editor.chain().focus().extendMarkRange('link').setLink({ href: href.trim() }).run();
      }
    },
  },
  {
    id: 'undo',
    icon: 'undo',
    label: 'Скасувати дію',
    isActive: null,
    run: (editor) => editor.chain().focus().undo().run(),
  },
  {
    id: 'redo',
    icon: 'redo',
    label: 'Повторити дію',
    isActive: null,
    run: (editor) => editor.chain().focus().redo().run(),
  },
];

/**
 * Tiptap and ProseMirror weigh about 100 KB gzip, so they are fetched when the editor is first
 * shown rather than shipped in the catalogue chunk (ADR 0016 №3).
 */
async function createEditor(
  element: HTMLElement,
  content: string,
  editable: boolean,
): Promise<Editor> {
  const [core, document, paragraph, text, bold, italic, underline, heading, list, link, br, ext] =
    await Promise.all([
      import('@tiptap/core'),
      import('@tiptap/extension-document'),
      import('@tiptap/extension-paragraph'),
      import('@tiptap/extension-text'),
      import('@tiptap/extension-bold'),
      import('@tiptap/extension-italic'),
      import('@tiptap/extension-underline'),
      import('@tiptap/extension-heading'),
      import('@tiptap/extension-list'),
      import('@tiptap/extension-link'),
      import('@tiptap/extension-hard-break'),
      import('@tiptap/extensions'),
    ]);

  return new core.Editor({
    element,
    content,
    editable,
    editorProps: {
      attributes: { role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Опис для Prom' },
    },
    extensions: [
      document.Document,
      paragraph.Paragraph,
      text.Text,
      bold.Bold,
      italic.Italic,
      // Not on the toolbar, but a `<u>` already in the text must survive being opened.
      underline.Underline,
      heading.Heading.configure({ levels: [2, 3, 4] }),
      list.BulletList,
      list.OrderedList,
      list.ListItem,
      // The server keeps nothing but `href` (ADR 0016 №2); Tiptap's default `target` and `rel`
      // would make every saved link differ from the one on screen.
      link.Link.configure({
        openOnClick: false,
        autolink: false,
        protocols: ['mailto'],
        HTMLAttributes: { target: null, rel: null, class: null },
      }),
      br.HardBreak,
      ext.UndoRedo,
    ],
  });
}

/**
 * The Prom description is HTML (ADR 0016); every other text of the card stays a `textarea`.
 * Two modes over one value: switching between them never loses an edit.
 */
@Component({
  selector: 'app-prom-description-editor',
  imports: [MatButtonModule, MatButtonToggleModule, MatIconModule, MatTooltipModule],
  templateUrl: './prom-description-editor.html',
  styleUrl: './prom-description-editor.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PromDescriptionEditor),
      multi: true,
    },
  ],
})
export class PromDescriptionEditor implements ControlValueAccessor {
  private readonly host = viewChild.required<ElementRef<HTMLElement>>('host');

  protected readonly toolbar = TOOLBAR;
  protected readonly mode = signal<EditorMode>('visual');
  protected readonly value = signal('');
  protected readonly disabled = signal(false);
  protected readonly loaded = signal(false);
  /** Ids of the toolbar actions under the cursor; a signal, since zoneless CD would not see the editor. */
  protected readonly active = signal<ReadonlySet<string>>(new Set());

  private editor: Editor | null = null;
  private onChange: (value: string) => void = () => undefined;
  private onTouched: () => void = () => undefined;

  constructor() {
    const destroyRef = inject(DestroyRef);
    let destroyed = false;
    destroyRef.onDestroy(() => {
      destroyed = true;
      this.editor?.destroy();
    });

    afterNextRender(() => {
      void createEditor(this.host().nativeElement, this.value(), !this.disabled()).then(
        (editor) => {
          if (destroyed) {
            editor.destroy();
            return;
          }
          this.editor = editor;
          editor.on('update', () => {
            this.emit(editor.isEmpty ? '' : editor.getHTML());
          });
          editor.on('transaction', () => {
            this.refreshActive(editor);
          });
          editor.on('blur', () => {
            this.onTouched();
          });
          this.loaded.set(true);
        },
      );
    });
  }

  writeValue(value: string | null): void {
    const html = value ?? '';
    this.value.set(html);
    // Loading must not emit: Tiptap normalises what it parses, and an echo would mark a card
    // the admin only opened as changed.
    this.editor?.commands.setContent(html, { emitUpdate: false });
  }

  registerOnChange(onChange: (value: string) => void): void {
    this.onChange = onChange;
  }

  registerOnTouched(onTouched: () => void): void {
    this.onTouched = onTouched;
  }

  setDisabledState(disabled: boolean): void {
    this.disabled.set(disabled);
    this.editor?.setEditable(!disabled, false);
  }

  protected switchMode(mode: EditorMode): void {
    if (mode === this.mode()) {
      return;
    }
    if (mode === 'visual') {
      this.editor?.commands.setContent(this.value(), { emitUpdate: false });
    }
    this.mode.set(mode);
  }

  protected runAction(action: ToolbarAction): void {
    if (this.editor !== null && !this.disabled()) {
      action.run(this.editor);
    }
  }

  /** DOMPurify comes with the cleanup module on first click, not with the catalogue chunk. */
  protected async cleanup(): Promise<void> {
    const { promDescriptionCleanup } = await import('./prom-description-cleanup');
    const cleaned = promDescriptionCleanup(this.value());
    if (cleaned === this.value()) {
      return;
    }
    this.emit(cleaned);
    this.editor?.commands.setContent(cleaned, { emitUpdate: false });
  }

  protected htmlInput(event: Event): void {
    this.emit((event.target as HTMLTextAreaElement).value);
  }

  protected touched(): void {
    this.onTouched();
  }

  private emit(html: string): void {
    this.value.set(html);
    this.onChange(html);
  }

  private refreshActive(editor: Editor): void {
    this.active.set(
      new Set(
        TOOLBAR.filter((action) => action.isActive?.(editor) === true).map((action) => action.id),
      ),
    );
  }
}
