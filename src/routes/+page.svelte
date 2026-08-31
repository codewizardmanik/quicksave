<script lang="ts">
  import { onMount } from "svelte";
  import { SplashScreen } from "@capacitor/splash-screen";

  let text = $state("");

  let notes = $state<string[]>([""]);
  let active = $state(0);
  let pressTimer: any;
  let attrOpen = $state(false);

  let font = $state("Funnel Display");
  let fontSize = $state(16);
  let darkMode = $state(false);

  const fontSizes = [14, 16, 18, 20, 24];

  function startPress(i: number) {
    pressTimer = setTimeout(() => {
      deleteNote(i);
    }, 600);
  }

  function cancelPress() {
    clearTimeout(pressTimer);
  }

  function deleteNote(i: number) {
    if (notes.length <= 1) return;

    notes.splice(i, 1);

    if (active >= notes.length) {
      active = notes.length - 1;
    }

    text = notes[active] ?? "";
    persist();
  }

  function load() {
    if (typeof window === "undefined") return;

    const raw = localStorage.getItem("quicksave");

    if (raw) {
      notes = JSON.parse(raw);
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
          onpointerdown={() => startPress(i)}
          onpointerup={cancelPress}
          onpointerleave={cancelPress}
        >
          {n.slice(0, 10) || "new"}
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

  /* Bottom bar: 50px -> 75px */
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
