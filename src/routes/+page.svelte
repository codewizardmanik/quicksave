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

  let boldActive = $state(false);
  let italicActive = $state(false);
  let underlineActive = $state(false);
  let bulletActive = $state(false);
  let orderedActive = $state(false);

  const fontSizes = [14, 16, 18, 20, 24];
  const MAX_NOTE_NAME_LENGTH = 16;

  /*
   * ------------------------------------------------------------
   * EDITOR
   * ------------------------------------------------------------
   */

  function updateFormattingState() {
    if (!editor) return;

    boldActive = document.queryCommandState("bold");
    italicActive = document.queryCommandState("italic");
    underlineActive = document.queryCommandState("underline");

    bulletActive =
      document.queryCommandState("insertUnorderedList");

    orderedActive =
      document.queryCommandState("insertOrderedList");
  }

  function exec(command: string) {
    editor?.focus();

    document.execCommand(command);

    updateFormattingState();
    updateEditor();
  }

  function handleKeydown(event: KeyboardEvent) {
    /*
     * Ctrl/Cmd + B
     */
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "b"
    ) {
      event.preventDefault();
      exec("bold");
      return;
    }

    /*
     * Ctrl/Cmd + I
     */
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "i"
    ) {
      event.preventDefault();
      exec("italic");
      return;
    }

    /*
     * Ctrl/Cmd + U
     */
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "u"
    ) {
      event.preventDefault();
      exec("underline");
      return;
    }

    /*
     * Markdown lists
     */
    if (event.key === " ") {
      const selection = window.getSelection();

      if (!selection?.rangeCount) return;

      const range = selection.getRangeAt(0);
      const node = range.startContainer;

      if (node.nodeType !== Node.TEXT_NODE) return;

      const before =
        node.textContent?.slice(
          0,
          range.startOffset
        ) ?? "";

      /*
       * - item
       * * item
       * + item
       */
      if (/^[-*+]\s$/.test(before)) {
        event.preventDefault();

        document.execCommand(
          "insertUnorderedList"
        );

        const current =
          node.textContent ?? "";

        node.textContent =
          current.slice(0, -2);

        const newRange = document.createRange();

        newRange.selectNodeContents(node);
        newRange.collapse(false);

        selection.removeAllRanges();
        selection.addRange(newRange);

        updateFormattingState();
        updateEditor();

        return;
      }

      /*
       * 1. item
       */
      if (/^\d+\.\s$/.test(before)) {
        event.preventDefault();

        document.execCommand(
          "insertOrderedList"
        );

        const current =
          node.textContent ?? "";

        const match =
          current.match(/^(\d+)\.\s$/);

        if (match) {
          node.textContent =
            current.slice(match[0].length);
        }

        const newRange = document.createRange();

        newRange.selectNodeContents(node);
        newRange.collapse(false);

        selection.removeAllRanges();
        selection.addRange(newRange);

        updateFormattingState();
        updateEditor();

        return;
      }
    }

    /*
     * Detect Markdown formatting after
     * typing * or _.
     */
    if (
      event.key === "*" ||
      event.key === "_"
    ) {
      requestAnimationFrame(
        convertMarkdownFormatting
      );
    }
  }

  function convertMarkdownFormatting() {
    if (!editor) return;

    const selection = window.getSelection();

    if (!selection?.rangeCount) return;

    const range = selection.getRangeAt(0);
    const node = range.startContainer;

    if (node.nodeType !== Node.TEXT_NODE) return;

    const value = node.textContent ?? "";
    const cursor = range.startOffset;

    const before = value.slice(0, cursor);

    /*
     * **bold**
     */
    const boldMatch =
      before.match(/\*\*([^*\n]+)\*\*$/);

    if (boldMatch) {
      replaceMarkdownRange(
        node,
        cursor - boldMatch[0].length,
        cursor,
        boldMatch[1],
        "bold"
      );

      return;
    }

    /*
     * __bold__
     */
    const boldUnderscore =
      before.match(/__([^_\n]+)__$/);

    if (boldUnderscore) {
      replaceMarkdownRange(
        node,
        cursor - boldUnderscore[0].length,
        cursor,
        boldUnderscore[1],
        "bold"
      );

      return;
    }

    /*
     * *italic*
     */
    const italicMatch =
      before.match(
        /(?<!\*)\*([^*\n]+)\*$/
      );

    if (italicMatch) {
      replaceMarkdownRange(
        node,
        cursor - italicMatch[0].length,
        cursor,
        italicMatch[1],
        "italic"
      );

      return;
    }

    /*
     * _italic_
     */
    const italicUnderscore =
      before.match(
        /(?<!_)_([^_\n]+)_$/
      );

    if (italicUnderscore) {
      replaceMarkdownRange(
        node,
        cursor - italicUnderscore[0].length,
        cursor,
        italicUnderscore[1],
        "italic"
      );
    }
  }

  function replaceMarkdownRange(
    node: Node,
    start: number,
    end: number,
    content: string,
    command: string
  ) {
    const range = document.createRange();

    range.setStart(node, start);
    range.setEnd(node, end);

    const selection = window.getSelection();

    selection?.removeAllRanges();
    selection?.addRange(range);

    /*
     * Replace the Markdown syntax
     * with the actual text.
     */
    document.execCommand(
      "insertText",
      false,
      content
    );

    const newSelection =
      window.getSelection();

    if (!newSelection?.rangeCount) return;

    const walker =
      document.createTreeWalker(
        editor,
        NodeFilter.SHOW_TEXT
      );

    let textNode: Text | null = null;

    while (walker.nextNode()) {
      if (
        walker.currentNode.textContent ===
        content
      ) {
        textNode =
          walker.currentNode as Text;
        break;
      }
    }

    if (!textNode) return;

    const formatRange =
      document.createRange();

    formatRange.selectNodeContents(textNode);

    newSelection.removeAllRanges();
    newSelection.addRange(formatRange);

    document.execCommand(command);

    formatRange.collapse(false);

    newSelection.removeAllRanges();
    newSelection.addRange(formatRange);

    updateFormattingState();
    updateEditor();
  }

  /*
   * ------------------------------------------------------------
   * STORAGE / CONTENT
   * ------------------------------------------------------------
   */

  function htmlToText(root: HTMLElement) {
    return root.innerText
      .replace(/\u00a0/g, " ")
      .trimEnd();
  }

  function updateEditor() {
    if (!editor) return;

    const note = notes[active];

    if (!note) return;

    note.content = htmlToText(editor);

    /*
     * If the title has never been manually
     * changed, keep it synced with content.
     */
    if (!note.customTitle) {
      note.title = getAutoTitle(note.content);
    }

    persist();
  }

  function loadEditor() {
    if (!editor) return;

    editor.innerText =
      notes[active]?.content ?? "";

    updateFormattingState();
  }

  /*
   * ------------------------------------------------------------
   * NOTES
   * ------------------------------------------------------------
   */

  function getAutoTitle(content: string) {
    return content
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_NOTE_NAME_LENGTH);
  }

  function getNoteTitle(note: Note) {
    if (note.customTitle) {
      return note.title || "new";
    }

    return getAutoTitle(note.content) || "new";
  }

  function newNote() {
    updateEditor();

    notes = [
      ...notes,
      {
        title: "",
        content: "",
        customTitle: false
      }
    ];

    active = notes.length - 1;

    persist();

    requestAnimationFrame(loadEditor);
  }

  function switchNote(i: number) {
    updateEditor();

    active = i;

    /*
     * Persist the current page so the
     * next reload opens this exact note.
     */
    persist();

    closeContextMenu();

    requestAnimationFrame(loadEditor);
  }

  function deleteNote(i: number) {
    if (notes.length <= 1) return;

    notes.splice(i, 1);

    if (active >= notes.length) {
      active = notes.length - 1;
    }

    persist();

    requestAnimationFrame(loadEditor);
  }

  /*
   * ------------------------------------------------------------
   * CONTEXT MENU
   * ------------------------------------------------------------
   */

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

    /*
     * Center the menu above the note label,
     * rather than placing it at the cursor.
     */
    contextX =
      rect.left + rect.width / 2;

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

    const note = notes[contextNote];

    renameValue = note.customTitle
      ? note.title
      : getAutoTitle(note.content);

    renameOpen = true;
    contextOpen = false;
  }

  function renameNote() {
    if (contextNote < 0) return;

    notes[contextNote].title =
      renameValue
        .slice(0, MAX_NOTE_NAME_LENGTH)
        .trim();

    notes[contextNote].customTitle = true;

    persist();

    renameOpen = false;
    contextNote = -1;
  }

  function cancelRename() {
    renameOpen = false;
    contextNote = -1;
  }

  /*
   * ------------------------------------------------------------
   * SETTINGS
   * ------------------------------------------------------------
   */

  function changeFont() {
    localStorage.setItem(
      "quicksave-font",
      font
    );
  }

  function changeFontSize() {
    const current =
      fontSizes.indexOf(fontSize);

    const next =
      (current + 1) % fontSizes.length;

    fontSize = fontSizes[next];

    localStorage.setItem(
      "quicksave-font-size",
      String(fontSize)
    );
  }

  function toggleDarkMode() {
    darkMode = !darkMode;

    localStorage.setItem(
      "quicksave-dark",
      String(darkMode)
    );
  }

  function attr() {
    attrOpen = !attrOpen;
  }

  /*
   * ------------------------------------------------------------
   * LOAD
   * ------------------------------------------------------------
   */

  function load() {
    const raw =
      localStorage.getItem("quicksave");

    if (raw) {
      try {
        const saved = JSON.parse(raw);

        /*
         * Migrate the original:
         *
         * ["hello", "world"]
         *
         * format into the new format.
         */
        if (
          Array.isArray(saved) &&
          (
            saved.length === 0 ||
            typeof saved[0] === "string"
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
              title: note.title ?? "",
              content: note.content ?? "",
              customTitle:
                note.customTitle ?? false
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

    /*
     * Restore the last active page.
     */
    const savedActive =
      localStorage.getItem(
        "quicksave-active"
      );

    if (savedActive !== null) {
      const index = Number(savedActive);

      if (
        Number.isInteger(index) &&
        index >= 0 &&
        index < notes.length
      ) {
        active = index;
      }
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

    if (savedFont) {
      font = savedFont;
    }

    if (savedSize) {
      fontSize = Number(savedSize);
    }

    if (savedTheme) {
      darkMode =
        savedTheme === "true";
    }
  }

  function persist() {
    localStorage.setItem(
      "quicksave",
      JSON.stringify(notes)
    );

    /*
     * Remember which note was open.
     */
    localStorage.setItem(
      "quicksave-active",
      String(active)
    );
  }

  onMount(() => {
    load();

    SplashScreen.hide();

    requestAnimationFrame(loadEditor);

    const close = () => {
      closeContextMenu();
    };

    window.addEventListener(
      "click",
      close
    );

    document.addEventListener(
      "selectionchange",
      updateFormattingState
    );

    return () => {
      window.removeEventListener(
        "click",
        close
      );

      document.removeEventListener(
        "selectionchange",
        updateFormattingState
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
  <!-- EDITOR -->

  <div
    bind:this={editor}
    class="editor"
    contenteditable="true"
    role="textbox"
    aria-multiline="true"
    data-placeholder="Start jotting down your thoughts..."
    oninput={updateEditor}
    onkeydown={handleKeydown}
    onclick={updateFormattingState}
    onkeyup={updateFormattingState}
    style={`font-family: ${font}; font-size: ${fontSize}px;`}
  ></div>

  <!-- BOTTOM BAR -->

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

    <div class="context-divider"></div>

    <!-- BOLD -->

    <button
      class="control"
      class:pressed={boldActive}
      onclick={() => exec("bold")}
      title="Bold"
    >
      <strong>B</strong>
    </button>

    <!-- ITALIC -->

    <button
      class="control"
      class:pressed={italicActive}
      onclick={() => exec("italic")}
      title="Italic"
    >
      <em>I</em>
    </button>

    <!-- UNDERLINE -->

    <button
      class="control"
      class:pressed={underlineActive}
      onclick={() =>
        exec("underline")}
      title="Underline"
    >
      <u>U</u>
    </button>

    <div class="context-divider"></div>

    <!-- FONT -->

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

    <!-- FONT SIZE -->

    <button
      class="control"
      onclick={changeFontSize}
      title="Change text size"
    >
      {fontSize}px
    </button>

    <!-- DARK MODE -->

    <button
      class="control"
      onclick={toggleDarkMode}
      title="Toggle dark mode"
    >
      {darkMode
        ? "☀️"
        : "🌙"}
    </button>

    <div class="context-divider"></div>

    <!-- NEW NOTE -->

    <button
      class="plus"
      onclick={newNote}
      title="New note"
    >
      ➕
    </button>

    <!-- ABOUT -->

    <button
      class="plus"
      onclick={attr}
      title="About"
    >
      ℹ️
    </button>
  </div>

  <!-- CONTEXT MENU -->

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

      <div class="context-divider"></div>

      <button
        onclick={() => {
          if (contextNote >= 0) {
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

  <!-- RENAME -->

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
            if (e.key === "Enter") {
              renameNote();
            }

            if (e.key === "Escape") {
              cancelRename();
            }
          }}
        />

        <div class="rename-footer">
          <span>
            {renameValue.length}/
            {MAX_NOTE_NAME_LENGTH}
          </span>

          <div class="rename-actions">
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

  <!-- ABOUT -->

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

  /*
   * ------------------------------------------------------------
   * MAIN
   * ------------------------------------------------------------
   */

  .wrap {
    height: 100vh;
    width: 100vw;

    display: flex;
    flex-direction: column;

    background: #f5f5f5;
    color: #111;
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
    content:
      attr(data-placeholder);

    color: #888;

    pointer-events: none;
  }

  .editor strong {
    font-weight: 700;
  }

  .editor em {
    font-style: italic;
  }

  .editor u {
    text-decoration: underline;
  }

  .editor ul,
  .editor ol {
    padding-left: 30px;
    margin: 6px 0;
  }

  .editor li {
    margin: 3px 0;
  }

  .editor a {
    color: inherit;
    text-decoration: underline;
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

    padding: 0 12px;

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

    padding: 4px 9px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background: transparent;

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

  /*
   * ------------------------------------------------------------
   * FONT SELECTOR
   * ------------------------------------------------------------
   */

  .font-select {
    height: 39px;

    padding: 0 30px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background: transparent;

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

    background: #26262a;

    color: #f5f5f5;
  }

  /*
   * ------------------------------------------------------------
   * CONTROLS
   * ------------------------------------------------------------
   */

  .control {
    height: 39px;

    min-width: 42px;

    padding: 0 10px;

    border:
      1px solid #ddd;

    border-radius: 6px;

    background: transparent;

    color: inherit;

    font-family: inherit;
    font-size: 14px;

    cursor: pointer;

    transition:
      background 0.1s ease,
      color 0.1s ease,
      border 0.1s ease;
  }

  /*
   * Active formatting state
   */

  .control.pressed {
    background: #495057;

    color: white;

    border-color: #495057;
  }

  .control:hover,
  .font-select:hover,
  .plus:hover,
  .note:hover {
    background: #495057;

    color: white;
  }

  .control.pressed:hover {
    background: #495057;

    color: white;
  }

  .plus {
    width: 45px;
    height: 39px;

    border: none;

    border-radius: 6px;

    cursor: pointer;

    background: transparent;

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

    background: transparent;

    color: inherit;

    cursor: pointer;

    font-size: 17px;
  }

  .context-menu button:hover {
    background: #495057;

    color: white;
  }

  .context-divider {
    width: 1px;
    height: 25px;

    background: #ddd;

    margin: 0 3px;
  }

  .dark .context-divider {
    background: #4a4a50;
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

  /*
   * ------------------------------------------------------------
   * RENAME
   * ------------------------------------------------------------
   */

  .rename-input {
    width: 100%;

    padding:
      10px 12px;

    border:
      1px solid #ddd;

    border-radius: 9px;

    outline: none;

    background: transparent;

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

    justify-content:
      space-between;

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

    background: transparent;

    color: inherit;

    cursor: pointer;

    font-family: inherit;
  }

  .rename-actions
    .save-button {
    background: #111;

    color: white;

    border-color: #111;
  }

  .dark
    .rename-actions
    .save-button {
    background: #f5f5f5;

    color: #26262a;

    border-color: #f5f5f5;
  }
</style>
