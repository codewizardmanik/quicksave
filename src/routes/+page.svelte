<script lang="ts">
  import { onMount } from "svelte";
  import { SplashScreen } from "@capacitor/splash-screen";

  let text = $state("");

  let notes = $state<string[]>([""]);
  let active = $state(0);
  let attrOpen = $state(false);

  let font = $state("Funnel Display");
  let fontSize = $state(16);
  let darkMode = $state(false);

  let contextOpen = $state(false);
  let contextNote = $state(-1);
  let renameOpen = $state(false);
  let renameValue = $state("");

  const fontSizes = [14, 16, 18, 20, 24];
  const MAX_NOTE_NAME_LENGTH = 16;

  function deleteNote(i: number) {
    if (notes.length <= 1) return;

    notes.splice(i, 1);

    if (active >= notes.length) {
      active = notes.length - 1;
    }

    text = notes[active] ?? "";
    persist();
  }

  function openContextMenu(event: MouseEvent, i: number) {
    event.preventDefault();

    contextNote = i;
    contextOpen = true;
    renameOpen = false;
  }

  function closeContextMenu() {
    contextOpen = false;
    contextNote = -1;
  }

  function openRename() {
    if (contextNote < 0) return;

    renameValue = notes[contextNote] ?? "";
    renameOpen = true;
    contextOpen = false;
  }

  function renameNote() {
    if (contextNote < 0) return;

    const name = renameValue
      .slice(0, MAX_NOTE_NAME_LENGTH)
      .trim();

    notes[contextNote] = name;

    if (contextNote === active) {
      text = name;
    }

    persist();

    renameOpen = false;
    contextNote = -1;
  }

  function cancelRename() {
    renameOpen = false;
    contextNote = -1;
  }

  function load() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("quicksave");

    if (raw) {
      notes = JSON.parse(raw);

      // Enforce the 16-character title limit on older notes
      notes = notes.map((note) =>
        note.slice(0, MAX_NOTE_NAME_LENGTH)
      );
    }

    const savedFont = localStorage.getItem("quicksave-font");
    const savedSize = localStorage.getItem("quicksave-font-size");
    const savedTheme = localStorage.getItem("quicksave-dark");

    if (savedFont) font = savedFont;
    if (savedSize) fontSize = Number(savedSize);
    if (savedTheme) darkMode = savedTheme === "true";

    text = notes[active] ?? "";
  }

  function persist() {
    if (typeof window === "undefined") return;
    localStorage.setItem("quicksave", JSON.stringify(notes));
  }

  function setText(v: string) {
    notes[active] = v;
    text = v;
    persist();
  }

  function newNote() {
    notes = [...notes, ""];
    active = notes.length - 1;
    text = "";
    persist();
  }

  function switchNote(i: number) {
    active = i;
    text = notes[i] ?? "";
    closeContextMenu();
  }

  function attr() {
    attrOpen = !attrOpen;
  }

  function changeFont() {
    localStorage.setItem("quicksave-font", font);
  }

  function changeFontSize() {
    const current = fontSizes.indexOf(fontSize);
    const next = (current + 1) % fontSizes.length;

    fontSize = fontSizes[next];
    localStorage.setItem("quicksave-font-size", String(fontSize));
  }

  function toggleDarkMode() {
    darkMode = !darkMode;
    localStorage.setItem("quicksave-dark", String(darkMode));
  }

  onMount(() => {
    load();
    SplashScreen.hide();

    const close = () => {
      closeContextMenu();
    };

    window.addEventListener("click", close);

    return () => {
      window.removeEventListener("click", close);
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

<main class:dark={darkMode} class="wrap">
  <textarea
    class="editor"
    bind:value={text}
    oninput={(e) =>
      setText((e.target as HTMLTextAreaElement).value)}
    placeholder="Start jotting down your thoughts..."
    style={`font-family: ${font}; font-size: ${fontSize}px;`}
  ></textarea>

  <div class="bar">
    <div class="notes">
      {#each notes as n, i}
        <button
          class="note {i === active ? 'active' : ''}"
          onclick={() => switchNote(i)}
          oncontextmenu={(e) => openContextMenu(e, i)}
        >
          {n.slice(0, MAX_NOTE_NAME_LENGTH) || "new"}
        </button>
      {/each}
    </div>

    <select
      class="font-select"
      bind:value={font}
      onchange={changeFont}
      aria-label="Font"
    >
      <option value="Funnel Display">Funnel Display</option>
      <option value="Instrument Serif">Instrument Serif</option>
      <option value="JetBrains Mono">JetBrains Mono</option>
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
      onclick={toggleDarkMode}
      title="Toggle dark mode"
    >
      {darkMode ? "☀️" : "🌙"}
    </button>

    <button class="plus" onclick={newNote} title="New note">
      ➕
    </button>

    <button class="plus" onclick={attr} title="About">
      ℹ️
    </button>
  </div>

  {#if contextOpen}
    <div
      class="context-menu"
      onclick={(e) => e.stopPropagation()}
      oncontextmenu={(e) => e.preventDefault()}
    >
      <button onclick={openRename} title="Rename">
        ✏️
      </button>

      <div class="context-divider"></div>

      <button
        class="delete-button"
        onclick={() => {
          if (contextNote >= 0) {
            deleteNote(contextNote);
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
    <div class="overlay" onclick={cancelRename}>
      <div
        class="rename-popup"
        onclick={(e) => e.stopPropagation()}
      >
        <h2>Rename note</h2>

        <input
          class="rename-input"
          type="text"
          bind:value={renameValue}
          maxlength={MAX_NOTE_NAME_LENGTH}
          autofocus
          onkeydown={(e) => {
            if (e.key === "Enter") renameNote();
            if (e.key === "Escape") cancelRename();
          }}
        />

        <div class="rename-footer">
          <span>
            {renameValue.length}/{MAX_NOTE_NAME_LENGTH}
          </span>

          <div class="rename-actions">
            <button onclick={cancelRename}>
              Cancel
            </button>

            <button class="save-button" onclick={renameNote}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  {/if}

  {#if attrOpen}
    <div class="overlay" onclick={() => (attrOpen = false)}>
      <div
        class="popup"
        onclick={(e) => e.stopPropagation()}
      >
        <h2>About Quicksave</h2>
        <p>A tiny local-first notes app.</p>

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

  .editor {
    flex: 1;
    width: 100%;

    border: none;
    outline: none;
    resize: none;

    padding: 18px;

    line-height: 1.5;

    background: transparent;
    color: inherit;

    transition: color 0.2s ease;
  }

  .editor::placeholder {
    color: #888;
  }

  .bar {
    height: 75px;
    min-height: 75px;

    display: flex;
    align-items: center;

    border-top: 1px solid #e5e5e5;

    padding: 0 12px;
    gap: 8px;

    background: #f5f5f5;
  }

  .dark .bar {
    background: #26262a;
    border-top-color: #3a3a3f;
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

    font-family: inherit;
    font-size: 15px;

    padding: 4px 9px;

    border: 1px solid #ddd;
    border-radius: 6px;

    background: transparent;
    color: inherit;

    cursor: pointer;
    white-space: nowrap;
  }

  .dark .note {
    border-color: #444449;
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

    padding: 0 10px;

    border: 1px solid #ddd;
    border-radius: 6px;

    background: transparent;
    color: inherit;

    font-family: inherit;
    font-size: 14px;

    cursor: pointer;
    outline: none;
  }

  .dark .font-select {
    border-color: #444449;
    background: #26262a;
    color: #f5f5f5;
  }

  .control {
    height: 39px;
    min-width: 48px;

    padding: 0 10px;

    border: 1px solid #ddd;
    border-radius: 6px;

    background: transparent;
    color: inherit;

    font-family: inherit;
    font-size: 14px;

    cursor: pointer;
  }

  .dark .control {
    border-color: #444449;
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

  .plus:hover,
  .control:hover,
  .font-select:hover,
  .note:hover {
    background: rgba(128, 128, 128, 0.12);
  }

  /* Right-click menu */
  .context-menu {
    position: fixed;

    display: flex;
    align-items: center;

    padding: 5px;

    background: white;
    color: #111;

    border: 1px solid #ddd;
    border-radius: 8px;

    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.15);

    z-index: 2000;
  }

  .dark .context-menu {
    background: #303035;
    color: #f5f5f5;
    border-color: #444449;
  }

  .context-menu button {
    width: 38px;
    height: 38px;

    border: none;
    border-radius: 6px;

    background: transparent;
    color: inherit;

    cursor: pointer;

    font-size: 17px;
  }

  .context-menu button:hover {
    background: rgba(128, 128, 128, 0.15);
  }

  .context-menu .delete-button:hover {
    background: rgba(220, 50, 50, 0.15);
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

  /* Rename popup */
  .rename-popup {
    width: min(400px, 90vw);

    padding: 20px;

    background: white;
    color: #111;

    border-radius: 12px;

    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .dark .rename-popup {
    background: #303035;
    color: #f5f5f5;
  }

  .rename-popup h2 {
    margin-top: 0;
  }

  .rename-input {
    width: 100%;

    padding: 10px 12px;

    border: 1px solid #ddd;
    border-radius: 7px;

    outline: none;

    background: transparent;
    color: inherit;

    font-family: inherit;
    font-size: 16px;
  }

  .dark .rename-input {
    border-color: #4a4a50;
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
    padding: 7px 12px;

    border: 1px solid #ddd;
    border-radius: 6px;

    background: transparent;
    color: inherit;

    cursor: pointer;
    font-family: inherit;
  }

  .rename-actions .save-button {
    background: #111;
    color: white;
    border-color: #111;
  }

  .dark .rename-actions .save-button {
    background: #f5f5f5;
    color: #26262a;
    border-color: #f5f5f5;
  }

  .overlay {
    position: fixed;
    inset: 0;

    background: rgba(0, 0, 0, 0.4);

    display: flex;
    align-items: center;
    justify-content: center;

    z-index: 1000;
  }

  .popup {
    width: min(400px, 90vw);

    padding: 20px;

    background: white;
    color: #111;

    border-radius: 12px;

    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
  }

  .popup h2 {
    margin-top: 0;
  }

  .underline {
    color: inherit;
    text-decoration: underline;
  }
</style>
