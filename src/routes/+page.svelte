<script lang="ts">
  import { onMount } from "svelte";
  import { SplashScreen } from "@capacitor/splash-screen";

  type Note = {
    title: string;
    content: string;
    customTitle: boolean;
  };

  let notes = $state<Note[]>([
    {
      title: "",
      content: "",
      customTitle: false
    }
  ]);

  let active = $state(0);

  let attrOpen = $state(false);

  let font = $state("Funnel Display");
  let fontSize = $state(16);
  let darkMode = $state(false);

  let contextOpen = $state(false);
  let contextNote = $state(-1);
  let contextX = $state(0);
  let contextY = $state(0);

  let renameOpen = $state(false);
  let renameValue = $state("");

  let editor: HTMLDivElement;

  const fontSizes = [14, 16, 18, 20, 24];
  const MAX_NOTE_NAME_LENGTH = 16;

  /*
   * ------------------------------------------------------------
   * MARKDOWN / RICH TEXT
   * ------------------------------------------------------------
   */

  function escapeHtml(value: string) {
    return value
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function formatInline(text: string) {
    let value = escapeHtml(text);

    // URLs
    value = value.replace(
      /(?<!["'=])(https?:\/\/[^\s<]+)/g,
      (url) => {
        let cleanUrl = url;
        let punctuation = "";

        const match = cleanUrl.match(
          /([.,!?;:)]+)$/
        );

        if (match) {
          punctuation = match[1];
          cleanUrl = cleanUrl.slice(
            0,
            -punctuation.length
          );
        }

        return `<a
          href="${cleanUrl}"
          target="_blank"
          rel="noopener noreferrer"
        >${cleanUrl}</a>${punctuation}`;
      }
    );

    /*
     * Bold
     * **text**
     * __text__
     */
    value = value.replace(
      /\*\*(.+?)\*\*/g,
      "<strong>$1</strong>"
    );

    value = value.replace(
      /__(.+?)__/g,
      "<strong>$1</strong>"
    );

    /*
     * Underline
     * ++text++
     */
    value = value.replace(
      /\+\+(.+?)\+\+/g,
      "<u>$1</u>"
    );

    /*
     * Italic
     * *text*
     */
    value = value.replace(
      /(?<!\*)\*([^*\n]+)\*(?!\*)/g,
      "<em>$1</em>"
    );

    /*
     * Inline code
     */
    value = value.replace(
      /`([^`]+)`/g,
      "<code>$1</code>"
    );

    return value;
  }

  function markdownToHtml(markdown: string) {
    const lines = markdown.split("\n");

    let html = "";
    let inUl = false;
    let inOl = false;

    function closeLists() {
      if (inUl) {
        html += "</ul>";
        inUl = false;
      }

      if (inOl) {
        html += "</ol>";
        inOl = false;
      }
    }

    for (const rawLine of lines) {
      const line = rawLine;

      /*
       * Empty line
       */
      if (!line.trim()) {
        closeLists();
        html += "<div><br></div>";
        continue;
      }

      /*
       * Headings
       *
       * # Heading
       * ## Heading
       * ### Heading
       */
      const heading = line.match(
        /^(#{1,6})\s+(.+)$/
      );

      if (heading) {
        closeLists();

        const level = heading[1].length;

        html += `<h${level}>${formatInline(
          heading[2]
        )}</h${level}>`;

        continue;
      }

      /*
       * Unordered list
       *
       * - item
       * * item
       * + item
       */
      const unordered = line.match(
        /^(\s*)[-*+]\s+(.+)$/
      );

      if (unordered) {
        if (inOl) {
          html += "</ol>";
          inOl = false;
        }

        if (!inUl) {
          html += "<ul>";
          inUl = true;
        }

        html += `<li>${formatInline(
          unordered[2]
        )}</li>`;

        continue;
      }

      /*
       * Ordered list
       *
       * 1. item
       * 2. item
       */
      const ordered = line.match(
        /^(\s*)\d+\.\s+(.+)$/
      );

      if (ordered) {
        if (inUl) {
          html += "</ul>";
          inUl = false;
        }

        if (!inOl) {
          html += "<ol>";
          inOl = true;
        }

        html += `<li>${formatInline(
          ordered[2]
        )}</li>`;

        continue;
      }

      /*
       * Blockquote
       */
      const quote = line.match(
        /^>\s?(.*)$/
      );

      if (quote) {
        closeLists();

        html += `<blockquote>${formatInline(
          quote[1]
        )}</blockquote>`;

        continue;
      }

      /*
       * Horizontal rule
       */
      if (
        line.trim() === "---" ||
        line.trim() === "***" ||
        line.trim() === "___"
      ) {
        closeLists();
        html += "<hr>";
        continue;
      }

      /*
       * Normal paragraph
       */
      closeLists();

      html += `<div>${formatInline(
        line
      )}</div>`;
    }

    closeLists();

    return html;
  }

  /*
   * Convert editor HTML back into Markdown-ish text.
   *
   * This keeps the data reasonably portable while allowing
   * the editor to visually format it.
   */
  function htmlToMarkdown(root: HTMLElement) {
    function process(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
      }

      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }

      const el = node as HTMLElement;
      const children = Array.from(el.childNodes)
        .map(process)
        .join("");

      switch (el.tagName.toLowerCase()) {
        case "strong":
        case "b":
          return `**${children}**`;

        case "em":
        case "i":
          return `*${children}*`;

        case "u":
          return `++${children}++`;

        case "code":
          return `\`${children}\``;

        case "a":
          return children;

        case "h1":
          return `# ${children}\n`;

        case "h2":
          return `## ${children}\n`;

        case "h3":
          return `### ${children}\n`;

        case "h4":
          return `#### ${children}\n`;

        case "h5":
          return `##### ${children}\n`;

        case "h6":
          return `###### ${children}\n`;

        case "blockquote":
          return `> ${children}\n`;

        case "hr":
          return "---\n";

        case "br":
          return "\n";

        case "li":
          return `${children}\n`;

        case "ul":
          return (
            Array.from(el.children)
              .map(
                (li) =>
                  `- ${process(li)}`
              )
              .join("")
          );

        case "ol":
          return (
            Array.from(el.children)
              .map(
                (li, i) =>
                  `${i + 1}. ${process(li)}`
              )
              .join("")
          );

        case "div":
        case "p":
          return `${children}\n`;

        default:
          return children;
      }
    }

    return process(root)
      .replace(/\n{3,}/g, "\n\n")
      .trimEnd();
  }

  function updateEditor() {
    if (!editor) return;

    const markdown = htmlToMarkdown(editor);

    const note = notes[active];

    if (!note) return;

    note.content = markdown;

    if (!note.customTitle) {
      note.title = getAutoTitle(markdown);
    }

    persist();
  }

  function handleInput() {
    updateEditor();
  }

  function handleKeydown(
    event: KeyboardEvent
  ) {
    /*
     * Markdown heading conversion
     *
     * Type:
     * # hello
     *
     * and press space after #
     */
    if (event.key === " ") {
      const selection =
        window.getSelection();

      if (!selection?.rangeCount) return;

      const range =
        selection.getRangeAt(0);

      const node =
        range.startContainer;

      if (
        node.nodeType !==
        Node.TEXT_NODE
      ) {
        return;
      }

      const textBefore =
        node.textContent?.slice(
          0,
          range.startOffset
        ) ?? "";

      const headingMatch =
        textBefore.match(
          /^(#{1,6})$/
        );

      if (headingMatch) {
        event.preventDefault();

        const level =
          headingMatch[1].length;

        document.execCommand(
          "formatBlock",
          false,
          `h${level}`
        );

        return;
      }
    }

    /*
     * Ctrl/Cmd + B
     */
    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key.toLowerCase() === "b"
    ) {
      event.preventDefault();

      document.execCommand(
        "bold"
      );

      return;
    }

    /*
     * Ctrl/Cmd + I
     */
    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key.toLowerCase() === "i"
    ) {
      event.preventDefault();

      document.execCommand(
        "italic"
      );

      return;
    }

    /*
     * Ctrl/Cmd + U
     */
    if (
      (event.ctrlKey ||
        event.metaKey) &&
      event.key.toLowerCase() === "u"
    ) {
      event.preventDefault();

      document.execCommand(
        "underline"
      );

      return;
    }
  }

  /*
   * ------------------------------------------------------------
   * NOTES
   * ------------------------------------------------------------
   */

  function getAutoTitle(content: string) {
    return content
      .replace(/^#+\s*/gm, "")
      .replace(/[*_+`]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(
        0,
        MAX_NOTE_NAME_LENGTH
      );
  }

  function getNoteTitle(note: Note) {
    if (note.customTitle) {
      return note.title || "new";
    }

    return (
      getAutoTitle(note.content) ||
      "new"
    );
  }

  function deleteNote(i: number) {
    if (notes.length <= 1) return;

    notes.splice(i, 1);

    if (active >= notes.length) {
      active = notes.length - 1;
    }

    loadEditor();

    persist();
  }

  function openContextMenu(
    event: MouseEvent,
    i: number,
    button: HTMLButtonElement
  ) {
    event.preventDefault();
    event.stopPropagation();

    const rect =
      button.getBoundingClientRect();

    contextNote = i;

    contextX =
      rect.left +
      rect.width / 2;

    contextY =
      rect.top - 8;

    contextOpen = true;
    renameOpen = false;
  }

  function closeContextMenu() {
    contextOpen = false;
    contextNote = -1;
  }

  function openRename() {
    if (contextNote < 0) return;

    const note =
      notes[contextNote];

    renameValue = note.customTitle
      ? note.title
      : getAutoTitle(note.content);

    renameOpen = true;
    contextOpen = false;
  }

  function renameNote() {
    if (contextNote < 0) return;

    const name = renameValue
      .slice(
        0,
        MAX_NOTE_NAME_LENGTH
      )
      .trim();

    notes[contextNote].title =
      name;

    notes[contextNote].customTitle =
      true;

    persist();

    renameOpen = false;
    contextNote = -1;
  }

  function cancelRename() {
    renameOpen = false;
    contextNote = -1;
  }

  function loadEditor() {
    if (!editor) return;

    editor.innerHTML =
      markdownToHtml(
        notes[active]?.content ?? ""
      );
  }

  function load() {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    const raw =
      localStorage.getItem(
        "quicksave"
      );

    if (raw) {
      try {
        const saved =
          JSON.parse(raw);

        /*
         * Migrate old notes.
         */
        if (
          Array.isArray(saved) &&
          (
            saved.length === 0 ||
            typeof saved[0] ===
              "string"
          )
        ) {
          notes = saved.map(
            (content: string) => ({
              title: "",
              content,
              customTitle: false
            })
          );
        } else {
          notes = saved.map(
            (note: Note) => ({
              title:
                note.title ?? "",
              content:
                note.content ?? "",
              customTitle:
                note.customTitle ??
                false
            })
          );
        }
      } catch {
        notes = [
          {
            title: "",
            content: "",
            customTitle: false
          }
        ];
      }
    }

    if (notes.length === 0) {
      notes = [
        {
          title: "",
          content: "",
          customTitle: false
        }
      ];
    }

    const savedFont =
      localStorage.getItem(
        "quicksave-font"
      );

    const savedSize =
      localStorage.getItem(
        "quicksave-font-size"
      );

    const savedTheme =
      localStorage.getItem(
        "quicksave-dark"
      );

    if (savedFont)
      font = savedFont;

    if (savedSize)
      fontSize = Number(savedSize);

    if (savedTheme)
      darkMode =
        savedTheme === "true";
  }

  function persist() {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    localStorage.setItem(
      "quicksave",
      JSON.stringify(notes)
    );
  }

  function newNote() {
    notes = [
      ...notes,
      {
        title: "",
        content: "",
        customTitle: false
      }
    ];

    active =
      notes.length - 1;

    persist();

    requestAnimationFrame(
      loadEditor
    );
  }

  function switchNote(i: number) {
    /*
     * Save current note before switching.
     */
    updateEditor();

    active = i;

    closeContextMenu();

    requestAnimationFrame(
      loadEditor
    );
  }

  function attr() {
    attrOpen =
      !attrOpen;
  }

  function changeFont() {
    localStorage.setItem(
      "quicksave-font",
      font
    );
  }

  function changeFontSize() {
    const current =
      fontSizes.indexOf(
        fontSize
      );

    const next =
      (current + 1) %
      fontSizes.length;

    fontSize =
      fontSizes[next];

    localStorage.setItem(
      "quicksave-font-size",
      String(fontSize)
    );
  }

  function toggleDarkMode() {
    darkMode =
      !darkMode;

    localStorage.setItem(
      "quicksave-dark",
      String(darkMode)
    );
  }

  onMount(() => {
    load();

    SplashScreen.hide();

    requestAnimationFrame(
      loadEditor
    );

    const close = () => {
      closeContextMenu();
    };

    window.addEventListener(
      "click",
      close
    );

    return () => {
      window.removeEventListener(
        "click",
        close
      );
    };
  });
</script>

<svelte:head>
  <title>Quicksave</title>

  <link
    rel="preconnect"
    href="https://fonts.googleapis.com"
  />

  <link
    rel="preconnect"
    href="https://fonts.gstatic.com"
    crossorigin="anonymous"
  />

  <link
    href="https://fonts.googleapis.com/css2?family=Funnel+Display:wght@300..800&family=Instrument+Serif:ital@0;1&family=JetBrains+Mono:wght@100..800&display=swap"
    rel="stylesheet"
  />
</svelte:head>

<main
  class:dark={darkMode}
  class="wrap"
>
  <div
    bind:this={editor}
    class="editor"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    data-placeholder="Start jotting down your thoughts..."
    oninput={handleInput}
    onkeydown={handleKeydown}
    style={`font-family: ${font}; font-size: ${fontSize}px;`}
  ></div>

  <div class="bar">
    <div class="notes">
      {#each notes as note, i}
        <button
          class="note {i === active
            ? 'active'
            : ''}"
          onclick={() =>
            switchNote(i)}
          oncontextmenu={(e) =>
            openContextMenu(
              e,
              i,
              e.currentTarget as HTMLButtonElement
            )}
        >
          {getNoteTitle(note)}
        </button>
      {/each}
    </div>

    <select
      class="font-select"
      bind:value={font}
      onchange={changeFont}
      aria-label="Font"
    >
      <option value="Funnel Display">
        Funnel Display
      </option>

      <option value="Instrument Serif">
        Instrument Serif
      </option>

      <option value="JetBrains Mono">
        JetBrains Mono
      </option>
    </select>

    <button
      class="control"
      onclick={changeFontSize}
      title="Change text size"
    >
      {fontSize}px
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "bold"
        )}
      title="Bold"
    >
      <strong>B</strong>
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "italic"
        )}
      title="Italic"
    >
      <em>I</em>
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "underline"
        )}
      title="Underline"
    >
      <u>U</u>
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "insertUnorderedList"
        )}
      title="Bullet list"
    >
      •
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "insertOrderedList"
        )}
      title="Numbered list"
    >
      1.
    </button>

    <button
      class="control"
      onclick={() =>
        document.execCommand(
          "formatBlock",
          false,
          "h1"
        )}
      title="Heading"
    >
      H
    </button>

    <button
      class="control"
      onclick={toggleDarkMode}
      title="Toggle dark mode"
    >
      {darkMode
        ? "☀️"
        : "🌙"}
    </button>

    <button
      class="plus"
      onclick={newNote}
      title="New note"
    >
      ➕
    </button>

    <button
      class="plus"
      onclick={attr}
      title="About"
    >
      ℹ️
    </button>
  </div>

  {#if contextOpen}
    <div
      class="context-menu"
      style={`
        left: ${contextX}px;
        top: ${contextY}px;
        transform: translate(-50%, -100%);
      `}
      onclick={(e) =>
        e.stopPropagation()}
      oncontextmenu={(e) =>
        e.preventDefault()}
    >
      <button
        onclick={openRename}
        title="Rename"
      >
        ✏️
      </button>

      <div
        class="context-divider"
      ></div>

      <button
        class="delete-button"
        onclick={() => {
          if (
            contextNote >= 0
          ) {
            deleteNote(
              contextNote
            );
          }

          closeContextMenu();
        }}
        title="Delete"
      >
        🗑️
      </button>
    </div>
  {/if}

  {#if renameOpen}
    <div
      class="overlay"
      onclick={cancelRename}
    >
      <div
        class="rename-popup"
        onclick={(e) =>
          e.stopPropagation()}
      >
        <h2>
          Rename note
        </h2>

        <input
          class="rename-input"
          type="text"
          bind:value={renameValue}
          maxlength={MAX_NOTE_NAME_LENGTH}
          autofocus
          onkeydown={(e) => {
            if (e.key === "Enter")
              renameNote();

            if (e.key === "Escape")
              cancelRename();
          }}
        />

        <div
          class="rename-footer"
        >
          <span>
            {renameValue.length}/
            {MAX_NOTE_NAME_LENGTH}
          </span>

          <div
            class="rename-actions"
          >
            <button
              onclick={cancelRename}
            >
              Cancel
            </button>

            <button
              class="save-button"
              onclick={renameNote}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if attrOpen}
    <div
      class="overlay"
      onclick={() =>
        (attrOpen = false)}
    >
      <div
        class="popup"
        onclick={(e) =>
          e.stopPropagation()}
      >
        <h2>
          About Quicksave
        </h2>

        <p>
          A tiny local-first
          notes app.
        </p>

        <a
          href="https://links.maniksharma.xyz/"
          class="underline"
        >
          Made by Manik Sharma
        </a>
      </div>
    </div>
  {/if}
</main>

<style>
  :global(*) {
    box-sizing: border-box;
  }

  .wrap {
    height: 100vh;
    width: 100vw;

    display: flex;
    flex-direction: column;

    background: #f5f5f5;
    color: #111;

    transition:
      background 0.2s ease,
      color 0.2s ease;
  }

  .wrap.dark {
    background: #26262a;
    color: #f5f5f5;
  }

  /*
   * ------------------------------------------------------------
   * EDITOR
   * ------------------------------------------------------------
   */

  .editor {
    flex: 1;

    width: 100%;

    padding: 18px;

    outline: none;
    overflow-y: auto;

    line-height: 1.5;

    background: transparent;
    color: inherit;

    word-break: break-word;
  }

  .editor:empty::before {
    content: attr(data-placeholder);

    color: #888;

    pointer-events: none;
  }

  .editor h1 {
    font-size: 2em;
    font-weight: 700;

    margin:
      0.67em 0;
  }

  .editor h2 {
    font-size: 1.5em;
    font-weight: 700;

    margin:
      0.83em 0;
  }

  .editor h3 {
    font-size: 1.17em;
    font-weight: 700;

    margin:
      1em 0;
  }

  .editor h4 {
    font-size: 1em;
    font-weight: 700;

    margin:
      1.33em 0;
  }

  .editor h5 {
    font-size: 0.83em;
    font-weight: 700;
  }

  .editor h6 {
    font-size: 0.67em;
    font-weight: 700;
  }

  .editor ul,
  .editor ol {
    padding-left: 30px;
    margin:
      8px 0;
  }

  .editor li {
    margin:
      3px 0;
  }

  .editor blockquote {
    margin:
      12px 0;

    padding-left: 14px;

    border-left:
      3px solid #999;

    color: #777;
  }

  .dark .editor blockquote {
    color: #aaa;
  }

  .editor hr {
    border: none;

    border-top:
      1px solid #bbb;

    margin:
      18px 0;
  }

  .editor code {
    padding:
      2px 5px;

    border-radius: 5px;

    background:
      rgba(128, 128, 128, 0.15);

    font-family:
      "JetBrains Mono",
      monospace;
  }

  .editor a {
    color: inherit;

    text-decoration:
      underline;

    cursor: pointer;
  }

  /*
   * ------------------------------------------------------------
   * BOTTOM BAR
   * ------------------------------------------------------------
   */

  .bar {
    height: 75px;
    min-height: 75px;

    display: flex;
    align-items: center;

    border-top:
      1px solid #e5e5e5;

    padding:
      0 12px;

    gap: 8px;

    background: #f5f5f5;
  }

  .dark .bar {
    background: #26262a;

    border-top-color:
      #3a3a3f;
  }

  .notes {
    flex: 1;

    display: flex;
    align-items: center;

    gap: 8px;

    overflow-x: auto;
    min-width: 0;
  }

  .note {
    height: 39px;

    padding:
      4px 9px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background:
      transparent;

    color: inherit;

    cursor: pointer;

    white-space: nowrap;

    font-family: inherit;
    font-size: 15px;
  }

  .dark .note {
    border-color:
      #444449;
  }

  .note.active {
    background: black;
    color: #f5f5f5;

    border-color: black;
  }

  .dark .note.active {
    background: #f5f5f5;
    color: #26262a;

    border-color: #f5f5f5;
  }

  .font-select {
    height: 39px;

    padding:
      0 30px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background:
      transparent;

    color: inherit;

    font-family: inherit;
    font-size: 14px;

    text-align: center;
    text-align-last: center;

    cursor: pointer;
    outline: none;
  }

  .dark .font-select {
    border-color:
      #444449;

    background:
      #26262a;

    color:
      #f5f5f5;
  }

  .control {
    height: 39px;
    min-width: 42px;

    padding:
      0 10px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background:
      transparent;

    color: inherit;

    font-family: inherit;
    font-size: 14px;

    cursor: pointer;
  }

  .dark .control {
    border-color:
      #444449;
  }

  .control:hover,
  .font-select:hover,
  .plus:hover,
  .note:hover {
    background:
      #495057;

    color: white;
  }

  .plus {
    width: 45px;
    height: 39px;

    border: none;

    border-radius: 6px;

    cursor: pointer;

    background:
      transparent;

    color: inherit;

    font-size: 20px;
  }

  /*
   * ------------------------------------------------------------
   * CONTEXT MENU
   * ------------------------------------------------------------
   */

  .context-menu {
    position: fixed;

    display: flex;
    align-items: center;

    padding: 5px;

    background: white;
    color: #111;

    border:
      1px solid #ddd;

    border-radius: 14px;

    box-shadow:
      0 8px 28px
      rgba(0, 0, 0, 0.16);

    z-index: 2000;
  }

  .dark .context-menu {
    background: #303035;
    color: #f5f5f5;

    border-color:
      #444449;
  }

  .context-menu button {
    width: 40px;
    height: 40px;

    border: none;

    border-radius: 10px;

    background:
      transparent;

    color: inherit;

    cursor: pointer;

    font-size: 17px;
  }

  .context-menu button:hover {
    background:
      #495057;

    color: white;
  }

  .context-divider {
    width: 1px;
    height: 25px;

    background: #ddd;

    margin:
      0 3px;
  }

  .dark .context-divider {
    background:
      #4a4a50;
  }

  /*
   * ------------------------------------------------------------
   * POPUPS
   * ------------------------------------------------------------
   */

  .overlay {
    position: fixed;

    inset: 0;

    background:
      rgba(0, 0, 0, 0.4);

    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 1000;
  }

  .popup,
  .rename-popup {
    width:
      min(400px, 90vw);

    padding: 20px;

    background: white;
    color: #111;

    border-radius: 14px;

    box-shadow:
      0 8px 32px
      rgba(0, 0, 0, 0.2);
  }

  .dark .popup,
  .dark .rename-popup {
    background: #303035;
    color: #f5f5f5;
  }

  .popup h2,
  .rename-popup h2 {
    margin-top: 0;
  }

  .underline {
    color: inherit;
    text-decoration: underline;
  }

  .rename-input {
    width: 100%;

    padding:
      10px 12px;

    border:
      1px solid #ddd;

    border-radius: 9px;

    outline: none;

    background:
      transparent;

    color: inherit;

    font-family: inherit;
    font-size: 16px;
  }

  .dark .rename-input {
    border-color:
      #4a4a50;
  }

  .rename-footer {
    display: flex;

    align-items: center;
    justify-content: space-between;

    margin-top: 12px;

    color: #888;

    font-size: 13px;
  }

  .rename-actions {
    display: flex;

    gap: 7px;
  }

  .rename-actions button {
    padding:
      7px 12px;

    border:
      1px solid #ddd;

    border-radius: 7px;

    background:
      transparent;

    color: inherit;

    cursor: pointer;

    font-family: inherit;
  }

  .rename-actions .save-button {
    background: #111;
    color: white;

    border-color: #111;
  }

  .dark
    .rename-actions
    .save-button {
    background: #f5f5f5;

    color: #26262a;

    border-color:
      #f5f5f5;
  }
</style>
